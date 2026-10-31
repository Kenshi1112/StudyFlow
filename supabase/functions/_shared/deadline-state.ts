// Owner: Backend
// หน้าที่: Deadline State ฝั่ง Edge Function (ข้อ 8.6) เขียนซ้ำจาก computeDeadlineState (task.service.js)
//   และ getNotificationState (notification.service.js) ให้ผลตรงกัน (§9.2, §11.3, §20 duplicated logic)
// ถ้าแก้กฎฝั่ง Electron ต้องมาแก้ที่นี่ด้วย แล้วรัน tests/deadline-parity.test.mjs
// ต่างจากฝั่ง Electron จุดเดียว: "วันนี้" นับตามเวลาไทย (+07:00) คงที่ เพราะ Edge Function รันเป็น UTC
//   ไม่มีเวลาเครื่องของผู้ใช้ให้อ่าน (เหมือน D5 ใน line-flow.ts)

export type Task = { status: string; due_date: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // ไทยไม่มี DST

// state ที่ 6 ที่ใช้เฉพาะแจ้งเตือน (§11.3) ชื่อเดียวกับ log
export const UPCOMING_WITHIN_WINDOW = 'upcoming_within_window';

// เที่ยงคืนไทยของวันที่ now อยู่ (หน่วย ms)
// ตัวอย่าง: now = 31 ต.ค. 18:00 ไทย (= 11:00 UTC)   -> 31 ต.ค. 00:00 ไทย (= 30 ต.ค. 17:00 UTC)
//          now = 31 ต.ค. 03:00 ไทย (= 30 ต.ค. 20:00 UTC) -> 31 ต.ค. 00:00 ไทยเหมือนกัน (ถ้านับตาม UTC จะผิดเป็นวันที่ 30)
function startOfBangkokDay(now: Date): number {
  return Math.floor((now.getTime() + BANGKOK_OFFSET_MS) / DAY_MS) * DAY_MS - BANGKOK_OFFSET_MS;
}

// ตาราง §9.2 เช็คตามลำดับ ข้อบนชนะข้อล่าง (เหมือน task.service.js)
// ตัวอย่าง (ตอนนี้ = 31 ต.ค. 15:00): due 30 ต.ค. -> overdue / due 31 ต.ค. 09:00 -> due_today / due 1 พ.ย. -> upcoming
export function computeDeadlineState(task: Task, now: Date = new Date()): string {
  if (!task.due_date) return 'no_deadline';
  if (task.status === 'completed') return 'completed';

  const due = new Date(task.due_date).getTime();
  if (Number.isNaN(due)) throw new Error(`Invalid due_date: ${task.due_date}`);

  const startOfToday = startOfBangkokDay(now);
  if (due < startOfToday) return 'overdue';
  if (due < startOfToday + DAY_MS) return 'due_today';
  return 'upcoming';
}

// state สำหรับแจ้งเตือน = deadline state แต่แยก upcoming เป็น "อยู่ในหน้าต่าง" กับ "ยังไกล" (§11.3)
// หน้าต่างนับตามวันในปฏิทิน: due ก่อน 00:00 ของ (วันนี้ + windowDays + 1)
// ตัวอย่าง: ตอนนี้ 31 ต.ค. 15:00, windowDays = 1 -> หน้าต่างจบก่อน 2 พ.ย. 00:00
//   due 1 พ.ย. 23:59 -> upcoming_within_window / due 2 พ.ย. 09:00 -> upcoming
export function getNotificationState(task: Task, windowDays: number, now: Date = new Date()): string {
  const state = computeDeadlineState(task, now);
  if (state !== 'upcoming') return state;

  const windowEnd = startOfBangkokDay(now) + (windowDays + 1) * DAY_MS;
  return new Date(task.due_date!).getTime() < windowEnd ? UPCOMING_WITHIN_WINDOW : 'upcoming';
}
