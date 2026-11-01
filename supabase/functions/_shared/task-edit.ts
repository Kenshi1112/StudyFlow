// Owner: Backend
// หน้าที่: logic ล้วนของคำสั่ง "แก้งาน" ใน LINE ไม่แตะ DB/HTTP จึงเทสใน Node ได้ — สร้างรายการให้เลือกงาน, เมนูเลือกว่าจะแก้อะไร, ข้อความผลลัพธ์ และอ่าน postback
// อ้างอิง: PROJECT_v0.19 §14.8 (เปลี่ยนได้แค่ status กับ due date, ทุก input เป็นปุ่ม/ตัวเลือกวันเวลา ไม่แกะข้อความอิสระ §14.6), §9.1 (completed_at), §14.3 (เวลาไทย +07:00)
//
// ไม่เก็บ state ระหว่างข้อความ: ปุ่มแต่ละปุ่มพก id งานกับสิ่งที่จะทำไปเอง (postback data) รูปแบบ:
//   edit:pick:<id>                 เลือกงาน -> ขอเมนู
//   edit:status:<id>:<status>      ตั้งสถานะ (ปุ่ม "ย้อนกลับ" ก็เป็นแบบนี้ ใช้ status เดิม)
//   edit:due:<id>                  ปุ่ม Datetime Picker (วันเวลาที่เลือกมาใน params.datetime ไม่ใช่ใน data)
// data ยาวไม่เกิน 300 ตัวอักษรตามที่ LINE กำหนด (id แบบ UUID 36 ตัว + คำนำหน้า = ราวๆ 60)

import { cut, formatDue, groupOpenTasks } from './task-list.ts';
import type { OpenTask } from './task-list.ts';
import { textMessage } from './line-flow.ts';
import type { Message } from './line-flow.ts';

export const EDIT_PHRASE = 'แก้งาน';
export const EDIT_PREFIX = 'edit:';
export const MAX_PICK = 13; // Quick Reply ใส่ปุ่มได้ไม่เกิน 13 (§14.8)
const MAX_BUTTON_LABEL = 20; // ป้ายปุ่มยาวได้ไม่เกิน 20 ตัวอักษร
const MAX_TITLE = 100;
const MAX_COURSE = 40;

export type EditTask = OpenTask & { id: string };
export type EditStatus = 'not_started' | 'in_progress' | 'completed';
export type EditAction =
  | { kind: 'pick'; id: string }
  | { kind: 'status'; id: string; status: EditStatus }
  | { kind: 'due'; id: string };

export const EDIT_MESSAGES = {
  NO_TASKS: 'ไม่มีงานค้างให้แก้',
  NOT_FOUND: 'ไม่พบงานนี้ (อาจถูกลบหรือเปลี่ยนไปแล้ว)\nพิมพ์ "แก้งาน" เพื่อเลือกใหม่',
  DUE_INVALID: 'วันที่ไม่ถูกต้อง ลองเลือกใหม่อีกครั้ง',
};

export const STATUS_LABEL: Record<EditStatus, string> = {
  not_started: 'ยังไม่เริ่ม',
  in_progress: 'กำลังทำ',
  completed: 'เสร็จแล้ว',
};

const STATUSES = Object.keys(STATUS_LABEL) as EditStatus[];

// "แก้งาน" ตรงตัว (ตัดช่องว่างหัวท้ายได้) เหมือน "เพิ่มงาน" / "งานค้าง" นอกนั้นไม่ใช่
export function isEditTrigger(text?: string): boolean {
  return text?.trim() === EDIT_PHRASE;
}

// id ที่ยอมรับ: ตัวอักษร ตัวเลข - _ ยาว 1-64 (กัน data แปลกๆ จากการแก้ postback ก่อนเอาไปใส่ query)
// ตัวอย่าง: "edit:status:3f2a-01:completed" -> { kind:'status', id:'3f2a-01', status:'completed' } / "edit:status:x:deleted" -> null
export function parseEditPostback(data?: string): EditAction | null {
  if (!data || !data.startsWith(EDIT_PREFIX)) return null;
  const parts = data.slice(EDIT_PREFIX.length).split(':');
  const [kind, id, status] = parts;
  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  if (kind === 'pick' && parts.length === 2) return { kind, id };
  if (kind === 'due' && parts.length === 2) return { kind, id };
  if (kind === 'status' && parts.length === 3 && STATUSES.includes(status as EditStatus)) return { kind, id, status: status as EditStatus };
  return null;
}

const label = (text: string) => {
  const chars = Array.from(text);
  return chars.length > MAX_BUTTON_LABEL ? chars.slice(0, MAX_BUTTON_LABEL - 1).join('') + '…' : text;
};

const postbackButton = (text: string, data: string) => {
  const shown = label(text);
  return { type: 'action', action: { type: 'postback', label: shown, data, displayText: shown } };
};

const dueButton = (id: string) => ({
  type: 'action',
  action: { type: 'datetimepicker', label: 'เลื่อนวันส่ง', data: `${EDIT_PREFIX}due:${id}`, mode: 'datetime' },
});

const courseOf = (task: { course_name: string | null }, max: number) => (task.course_name?.trim() ? ` (${cut(task.course_name, max)})` : '');

// ขั้น 1: รายการงานที่ยังไม่เสร็จ เรียงเหมือน "งานค้าง" (เลยกำหนด > วันนี้ > ใกล้ถึง > ไม่มีกำหนด) เสนอปุ่มไม่เกิน 13
// ตัวอย่าง: มี 15 งาน -> ปุ่ม 13 งานแรก + บรรทัดท้าย "ยังมีอีก 2 งาน แก้ในแอปนะ" / ไม่มีงาน -> "ไม่มีงานค้างให้แก้"
export function buildPickList(tasks: EditTask[], now: Date = new Date()): Message {
  const ordered = groupOpenTasks(tasks, now).flatMap((group) => group.items);
  if (ordered.length === 0) return textMessage(EDIT_MESSAGES.NO_TASKS);

  const offered = ordered.slice(0, MAX_PICK);
  const lines = offered.map((task, i) => {
    const due = task.due_date ? ` — ${formatDue(task.due_date)}` : '';
    return `${i + 1}. ${cut(task.title, MAX_TITLE)}${courseOf(task, MAX_COURSE)}${due}`;
  });
  const hidden = ordered.length - offered.length;
  const tail = hidden > 0 ? `\n\n(ยังมีอีก ${hidden} งาน แก้ในแอปนะ)` : '';
  const buttons = offered.map((task, i) => postbackButton(`${i + 1}. ${task.title.replace(/\s+/g, ' ').trim()}`, `${EDIT_PREFIX}pick:${task.id}`));
  return textMessage(`เลือกงานที่จะแก้\n${lines.join('\n')}${tail}`, buttons);
}

// ขั้น 2: เมนูของงานที่เลือก ซ่อนสถานะที่เป็นอยู่แล้ว
export function buildActionMenu(task: EditTask): Message {
  const buttons: unknown[] = [];
  if (task.status !== 'completed') buttons.push(postbackButton(STATUS_LABEL.completed, `${EDIT_PREFIX}status:${task.id}:completed`));
  if (task.status !== 'in_progress') buttons.push(postbackButton(STATUS_LABEL.in_progress, `${EDIT_PREFIX}status:${task.id}:in_progress`));
  buttons.push(dueButton(task.id));
  const current = STATUS_LABEL[task.status as EditStatus] ?? task.status;
  return textMessage(`${cut(task.title, MAX_TITLE)}${courseOf(task, MAX_COURSE)}\nตอนนี้: ${current}\nจะทำอะไรกับงานนี้?`, buttons);
}

// ค่าที่ต้อง UPDATE เมื่อเปลี่ยนสถานะ (กฎเดียวกับ task.service.js §9.1): ไป completed -> completed_at = ตอนนี้ (ถ้าเสร็จอยู่แล้วคงค่าเดิม ไม่ใส่ key)
// ไปสถานะอื่น -> ล้าง completed_at / ไม่แตะ progress_percentage และ first_started_at (first_started_at มาจากปุ่ม Start Working เท่านั้น §10.3)
// ตัวอย่าง: not_started -> completed => { status, completed_at: now } / completed -> in_progress => { status, completed_at: null }
export function statusPatch(prev: string, next: EditStatus, now: Date = new Date()): { status: EditStatus; completed_at?: string | null } {
  if (next === 'completed') return prev === 'completed' ? { status: next } : { status: next, completed_at: now.toISOString() };
  return { status: next, completed_at: null };
}

// ข้อความหลังเปลี่ยนสถานะ + ปุ่ม "ย้อนกลับ" กลับไปสถานะก่อนหน้า (ไม่มีปุ่มถ้าสถานะไม่เปลี่ยน)
export function buildStatusDone(task: EditTask, next: EditStatus): Message {
  const name = cut(task.title, MAX_TITLE);
  if (task.status === next) return textMessage(`งานนี้เป็น "${STATUS_LABEL[next]}" อยู่แล้ว\n${name}`);
  const undo = postbackButton('ย้อนกลับ', `${EDIT_PREFIX}status:${task.id}:${task.status}`);
  const canUndo = STATUSES.includes(task.status as EditStatus);
  return textMessage(`ตั้งเป็น "${STATUS_LABEL[next]}" แล้ว\n${name}`, canUndo ? [undo] : undefined);
}

// ข้อความหลังเลื่อนวันส่ง due = ค่าที่ toDueDate คืน ("2026-11-05T14:00:00+07:00") แสดงเป็น "2026-11-05 14:00" เหมือนตอนเพิ่มงาน
export function buildDueDone(task: EditTask, due: string): Message {
  return textMessage(`เลื่อนวันส่งแล้ว\nงาน: ${cut(task.title, MAX_TITLE)}\nส่ง: ${due.slice(0, 16).replace('T', ' ')}`);
}
