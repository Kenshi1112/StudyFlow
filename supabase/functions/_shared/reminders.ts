// Owner: Backend
// หน้าที่: กฎ Upcoming reminder ล่วงหน้า 7/3/2/1 วัน ฝั่ง Edge Function (§11.4) เขียนซ้ำจาก notification.service.js ฝั่ง desktop
//   (decideReminders / daysUntilDue / parseSent) ให้ผลตรงกัน (§17.2, §20 duplicated logic)
// ถ้าแก้กฎฝั่ง Electron ต้องมาแก้ที่นี่ด้วย แล้วรัน tests/reminders-parity.test.mjs
// ต่างจากฝั่ง Electron จุดเดียว: "วันนี้" นับตามเวลาไทย (+07:00) คงที่ เพราะ Edge Function รันเป็น UTC (เหมือน deadline-state.ts)

export const REMINDER_CHOICES = [7, 3, 2, 1];

const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // ไทยไม่มี DST

// เลขวันตามปฏิทินไทยของเวลา date (วันที่ 1 ม.ค. 1970 ไทย = 0) ใช้ลบกันเพื่อนับจำนวนวัน
// ตัวอย่าง: 31 ต.ค. 03:00 ไทย (= 30 ต.ค. 20:00 UTC) กับ 31 ต.ค. 18:00 ไทย ได้เลขวันเดียวกัน
function bangkokDayNumber(date: Date): number {
  return Math.floor((date.getTime() + BANGKOK_OFFSET_MS) / DAY_MS);
}

// เหลืออีกกี่วันตามปฏิทินจนถึงวันที่ของ due_date (ไม่ดูเวลา)
// ตัวอย่าง: now = 7 พ.ย. 15:00 ไทย -> due 10 พ.ย. 23:59 = 3 / due 8 พ.ย. 00:00 = 1 / due 7 พ.ย. 23:00 = 0
export function daysUntilDue(dueDate: string, now: Date): number {
  return bangkokDayNumber(new Date(dueDate)) - bangkokDayNumber(now);
}

// reminders_sent เป็นข้อความ '7,3' <-> array [7, 3]
export const parseSent = (text: string | null | undefined): number[] => (text ? text.split(',').map(Number) : []);

// reminder_days จาก DB ต้องเป็น array ของ 7/3/2/1 ไม่งั้นใช้ default [1] (แถวเก่าก่อนมีคอลัมน์ได้ default {1} อยู่แล้ว)
// [] = ผู้ใช้ปิดการเตือนล่วงหน้า ต้องคืน [] ตามเดิม ห้ามกลายเป็น [1]
export function sanitizeDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [1];
  return value.filter((n) => REMINDER_CHOICES.includes(n));
}

export type ReminderInput = { daysLeft: number; ticked: number[]; sent: number[]; isFirstSight: boolean };

// ตัดสิน Upcoming reminder ของ task 1 ตัว (§11.4) ฟังก์ชันล้วน ตรรกะเดียวกับ decideReminders ฝั่ง desktop เป๊ะ
// ตัวอย่าง (ติ๊ก 7, 3, 1):
//   เจอครั้งแรก daysLeft 5, sent []      -> { sent: [7],    notify: false }  7 ถึงแล้ว จดเงียบ ๆ
//   ต่อมา daysLeft 3,       sent [7]     -> { sent: [7, 3], notify: true }   3 ถึงแล้ว เด้ง
//   ค้างหลายค่า daysLeft 2, sent []      -> { sent: [7, 3], notify: true }   เด้งอันเดียว "อีก 2 วัน" จดทั้งคู่
//   ย้าย due ไป daysLeft 10, sent [7, 3] -> { sent: [],     notify: false }  ลบทิ้ง เตือนใหม่ได้
export function decideReminders(input: ReminderInput): { sent: number[]; notify: boolean } {
  const kept = input.sent.filter((n) => input.daysLeft <= n);
  const newlyReached = input.ticked.filter((n) => input.daysLeft <= n && !kept.includes(n));
  return {
    sent: [...kept, ...newlyReached].sort((a, b) => b - a),
    notify: !input.isFirstSight && newlyReached.length > 0,
  };
}
