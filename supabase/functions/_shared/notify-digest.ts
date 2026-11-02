// หน้าที่: เลือกงานที่ต้องใส่ในข้อความสรุป LINE ประจำวัน แล้วรวมเป็นข้อความเดียวต่อคน
// อ้างอิง: PROJECT_v0.20 §14.4 (สรุปวันละครั้ง 08:00 เวลาไทย ไม่จดอะไรว่าแจ้งแล้ว), §11.1 (3 กฎ), §11.4 (Upcoming เป็นช่วง), §19.4

import { computeDeadlineState } from './deadline-state.ts';
import type { Task } from './deadline-state.ts';
import { daysUntilDue, isInReminderWindow } from './reminders.ts';

// 1 ข้อความไม่เกิน 30 งาน (v0.19 ขึ้นจาก 10 เพราะ Overdue / Due Today ซ้ำทุกวัน ถ้าตัดงานเดิมทิ้งทุกวัน งานท้าย ๆ จะไม่ถูกเตือนเลย)
// LINE รับข้อความได้ 5000 ตัวอักษร: 30 งาน x (ชื่อ <= 100 + ส่วนเกิน ~15) = ~3500 ยังเหลือที่ให้หัวข้อ
export const MAX_PER_PUSH = 30;
const MAX_TITLE = 100; // กันชื่อยาวจน push เกิน 5000 ตัวอักษรของ LINE แล้วพังซ้ำทุกรอบ

// กลุ่มในข้อความ เรียงตามลำดับ: เลยกำหนด -> วันนี้ -> ใกล้ถึง (เรียงตามความเร่งด่วน)
// เกินเพดาน MAX_PER_PUSH จะตัดจากท้าย = ตัด Upcoming ก่อน ซึ่งไม่เสียหาย เพราะไม่มีอะไรจดว่าแจ้งแล้ว วันถัดไปงานที่ถูกตัดจะได้อีก (v0.20)
const GROUPS = [
  { state: 'overdue', heading: 'เลยกำหนดแล้ว' },
  { state: 'due_today', heading: 'ถึงกำหนดวันนี้' },
  { state: 'upcoming', heading: 'ใกล้ถึงกำหนด' },
];

export type TaskRow = Task & { id: string; title: string };
// งานที่จะอยู่ในข้อความ
//   state        กลุ่มในข้อความ (overdue / due_today / upcoming)
//   daysLeft     ใช้เฉพาะ Upcoming (บอก "อีก N วัน") กลุ่มอื่นเป็น null
export type Pending = {
  task_id: string;
  title: string;
  state: string;
  due_date: string;
  daysLeft: number | null;
};

// เลือกงานที่จะอยู่ในข้อความสรุป (v0.20: ไม่อ่าน/ไม่เขียน line_notification_log เลย ทุกกลุ่มขึ้นทุกวันตราบที่เงื่อนไขยังจริง)
//   Overdue / Due Today: ใส่ทุกครั้งที่รัน จนกว่างานจะเสร็จ / ถูกลบ / ย้าย due ออกไป
//   Upcoming: ใส่เมื่ออยู่ในช่วงเตือนของผู้ใช้ (เหลืออีกไม่เกิน reminderDays วัน) null = ปิดการเตือนล่วงหน้า -> ข้ามทั้งกลุ่ม
//   งาน Completed ไม่ถูกใส่เลย (computeDeadlineState คืน completed)
// ตัวอย่าง: reminderDays = 3, งาน due อีก 5 วัน -> ไม่ใส่ / due อีก 2 วัน -> ใส่ (อีก 2 วัน) ทุกเช้าจนถึงวัน due
// เรียงตามกลุ่มก่อน แล้วงานที่ due เร็วสุดก่อน (Upcoming = เหลือวันน้อยสุดก่อน เกินเพดานจะได้ตัดงานที่ไม่รีบทิ้งท้าย)
export function pickPending(tasks: TaskRow[], reminderDays: number | null, now: Date): Pending[] {
  const pending: Pending[] = [];
  for (const task of tasks) {
    try {
      const state = computeDeadlineState(task, now);

      if (state === 'due_today' || state === 'overdue') {
        pending.push({ task_id: task.id, title: task.title, state, due_date: task.due_date!, daysLeft: null });
        continue;
      }
      if (state !== 'upcoming' || reminderDays === null) continue; // no_deadline / completed / ปิดการเตือนล่วงหน้า

      const daysLeft = daysUntilDue(task.due_date!, now);
      if (isInReminderWindow(daysLeft, reminderDays)) {
        pending.push({ task_id: task.id, title: task.title, state: 'upcoming', due_date: task.due_date!, daysLeft });
      }
    } catch (error) {
      // task เดียวที่ข้อมูลเพี้ยนต้องไม่ทำให้ task อื่นไม่ถูกเช็ค (เหมือนฝั่ง desktop)
      console.error(`notify-check: ข้าม task ${task.id}: ${(error as Error).message}`);
    }
  }
  const rank = (p: Pending) => GROUPS.findIndex((group) => group.state === p.state);
  pending.sort((a, b) => rank(a) - rank(b) || new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  return pending;
}

// รวมเป็นข้อความเดียว คืน shown = งานที่อยู่ในข้อความจริง (เหลือไว้ให้ notify-check นับจำนวน ไม่ต้องจดอะไร)
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
