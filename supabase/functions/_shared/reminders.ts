// Owner: Backend
// หน้าที่: กฎ Upcoming reminder เป็น "ช่วง" 7/3/2/1 วันก่อน due ฝั่ง Edge Function (§11.4 v0.20) เขียนซ้ำจาก notification.service.js ฝั่ง desktop
//   (daysUntilDue / isInReminderWindow) ให้ผลตรงกัน (§17.2, §20 duplicated logic)
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

// งานที่เป็น Upcoming อยู่ในช่วงเตือนไหม (§11.4): เหลืออีกไม่เกิน N วัน ตรรกะเดียวกับ isInReminderWindow ฝั่ง desktop เป๊ะ
// ตัวอย่าง: due 10 พ.ย., N = 3 -> 6 พ.ย. เหลือ 4 = ไม่ใช่ / 7 พ.ย. เหลือ 3 = ใช่ / 9 พ.ย. เหลือ 1 = ใช่
export function isInReminderWindow(daysLeft: number, windowDays: number): boolean {
  return daysLeft <= windowDays;
}

// reminder_days จาก DB (§19.4 v0.20): เลข 7/3/2/1 หรือ null = ผู้ใช้ปิดการเตือนล่วงหน้า (ต้องคืน null ตามเดิม ห้ามกลายเป็น 1)
// ค่าอื่นที่ไม่ใช่ 4 ค่านี้ (เช่นลิสต์เก่าก่อนรัน migration, undefined) -> 1 = default
export function sanitizeDays(value: unknown): number | null {
  if (value === null) return null;
  return REMINDER_CHOICES.includes(value as number) ? (value as number) : 1;
}
