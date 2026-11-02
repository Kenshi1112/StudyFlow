// Owner: Backend
// หน้าที่: อ่าน/เขียน table settings (key-value, local only) — ข้อ 5 (แจ้งเตือน) กับข้อ 6 (Classroom) เรียกใช้จาก main process ได้ตรง ๆ
// อ้างอิง: PROJECT_v0.20 section 11.1, 11.4, 13.1, 15.3, 19 และ docs/ipc-contract.md

'use strict';

const { getDb } = require('../db/database');

// cutoff date ต้องเป็นวัน+เวลา (กฎเดียวกับ due_date ใน task.service.js) ปฏิเสธ "2026-10-10" เพราะ JS ตีความเป็นเที่ยงคืน UTC
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// วัน+เวลา ISO 8601 หรือ null (ใช้กับ cutoff date และเวลา sync ล่าสุด)
const isIsoDateTimeOrNull = (value) =>
  value === null || (typeof value === 'string' && ISO_DATE_TIME.test(value) && !Number.isNaN(new Date(value).getTime()));

// ตัวเลือกวันเตือนล่วงหน้าตาม §11.4 (ตายตัว ไม่มีช่องกรอกเอง)
const REMINDER_CHOICES = [7, 3, 2, 1];

// วันที่ล้วน YYYY-MM-DD ที่เป็นวันจริง (ใช้กับ last_upcoming_round_on) ตัวอย่าง '2026-11-04' ผ่าน / '2026-02-30' ไม่ผ่าน
function isDateTextOrNull(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

// อ่าน reminder_days จาก DB (§19 v0.20): v0.16-v0.19 เก็บเป็นลิสต์ เช่น [7,3,1] -> อ่านเป็นค่ามากสุด = 7 (ไม่ต้อง migrate แค่อ่านแปลง)
// ลิสต์ว่าง / ค่าแปลก ๆ -> default 1 (Math.max ของลิสต์ว่างได้ -Infinity ซึ่งไม่อยู่ใน REMINDER_CHOICES)
function readReminderDays(stored) {
  const days = Array.isArray(stored) ? Math.max(...stored) : stored;
  return REMINDER_CHOICES.includes(days) ? days : 1;
}

// key ที่เก็บได้ทั้งหมด พร้อมค่า default และตัวเช็คค่า (ไม่อยู่ในนี้ = ห้ามเก็บ)
// read (ไม่บังคับ) = แปลงค่าที่อ่านจาก DB ก่อนคืน
const SETTINGS = {
  // §19: true เมื่อผู้ใช้ปิด/ผ่าน first-run prompt แล้ว จะได้ไม่เด้งซ้ำ
  has_seen_first_run_prompt: {
    default: false,
    isValid: (value) => typeof value === 'boolean',
  },
  // §13.1: import งาน Classroom ที่สร้างตั้งแต่วันนี้ขึ้นไป เช่น '2026-08-01T00:00:00.000Z' (null = ยังไม่ตั้ง)
  classroom_cutoff_date: {
    default: null,
    isValid: isIsoDateTimeOrNull,
  },
  // §13.1: เวลาที่ sync Classroom สำเร็จครั้งล่าสุด (service เขียนเอง Settings แค่โชว์) null = ยังไม่เคย sync
  classroom_last_synced_at: {
    default: null,
    isValid: isIsoDateTimeOrNull,
  },
  // §11.4 / §19 (v0.20): ความยาวช่วงเตือน Upcoming เลือกได้ "อันเดียว" จาก 7, 3, 2, 1 วัน (default 1) แทนลิสต์ของ v0.16
  // เช่น 3 = เตือนวันละครั้งตั้งแต่ก่อน due 3 วันจนถึงก่อนวัน due
  reminder_days: {
    default: 1,
    isValid: (value) => REMINDER_CHOICES.includes(value),
    read: readReminderDays,
  },
  // §11.4 / §19 (v0.20): วันที่ (ปฏิทินเครื่อง) ที่แจ้งรอบ Upcoming ล่าสุด เช่น '2026-11-04' (null = ยังไม่เคย/ถูกล้าง)
  // notification.service เขียนเอง หน้า Settings ไม่ต้องตั้ง ถูกล้างเมื่อเปลี่ยน reminder_days หรือเปิดสวิตช์ (ดู setSetting)
  last_upcoming_round_on: {
    default: null,
    isValid: isDateTextOrNull,
  },
  // §11.1, §19 (v0.16): เปิด/ปิด "Remind me about upcoming deadlines" แยกจาก reminder_days
  // ปิด = ไม่แจ้ง Upcoming แต่ค่าที่ติ๊กไว้ยังอยู่ (§11.4) ส่วน Due Today / Overdue ไม่เกี่ยว
  reminder_upcoming_enabled: {
    default: true,
    isValid: (value) => typeof value === 'boolean',
  },
  // §15.3: Pomodoro ใช้เวลาโฟกัสรอบละกี่นาที (default 25) อ่านตอนกด Start Working แต่ละ batch
  pomodoro_focus_minutes: {
    default: 25,
    isValid: (value) => Number.isInteger(value) && value >= 1,
  },
  // §15.3: พักรอบละกี่นาที (default 5)
  pomodoro_break_minutes: {
    default: 5,
    isValid: (value) => Number.isInteger(value) && value >= 1,
  },
};

// อ่านค่าทั้ง 8 key เริ่มจาก default แล้วเอาค่าใน DB มาทับ (key ที่ยังไม่เคยตั้ง = ค่า default)
// เช่น DB มีแค่ reminder_days = '3' -> ได้ reminder_days: 3 / ถ้าเป็นลิสต์เก่า '[7,3]' -> ได้ 7 ส่วน key อื่นเป็นค่า default
// (key เก่า reminder_window_days ที่ค้างอยู่ใน DB จะถูกข้าม เพราะไม่อยู่ใน SETTINGS)
function getSettings() {
  const result = {};
  for (const key of Object.keys(SETTINGS)) {
    result[key] = SETTINGS[key].default;
  }

  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  for (const row of rows) {
    if (Object.hasOwn(SETTINGS, row.key)) {
      const value = JSON.parse(row.value); // ใน DB เก็บเป็น JSON ('true', '3', 'null') เพื่อให้ได้ชนิดเดิมกลับมา
      result[row.key] = SETTINGS[row.key].read ? SETTINGS[row.key].read(value) : value;
    }
  }
  return result;
}

// ตั้งค่าทีละ key แล้วคืนค่าทั้งหมดหลังอัปเดต (ถ้า key ไม่รู้จักหรือค่าผิดชนิดจะ throw ไม่เขียนอะไรลง DB)
function setSetting(key, value) {
  if (!Object.hasOwn(SETTINGS, key)) {
    throw new Error(`Unknown setting: ${key}`);
  }
  if (!SETTINGS[key].isValid(value)) {
    throw new Error(`Invalid value for ${key}: ${JSON.stringify(value)}`);
  }

  const before = getSettings();

  // OR REPLACE = ไม่มี key นี้ให้เพิ่มแถวใหม่ มีแล้วให้ทับ
  const save = getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  save.run(key, JSON.stringify(value));

  // §11.4: เปลี่ยนตัวเลือกวัน หรือเปิดสวิตช์ Upcoming (ปิด -> เปิด) = ล้าง marker เพื่อให้เช็กรอบถัดไปแจ้งรอบ Upcoming ทันที ไม่รอพรุ่งนี้
  // กดตัวเลือกเดิมซ้ำ / ปิดสวิตช์ ไม่ล้าง ตัวอย่าง: ตอนนี้ 3 แล้วเลือก 7 -> ล้าง / เลือก 3 ซ้ำ -> ไม่ล้าง
  const choiceChanged = key === 'reminder_days' && before.reminder_days !== value;
  const switchedOn = key === 'reminder_upcoming_enabled' && value === true && before.reminder_upcoming_enabled === false;
  if (choiceChanged || switchedOn) save.run('last_upcoming_round_on', JSON.stringify(null));

  return getSettings();
}

module.exports = {
  REMINDER_CHOICES,
  getSettings,
  setSetting,
};
