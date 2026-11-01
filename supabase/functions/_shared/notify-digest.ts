// Owner: Backend
// หน้าที่: เลือก task ที่ต้องแจ้ง LINE (เหมือน loop ของ checkDeadlineStates ฝั่ง desktop) แล้วรวมเป็นข้อความเดียว (ข้อ 8.6)
// อ้างอิง: PROJECT_v0.16 §11.1 (3 กฎ), §11.3 (กันซ้ำ), §11.4 (Upcoming reminder), §14.4

import { UPCOMING_WITHIN_WINDOW, computeDeadlineState } from './deadline-state.ts';
import type { Task } from './deadline-state.ts';
import { daysUntilDue, decideReminders, parseSent } from './reminders.ts';

export const MAX_PER_PUSH = 10; // D7: 1 ข้อความไม่เกิน 10 งาน ที่เหลือไปรอบถัดไป (ตัวอย่าง: ค้าง 12 งาน -> รอบนี้ 10 รอบหน้า 2)
const MAX_TITLE = 100;          // กันชื่อยาวจน push เกิน 5000 ตัวอักษรของ LINE แล้วพังซ้ำทุกรอบ

// state ที่ต้องแจ้ง 3 ตัว (§11.1) เรียงตามลำดับในข้อความ: วันนี้ก่อน แล้วใกล้ถึง แล้วเลยกำหนด
const GROUPS = [
  { state: 'due_today', heading: 'ถึงกำหนดวันนี้' },
  { state: UPCOMING_WITHIN_WINDOW, heading: 'ใกล้ถึงกำหนด' },
  { state: 'overdue', heading: 'เลยกำหนดแล้ว' },
];

export type TaskRow = Task & { id: string; title: string };
// แถว line_notification_log ที่อ่านมา: task_id -> { state ที่แจ้งล่าสุด, reminders_sent เช่น '7,3' }
export type LogRow = { last_notified_state: string; reminders_sent: string };
// task ที่ต้องแจ้ง: state = ค่าที่จะจดลง log, daysLeft ใช้เฉพาะ Upcoming (บอก "อีก N วัน"), reminders_sent = ค่าที่จะจดลง log
export type Pending = { task_id: string; title: string; state: string; due_date: string; daysLeft: number | null; reminders_sent: string };
// แถว log ที่ต้องเขียนโดยไม่ส่งข้อความ (จดเงียบตอนเจอ task ครั้งแรก / due ถูกย้าย §11.4)
export type SilentWrite = { task_id: string; last_notified_state: string; reminders_sent: string };

// เลือก task ที่ต้องแจ้ง (pending) กับแถว log ที่ต้องเขียนเงียบ ๆ (silent) ตามกฎเดียวกับ desktop
//   Due Today / Overdue: state ต่างจากที่จดล่าสุด -> แจ้ง (ตัวอย่าง: log จด due_today พอเลยเวลา due เป็น overdue -> แจ้งอีก 1 ครั้ง)
//   Upcoming: decideReminders (§11.4) ด้วย reminderDays ของผู้ใช้คนนี้ ([] = ปิด -> ข้ามทั้งหมด ไม่เขียน log)
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
        if (row?.last_notified_state === state) continue;
        pending.push({ task_id: task.id, title: task.title, state, due_date: task.due_date!, daysLeft: null, reminders_sent: row?.reminders_sent ?? '' });
        continue;
      }
      if (state !== 'upcoming' || reminderDays.length === 0) continue; // no_deadline / completed / ปิดการเตือนล่วงหน้า

      const daysLeft = daysUntilDue(task.due_date!, now);
      const result = decideReminders({ daysLeft, ticked: reminderDays, sent: parseSent(row?.reminders_sent), isFirstSight: !row });
      const newState = result.sent.length > 0 ? UPCOMING_WITHIN_WINDOW : 'upcoming';
      const newSent = result.sent.join(',');

      if (result.notify) {
        pending.push({ task_id: task.id, title: task.title, state: newState, due_date: task.due_date!, daysLeft, reminders_sent: newSent });
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

// รวมเป็นข้อความเดียว คืน shown = งานที่อยู่ในข้อความจริง (ต้องจด log เฉพาะพวกนี้)
// งานใน "ใกล้ถึงกำหนด" ต่อท้ายจำนวนวันจริง เช่น "• Lab 3 (อีก 2 วัน)"
export function buildDigest(pending: Pending[]): { text: string; shown: Pending[] } {
  const shown = pending.slice(0, MAX_PER_PUSH);

  const blocks = ['StudyFlow แจ้งเตือน'];
  for (const group of GROUPS) {
    const items = shown.filter((p) => p.state === group.state);
    if (items.length === 0) continue;
    const lines = items.map((p) => {
      const title = p.title.replace(/\s+/g, ' ').trim(); // ชื่อมีขึ้นบรรทัดใหม่ก็ให้เป็นบรรทัดเดียว
      const text = title.length > MAX_TITLE ? title.slice(0, MAX_TITLE) + '…' : title;
      return p.daysLeft === null ? `• ${text}` : `• ${text} (อีก ${p.daysLeft} วัน)`;
    });
    blocks.push([group.heading, ...lines].join('\n'));
  }

  const rest = pending.length - shown.length;
  if (rest > 0) blocks.push(`(ยังมีอีก ${rest} งาน จะแจ้งในรอบถัดไป)`);
  return { text: blocks.join('\n\n'), shown };
}
