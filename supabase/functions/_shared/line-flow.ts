// Owner: Backend
// หน้าที่: logic ล้วนของ line-webhook ไม่แตะ DB/HTTP จึงเทสใน Node ได้ — ตรวจรหัสผูกบัญชี และ state machine สร้างงาน (ข้อ 8.3, 8.4)
// อ้างอิง: PROJECT_v0.15 section 14.2, 14.3 (ถามทีละขั้น course -> title -> due date ห้ามแกะข้อความอิสระ §14.6)

export const FLOW_TIMEOUT_MS = 10 * 60 * 1000; // flow ที่เงียบเกิน 10 นาทีถือว่าค้าง (§14.3)
export const TRIGGER_PHRASE = 'เพิ่มงาน';
export const DATE_POSTBACK_DATA = 'due_date'; // data ที่ปุ่ม Datetime Picker ส่งกลับมา ใช้แยกจาก postback อื่น
export const BANGKOK_OFFSET = '+07:00'; // D5: เวลาที่เลือกใน LINE ไม่มี timezone ตีเป็นเวลาไทยเสมอ

const MAX_QUICK_REPLIES = 13; // LINE ใส่ปุ่ม Quick Reply ได้ไม่เกิน 13
const MAX_LABEL_LENGTH = 20; // ป้ายบนปุ่มยาวได้ไม่เกิน 20 ตัวอักษร

export type Step = 'waiting_course' | 'waiting_title' | 'waiting_date';
export type PartialTask = { course_name?: string; title?: string };
export type SavedState = { current_step: Step; partial_task_data: PartialTask; updated_at: string };
export type Input = { text?: string; datetime?: string }; // ข้อความ หรือค่าจาก Datetime Picker ("2026-11-05T14:00")
export type Message = { type: 'text'; text: string; quickReply?: { items: unknown[] } };
export type NewTask = { course_name: string; title: string; due_date: string };
export type Result = {
  state: { current_step: Step; partial_task_data: PartialTask } | null; // null = ไม่มี flow ค้างแล้ว (ลบแถวทิ้ง)
  task?: NewTask; // มีค่าเมื่อครบ 3 ช่อง ให้ผู้เรียก insert
  reply: Message[];
};

// ข้อความตอบกลับ (§26: ถ้อยคำปล่อยให้ตอน implement)
export const MESSAGES = {
  NOT_LINKED: 'ยังไม่ได้เชื่อมบัญชี StudyFlow\nเปิดแอป > Settings > Connect LINE แล้วส่งรหัส 6 หลักมาที่นี่',
  LINKED: 'เชื่อมบัญชีเรียบร้อยแล้ว\nพิมพ์ "เพิ่มงาน" เพื่อเพิ่มงานใหม่ หรือ "งานค้าง" เพื่อดูงานที่ยังไม่เสร็จ',
  CODE_INVALID: 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว (ใช้ได้ 10 นาที)\nกด Connect LINE ในแอปเพื่อขอรหัสใหม่',
  LINE_TAKEN: 'LINE นี้ผูกกับบัญชี StudyFlow อื่นอยู่แล้ว\nต้องกด Disconnect ที่บัญชีนั้นก่อน',
  HELP: 'พิมพ์ "เพิ่มงาน" เพื่อเพิ่มงานใหม่\nพิมพ์ "งานค้าง" เพื่อดูงานที่ยังไม่เสร็จ',
  ASK_COURSE: 'วิชาอะไร?\nกดเลือกจากปุ่ม หรือพิมพ์ชื่อวิชาเองก็ได้',
  ASK_COURSE_NO_HISTORY: 'วิชาอะไร?\nพิมพ์ชื่อวิชาได้เลย',
  ASK_TITLE: 'ชื่องานคืออะไร?',
  ASK_DATE: 'กำหนดส่งเมื่อไหร่?\nกดปุ่ม "เลือกวัน-เวลา" ด้านล่าง',
  ASK_DATE_AGAIN: 'กรุณากดปุ่ม "เลือกวัน-เวลา" ด้านล่างเพื่อเลือกกำหนดส่ง',
  ASK_TEXT: 'ตอบเป็นข้อความนะ',
  SAVE_ERROR: 'บันทึกงานไม่สำเร็จ ลองกดเลือกวัน-เวลาอีกครั้ง',
  ERROR: 'ระบบขัดข้องชั่วคราว ลองส่งใหม่อีกครั้ง',
};

// ผลของ line_link_account (ฟังก์ชัน SQL) -> ข้อความตอบ
export const LINK_REPLIES: Record<string, string> = {
  linked: MESSAGES.LINKED,
  invalid: MESSAGES.CODE_INVALID,
  taken: MESSAGES.LINE_TAKEN,
};

export const textMessage = (text: string, quickReplyItems?: unknown[]): Message =>
  quickReplyItems ? { type: 'text', text, quickReply: { items: quickReplyItems } } : { type: 'text', text };

// รหัสผูกบัญชี = เลข 6 หลักล้วน (ตัดช่องว่างหัวท้าย) นอกนั้นคืน null
export function parseLinkCode(text?: string): string | null {
  const trimmed = text?.trim();
  return trimmed && /^\d{6}$/.test(trimmed) ? trimmed : null;
}

export function isTrigger(text?: string): boolean {
  return text?.trim() === TRIGGER_PHRASE;
}

// ปุ่มวิชา: ตัดชื่อซ้ำ (เรียงตามที่ผู้เรียกส่งมา = ใช้ล่าสุดก่อน) เอาไม่เกิน 13
// ตัวอย่าง: ['OS','OS','DB'] -> 2 ปุ่ม / ชื่อยาว 25 ตัวอักษร -> ป้ายปุ่ม 19 ตัว + "…" = 20 แต่ข้อความที่ส่งเมื่อกดยังเป็นชื่อเต็ม
function courseButtons(courses: string[]): unknown[] {
  const unique = Array.from(new Set(courses.map((name) => name.trim()).filter(Boolean))).slice(0, MAX_QUICK_REPLIES);
  return unique.map((name) => {
    const chars = Array.from(name);
    const label = chars.length > MAX_LABEL_LENGTH ? chars.slice(0, MAX_LABEL_LENGTH - 1).join('') + '…' : name;
    return { type: 'action', action: { type: 'message', label, text: name.slice(0, 300) } };
  });
}

const datePickerButton = () => ({
  type: 'action',
  action: { type: 'datetimepicker', label: 'เลือกวัน-เวลา', data: DATE_POSTBACK_DATA, mode: 'datetime' },
});

// Datetime Picker ส่งมาเป็น "2026-11-05T14:00" (ไม่มี timezone) -> "2026-11-05T14:00:00+07:00"
// ตัวอย่าง: "2026-11-05T00:30" -> 00:30 น. ไทย = 17:30 UTC ของวันที่ 4 (ถ้าไม่ใส่ +07:00 จะเลื่อนผิดวัน)
function toDueDate(datetime?: string): string | null {
  if (!datetime || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(datetime)) return null;
  const iso = `${datetime}:00${BANGKOK_OFFSET}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

// flow ที่เงียบเกิน 10 นาทีถือว่าไม่มี (§14.3) ตัวอย่าง: updated_at 10:00:00, now 10:10:00 ยังใช้ได้ / 10:10:01 ค้างแล้ว
// updated_at อ่านไม่ออก (NaN) ก็ถือว่าค้าง
function activeState(saved: SavedState | null, now: Date): SavedState | null {
  if (!saved) return null;
  const age = now.getTime() - new Date(saved.updated_at).getTime();
  return age <= FLOW_TIMEOUT_MS ? saved : null;
}

// หัวใจของข้อ 8.4: รับ state ที่เก็บไว้ + ข้อความใหม่ -> คืน state ถัดไป + ข้อความตอบ + (ถ้าครบ) task ที่ต้อง insert
// courses = course_name ของ task ผู้ใช้ เรียงล่าสุดก่อน (ใช้เฉพาะตอนเริ่ม flow) / now ส่งเองได้เพื่อทดสอบ
export function nextStep(saved: SavedState | null, input: Input, courses: string[], now: Date = new Date()): Result {
  const text = input.text?.trim();

  // "เพิ่มงาน" = เริ่ม flow ใหม่เสมอ ทับ flow ที่ค้างอยู่ด้วย (D4)
  if (text === TRIGGER_PHRASE) {
    const buttons = courseButtons(courses);
    const ask = buttons.length > 0 ? textMessage(MESSAGES.ASK_COURSE, buttons) : textMessage(MESSAGES.ASK_COURSE_NO_HISTORY);
    return { state: { current_step: 'waiting_course', partial_task_data: {} }, reply: [ask] };
  }

  // ไม่มี flow (หรือค้างเกิน 10 นาที) และไม่ใช่คำสั่งเริ่ม = ไม่ resume ของเก่า บอกวิธีใช้
  const state = activeState(saved, now);
  if (!state) return { state: null, reply: [textMessage(MESSAGES.HELP)] };

  const partial = state.partial_task_data ?? {};
  // ตอบผิดรูปแบบ (เช่น ส่งสติกเกอร์): อยู่ขั้นเดิม ถามซ้ำ
  const stay = (message: Message): Result => ({
    state: { current_step: state.current_step, partial_task_data: partial },
    reply: [message],
  });

  if (state.current_step === 'waiting_course') {
    if (!text) return stay(textMessage(MESSAGES.ASK_TEXT));
    // ปุ่มวิชากับพิมพ์เอง ได้ข้อความเหมือนกัน ไม่ต้องแยก (free-text fallback)
    return { state: { current_step: 'waiting_title', partial_task_data: { course_name: text } }, reply: [textMessage(MESSAGES.ASK_TITLE)] };
  }

  if (state.current_step === 'waiting_title') {
    if (!text) return stay(textMessage(MESSAGES.ASK_TEXT));
    return {
      state: { current_step: 'waiting_date', partial_task_data: { ...partial, title: text } },
      reply: [textMessage(MESSAGES.ASK_DATE, [datePickerButton()])],
    };
  }

  // waiting_date: รับเฉพาะค่าจาก Datetime Picker ข้อความพิมพ์เอง = ส่งปุ่มให้กดใหม่ (ไม่แกะวันที่จากข้อความ §14.6)
  if (state.current_step === 'waiting_date') {
    if (!partial.course_name || !partial.title) return { state: null, reply: [textMessage(MESSAGES.HELP)] }; // ข้อมูลค้างเพี้ยน เริ่มใหม่
    const dueDate = toDueDate(input.datetime);
    if (!dueDate) return stay(textMessage(MESSAGES.ASK_DATE_AGAIN, [datePickerButton()]));

    const task = { course_name: partial.course_name, title: partial.title, due_date: dueDate };
    const shownDue = dueDate.slice(0, 16).replace('T', ' '); // "2026-11-05 14:00"
    return {
      state: null,
      task,
      reply: [textMessage(`เพิ่มงานแล้ว\nวิชา: ${task.course_name}\nงาน: ${task.title}\nส่ง: ${shownDue}`)],
    };
  }

  return { state: null, reply: [textMessage(MESSAGES.HELP)] }; // current_step แปลก ๆ
}
