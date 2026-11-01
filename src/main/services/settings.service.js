// Owner: Backend
// หน้าที่: อ่าน/เขียน table settings (key-value, local only) — ข้อ 5 (แจ้งเตือน) กับข้อ 6 (Classroom) เรียกใช้จาก main process ได้ตรง ๆ
// อ้างอิง: PROJECT_v0.16 section 11.1, 11.4, 13.1, 15.3, 19 และ docs/ipc-contract.md

'use strict';

const { getDb } = require('../db/database');

// cutoff date ต้องเป็นวัน+เวลา (กฎเดียวกับ due_date ใน task.service.js) ปฏิเสธ "2026-10-10" เพราะ JS ตีความเป็นเที่ยงคืน UTC
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// วัน+เวลา ISO 8601 หรือ null (ใช้กับ cutoff date และเวลา sync ล่าสุด)
const isIsoDateTimeOrNull = (value) =>
  value === null || (typeof value === 'string' && ISO_DATE_TIME.test(value) && !Number.isNaN(new Date(value).getTime()));

// ตัวเลือกวันเตือนล่วงหน้าตาม §11.4 (ตายตัว ไม่มีช่องกรอกเอง)
const REMINDER_CHOICES = [7, 3, 2, 1];

// key ที่เก็บได้ทั้งหมด พร้อมค่า default และตัวเช็คค่า (ไม่อยู่ในนี้ = ห้ามเก็บ)
// normalize (ไม่บังคับ) = จัดรูปค่าก่อนเก็บ
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
  // §11.4 / §19 (v0.16): ติ๊กเตือนล่วงหน้าได้หลายค่าจาก 7, 3, 2, 1 วัน เช่น [7, 3, 1] (default [1]) แทน reminder_window_days
  // ห้ามว่าง (ต้องติ๊กอย่างน้อย 1 ค่า) ส่งมาลำดับไหนก็ได้ แต่เก็บเรียงมากไปน้อยเสมอ
  reminder_days: {
    default: [1],
    isValid: (value) =>
      Array.isArray(value) &&
      value.length >= 1 &&
      value.every((day) => REMINDER_CHOICES.includes(day)) &&
      new Set(value).size === value.length,
    normalize: (value) => [...value].sort((a, b) => b - a), // [1, 7, 3] -> [7, 3, 1]
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

// อ่านค่าทั้ง 7 key เริ่มจาก default แล้วเอาค่าใน DB มาทับ (key ที่ยังไม่เคยตั้ง = ค่า default)
// เช่น DB มีแค่ reminder_days = '[7,3]' -> ได้ reminder_days: [7, 3] ส่วน key อื่นเป็นค่า default
// (key เก่า reminder_window_days ที่ค้างอยู่ใน DB จะถูกข้าม เพราะไม่อยู่ใน SETTINGS)
function getSettings() {
  const result = {};
  for (const key of Object.keys(SETTINGS)) {
    const fallback = SETTINGS[key].default;
    result[key] = Array.isArray(fallback) ? [...fallback] : fallback; // สำเนา กันคนข้างนอกแก้ array default
  }

  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  for (const row of rows) {
    if (Object.hasOwn(SETTINGS, row.key)) {
      result[row.key] = JSON.parse(row.value); // ใน DB เก็บเป็น JSON ('true', '3', 'null') เพื่อให้ได้ชนิดเดิมกลับมา
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

  const stored = SETTINGS[key].normalize ? SETTINGS[key].normalize(value) : value;

  // OR REPLACE = ไม่มี key นี้ให้เพิ่มแถวใหม่ มีแล้วให้ทับ
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(stored));
  return getSettings();
}

module.exports = {
  REMINDER_CHOICES,
  getSettings,
  setSetting,
};
