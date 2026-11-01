// Owner: Backend
// หน้าที่: เลือกงานที่ต้องใส่ในข้อความสรุป LINE ประจำวัน แล้วรวมเป็นข้อความเดียวต่อคน
// อ้างอิง: PROJECT_v0.19 §14.4 (สรุปวันละครั้ง 08:00 เวลาไทย), §11.1 (3 กฎ), §11.3 (กันซ้ำเฉพาะ Upcoming), §11.4 (Upcoming reminder), §19.4

import { UPCOMING_WITHIN_WINDOW, computeDeadlineState } from './deadline-state.ts';
import type { Task } from './deadline-state.ts';
import { daysUntilDue, decideReminders, parseSent } from './reminders.ts';

// 1 ข้อความไม่เกิน 30 งาน (v0.19 ขึ้นจาก 10 เพราะ Overdue / Due Today ซ้ำทุกวัน ถ้าตัดงานเดิมทิ้งทุกวัน งานท้าย ๆ จะไม่ถูกเตือนเลย)
// LINE รับข้อความได้ 5000 ตัวอักษร: 30 งาน x (ชื่อ <= 100 + ส่วนเกิน ~15) = ~3500 ยังเหลือที่ให้หัวข้อ
export const MAX_PER_PUSH = 30;
const MAX_TITLE = 100; // กันชื่อยาวจน push เกิน 5000 ตัวอักษรของ LINE แล้วพังซ้ำทุกรอบ

// กลุ่มในข้อความ เรียงตามลำดับ: เลยกำหนด -> วันนี้ -> ใกล้ถึง (v0.19: เรียงตามความเร่งด่วน)
// เกินเพดาน MAX_PER_PUSH จะตัดจากท้าย = ตัด Upcoming ก่อน ซึ่งไม่เสียหาย เพราะยังไม่ถูกจดว่าแจ้งแล้ว วันถัดไปจะได้อีก
const GROUPS = [
  { state: 'overdue', heading: 'เลยกำหนดแล้ว' },
  { state: 'due_today', heading: 'ถึงกำหนดวันนี้' },
  { state: UPCOMING_WITHIN_WINDOW, heading: 'ใกล้ถึงกำหนด' },
];

export type TaskRow = Task & { id: string; title: string };
// แถว line_notification_log ที่อ่านมา: task_id -> { state ที่จดล่าสุด, reminders_sent เช่น '7,3' }
export type LogRow = { last_notified_state: string; reminders_sent: string };
// งานที่จะอยู่ในข้อความ
//   state        กลุ่มในข้อความ (overdue / due_today / upcoming_within_window) และค่าที่จะจดลง log ถ้า record = true
//   daysLeft     ใช้เฉพาะ Upcoming (บอก "อีก N วัน")
//   reminders_sent ค่าที่จะจดลง log (ใช้เมื่อ record = true)
//   record       true = Upcoming reminder ที่ต้องจดว่าแจ้งแล้ว (ไม่ให้แจ้งซ้ำ) / false = Overdue, Due Today ที่แจ้งซ้ำทุกวัน ไม่จด
export type Pending = {
  task_id: string;
  title: string;
  state: string;
  due_date: string;
  daysLeft: number | null;
  reminders_sent: string;
  record: boolean;
};
// แถว log ที่ต้องเขียนโดยไม่ส่งข้อความ (จดเงียบตอนเจอ task ครั้งแรก / due ถูกย้าย §11.4)
export type SilentWrite = { task_id: string; last_notified_state: string; reminders_sent: string };

// เลือกงานที่จะอยู่ในข้อความสรุป (pending) กับแถว log ที่ต้องเขียนเงียบ ๆ (silent)
//   Overdue / Due Today (v0.19): ใส่ทุกครั้งที่รัน ไม่ดู log ซ้ำทุกวันจนกว่างานจะเสร็จ / ถูกลบ / ย้าย due ออกไป
//   Upcoming: decideReminders (§11.4) ด้วย reminderDays ของผู้ใช้คนนี้ ([] = ปิด -> ข้ามทั้งหมด ไม่เขียน log) ใส่ครั้งเดียวต่อ reminder
// ตัวอย่าง: ติ๊ก [7,3,1] task due อีก 5 วัน เจอครั้งแรก -> silent 1 แถว (จด '7' state upcoming_within_window) ไม่มี pending
// เรียงตามกลุ่มก่อน แล้วงานที่ due เก่าสุดก่อน (เกินเพดานจะได้ตัดงานที่ไม่รีบทิ้งท้าย)
export function pickPending(
  tasks: TaskRow[],
  log: Map<string, LogRow>,
  reminderDays: number[],
  now: Date,
): { pending: Pending[]; silent: SilentWrite[] } {
  const pending: Pending[] = [];
  const silent: SilentWrite[] = [];
  for (const task of tasks) {
    try {
      const state = computeDeadlineState(task, now);
      const row = log.get(task.id);

      if (state === 'due_today' || state === 'overdue') {
        pending.push({ task_id: task.id, title: task.title, state, due_date: task.due_date!, daysLeft: null, reminders_sent: row?.reminders_sent ?? '', record: false });
        continue;
      }
      if (state !== 'upcoming' || reminderDays.length === 0) continue; // no_deadline / completed / ปิดการเตือนล่วงหน้า

      const daysLeft = daysUntilDue(task.due_date!, now);
      const result = decideReminders({ daysLeft, ticked: reminderDays, sent: parseSent(row?.reminders_sent), isFirstSight: !row });
      const newState = result.sent.length > 0 ? UPCOMING_WITHIN_WINDOW : 'upcoming';
      const newSent = result.sent.join(',');

      if (result.notify) {
        pending.push({ task_id: task.id, title: task.title, state: newState, due_date: task.due_date!, daysLeft, reminders_sent: newSent, record: true });
      } else if (!row || row.last_notified_state !== newState || row.reminders_sent !== newSent) {
        silent.push({ task_id: task.id, last_notified_state: newState, reminders_sent: newSent });
      }
    } catch (error) {
      // task เดียวที่ข้อมูลเพี้ยนต้องไม่ทำให้ task อื่นไม่ถูกเช็ค (เหมือนฝั่ง desktop)
      console.error(`notify-check: ข้าม task ${task.id}: ${(error as Error).message}`);
    }
  }
  const rank = (p: Pending) => GROUPS.findIndex((group) => group.state === p.state);
  pending.sort((a, b) => rank(a) - rank(b) || new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  return { pending, silent };
}

// รวมเป็นข้อความเดียว คืน shown = งานที่อยู่ในข้อความจริง (ต้องจด log เฉพาะพวก record = true ใน shown)
// งานใน "ใกล้ถึงกำหนด" ต่อท้ายจำนวนวันจริง เช่น "• Lab 3 (อีก 2 วัน)"
export function buildDigest(pending: Pending[]): { text: string; shown: Pending[] } {
  const shown = pending.slice(0, MAX_PER_PUSH);

  const blocks = ['StudyFlow สรุปงานประจำวัน'];
  for (const group of GROUPS) {
    const items = shown.filter((p) => p.state === group.state);
    if (items.length === 0) continue;
    const lines = items.map((p) => {
      const title = p.title.replace(/\s+/g, ' ').trim(); // ชื่อมีขึ้นบรรทัดใหม่ก็ให้เป็นบรรทัดเดียว
      const text = title.length > MAX_TITLE ? title.slice(0, MAX_TITLE) + '…' : title;
      return p.daysLeft === null ? `• ${text}` : `• ${text} (อีก ${p.daysLeft} วัน)`;
    });
    blocks.push([`${group.heading} (${items.length})`, ...lines].join('\n'));
  }

  const rest = pending.length - shown.length;
  if (rest > 0) blocks.push(`(ยังมีอีก ${rest} งาน พิมพ์ "งานค้าง" เพื่อดูงานที่ยังไม่เสร็จ)`);
  return { text: blocks.join('\n\n'), shown };
}
