// Owner: Backend
// หน้าที่: logic ล้วนของคำสั่ง "งานค้าง" ใน LINE ไม่แตะ DB/HTTP จึงเทสใน Node ได้ — จัดกลุ่มงานที่ยังไม่เสร็จแล้วประกอบเป็นข้อความเดียว
// อ้างอิง: PROJECT_v0.17 §14.7 (อ่านอย่างเดียว, ตรงตัวเหมือน "เพิ่มงาน", สูงสุด 15 งาน), §9.2 (Deadline State)

import { computeDeadlineState } from './deadline-state.ts';
import type { Task } from './deadline-state.ts';
import { textMessage } from './line-flow.ts';
import type { Message } from './line-flow.ts';

export const OPEN_TASKS_PHRASE = 'งานค้าง';
export const MAX_LISTED = 15; // ข้อความเดียวแสดงไม่เกิน 15 งาน ที่เหลือบอกเป็นจำนวน (ตัวอย่าง: ค้าง 18 งาน -> แสดง 15 + "ยังมีอีก 3 งาน")
const MAX_TITLE = 100;        // ตัดชื่อ/วิชาที่ยาวผิดปกติ กันข้อความเกิน 5000 ตัวอักษรของ LINE
const MAX_COURSE = 40;

export type OpenTask = Task & { title: string; course_name: string | null };

export const NO_OPEN_TASKS = 'ไม่มีงานค้างตอนนี้';

// ลำดับกลุ่มในข้อความ: เร่งด่วนสุดก่อน (ต่างจาก notify-check ที่เรียงตามลำดับแจ้งเตือน)
const GROUPS = [
  { state: 'overdue', heading: 'เลยกำหนดแล้ว' },
  { state: 'due_today', heading: 'ถึงกำหนดวันนี้' },
  { state: 'upcoming', heading: 'ใกล้ถึงกำหนด' },
  { state: 'no_deadline', heading: 'ไม่มีกำหนดส่ง' },
];

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// "งานค้าง" ตรงตัว (ตัดช่องว่างหัวท้ายได้) เหมือน isTrigger ของ "เพิ่มงาน" นอกนั้นไม่ใช่
export function isOpenTasksTrigger(text?: string): boolean {
  return text?.trim() === OPEN_TASKS_PHRASE;
}

// แสดงวัน-เวลาตามเวลาไทย (+07:00) เสมอ เพราะ Edge Function รันเป็น UTC
// ตัวอย่าง: due = 2026-11-05T07:00:00Z (= 14:00 ไทย) -> "5 พ.ย. 14:00" / 2026-10-29T16:59:00Z (= 23:59 ไทย) -> "29 ต.ค. 23:59"
function formatDue(dueDate: string): string {
  const thai = new Date(new Date(dueDate).getTime() + 7 * 60 * 60 * 1000); // เลื่อน +7 ชม. แล้วอ่านด้วย getUTC* = เวลาไทย
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${thai.getUTCDate()} ${MONTHS[thai.getUTCMonth()]} ${pad(thai.getUTCHours())}:${pad(thai.getUTCMinutes())}`;
}

const cut = (text: string, max: number) => {
  const oneLine = text.replace(/\s+/g, ' ').trim(); // ขึ้นบรรทัดใหม่ในชื่อ -> ให้เป็นบรรทัดเดียว
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
};

// tasks = งานที่ยังไม่ถูกลบของผู้ใช้ (completed หลุดมาก็ข้าม) / now ส่งเองได้เพื่อทดสอบ
// เรียงในกลุ่มตาม due เร็วสุดก่อน, no_deadline คงลำดับที่รับมา (ผู้เรียกส่งล่าสุดก่อน), ถ้าเกิน 15 ตัดจากท้ายสุด = งานเร่งด่วนไม่หาย
export function buildOpenTaskList(tasks: OpenTask[], now: Date = new Date()): Message {
  const groups = GROUPS.map((group) => ({ ...group, items: [] as OpenTask[] }));
  for (const task of tasks) {
    try {
      const state = computeDeadlineState(task, now);
      groups.find((group) => group.state === state)?.items.push(task); // 'completed' ไม่มีกลุ่ม = ข้าม
    } catch (error) {
      // งานเดียวที่ข้อมูลเพี้ยนต้องไม่ทำให้ทั้งรายการล่ม (เหมือน notify-digest)
      console.error(`task-list: ข้ามงาน "${task.title}": ${(error as Error).message}`);
    }
  }

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  if (total === 0) return textMessage(NO_OPEN_TASKS);

  let room = MAX_LISTED; // ที่ว่างเหลือในข้อความ
  const blocks = [`งานที่ยังไม่เสร็จ (${total})`];
  for (const group of groups) {
    if (group.state !== 'no_deadline') group.items.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
    const shown = group.items.slice(0, room);
    room -= shown.length;
    if (shown.length === 0) continue;
    const lines = shown.map((task) => {
      const course = task.course_name?.trim() ? ` (${cut(task.course_name, MAX_COURSE)})` : '';
      const due = task.due_date ? ` — ${formatDue(task.due_date)}` : '';
      return `• ${cut(task.title, MAX_TITLE)}${course}${due}`;
    });
    blocks.push([group.heading, ...lines].join('\n'));
  }

  const hidden = total - Math.min(total, MAX_LISTED);
  if (hidden > 0) blocks.push(`(ยังมีอีก ${hidden} งาน เปิดแอปดูต่อ)`);
  return textMessage(blocks.join('\n\n'));
}
