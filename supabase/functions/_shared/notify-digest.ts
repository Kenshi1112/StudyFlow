// Owner: Backend
// หน้าที่: เลือก task ที่ต้องแจ้ง LINE (เหมือน loop ของ checkDeadlineStates ฝั่ง desktop) แล้วรวมเป็นข้อความเดียว (ข้อ 8.6)
// อ้างอิง: PROJECT_v0.15 §11.1 (3 กฎ), §11.3 (กันซ้ำด้วย state ล่าสุดที่แจ้ง), §14.4

import { UPCOMING_WITHIN_WINDOW, getNotificationState } from './deadline-state.ts';
import type { Task } from './deadline-state.ts';

export const MAX_PER_PUSH = 10; // D7: 1 ข้อความไม่เกิน 10 งาน ที่เหลือไปรอบถัดไป (ตัวอย่าง: ค้าง 12 งาน -> รอบนี้ 10 รอบหน้า 2)
const MAX_TITLE = 100;          // กันชื่อยาวจน push เกิน 5000 ตัวอักษรของ LINE แล้วพังซ้ำทุกรอบ

// state ที่ต้องแจ้ง 3 ตัว (§11.1) เรียงตามลำดับในข้อความ: วันนี้ก่อน แล้วใกล้ถึง แล้วเลยกำหนด
// state อื่น (no_deadline / completed / upcoming ไกล) ไม่อยู่ในนี้ = ไม่แจ้ง
const GROUPS = [
  { state: 'due_today', heading: 'ถึงกำหนดวันนี้' },
  { state: UPCOMING_WITHIN_WINDOW, heading: 'ใกล้ถึงกำหนด' },
  { state: 'overdue', heading: 'เลยกำหนดแล้ว' },
];

export type TaskRow = Task & { id: string; title: string };
export type Pending = { task_id: string; title: string; state: string; due_date: string };

// task ที่ state ปัจจุบันเป็น 1 ใน 3 ตัว และต่างจาก state ที่แจ้งไปล่าสุด (lastNotified: task_id -> state)
// ตัวอย่าง: log จด due_today ไว้ พอข้ามเที่ยงคืน state เป็น overdue -> ติดมาแจ้งอีก 1 ครั้ง
// เรียงตามกลุ่มก่อน แล้วงานที่ due เก่าสุดก่อน (เกินเพดานจะได้ตัดงานที่ไม่รีบทิ้งท้าย)
export function pickPending(
  tasks: TaskRow[],
  lastNotified: Map<string, string>,
  windowDays: number,
  now: Date,
): Pending[] {
  const pending: Pending[] = [];
  for (const task of tasks) {
    try {
      const state = getNotificationState(task, windowDays, now);
      if (!GROUPS.some((group) => group.state === state)) continue;
      if (lastNotified.get(task.id) === state) continue;
      pending.push({ task_id: task.id, title: task.title, state, due_date: task.due_date! });
    } catch (error) {
      // task เดียวที่ข้อมูลเพี้ยนต้องไม่ทำให้ task อื่นไม่ถูกเช็ค (เหมือนฝั่ง desktop)
      console.error(`notify-check: ข้าม task ${task.id}: ${(error as Error).message}`);
    }
  }
  const rank = (p: Pending) => GROUPS.findIndex((group) => group.state === p.state);
  return pending.sort((a, b) => rank(a) - rank(b) || new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
}

// รวมเป็นข้อความเดียว คืน shown = งานที่อยู่ในข้อความจริง (ต้องจด log เฉพาะพวกนี้)
export function buildDigest(pending: Pending[]): { text: string; shown: Pending[] } {
  const shown = pending.slice(0, MAX_PER_PUSH);

  const blocks = ['StudyFlow แจ้งเตือน'];
  for (const group of GROUPS) {
    const items = shown.filter((p) => p.state === group.state);
    if (items.length === 0) continue;
    const lines = items.map((p) => {
      const title = p.title.replace(/\s+/g, ' ').trim(); // ชื่อมีขึ้นบรรทัดใหม่ก็ให้เป็นบรรทัดเดียว
      return `• ${title.length > MAX_TITLE ? title.slice(0, MAX_TITLE) + '…' : title}`;
    });
    blocks.push([group.heading, ...lines].join('\n'));
  }

  const rest = pending.length - shown.length;
  if (rest > 0) blocks.push(`(ยังมีอีก ${rest} งาน จะแจ้งในรอบถัดไป)`);
  return { text: blocks.join('\n\n'), shown };
}
