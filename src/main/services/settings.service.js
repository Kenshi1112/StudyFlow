// Owner: Backend
// หน้าที่: อ่าน/เขียน table settings (key-value, local only) — ข้อ 5 (แจ้งเตือน) กับข้อ 6 (Classroom) เรียกใช้จาก main process ได้ตรง ๆ
// อ้างอิง: PROJECT_v0.13 section 11.1, 13.1, 19 และ docs/ipc-contract.md

'use strict';

const { getDb } = require('../db/database');

// cutoff date ต้องเป็นวัน+เวลา (กฎเดียวกับ due_date ใน task.service.js) ปฏิเสธ "2026-10-10" เพราะ JS ตีความเป็นเที่ยงคืน UTC
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// key ที่เก็บได้ทั้งหมด พร้อมค่า default และตัวเช็คค่า (ไม่อยู่ในนี้ = ห้ามเก็บ)
const SETTINGS = {
  // §19: true เมื่อผู้ใช้ปิด/ผ่าน first-run prompt แล้ว จะได้ไม่เด้งซ้ำ
  has_seen_first_run_prompt: {
    default: false,
    isValid: (value) => typeof value === 'boolean',
  },
  // §13.1: import งาน Classroom ที่สร้างตั้งแต่วันนี้ขึ้นไป เช่น '2026-08-01T00:00:00.000Z' (null = ยังไม่ตั้ง)
  classroom_cutoff_date: {
    default: null,
    isValid: (value) =>
      value === null || (typeof value === 'string' && ISO_DATE_TIME.test(value) && !Number.isNaN(new Date(value).getTime())),
  },
  // §11.1: เตือนก่อนถึง due date กี่วัน เช่น 3 = เตือนเมื่อเหลือไม่เกิน 3 วัน (default 1)
  reminder_window_days: {
    default: 1,
    isValid: (value) => Number.isInteger(value) && value >= 1,
  },
};

// อ่านค่าทั้ง 3 key เริ่มจาก default แล้วเอาค่าใน DB มาทับ (key ที่ยังไม่เคยตั้ง = ค่า default)
// เช่น DB มีแค่ reminder_window_days = '3' -> { has_seen_first_run_prompt: false, classroom_cutoff_date: null, reminder_window_days: 3 }
function getSettings() {
  const result = {};
  for (const key of Object.keys(SETTINGS)) {
    result[key] = SETTINGS[key].default;
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

  // OR REPLACE = ไม่มี key นี้ให้เพิ่มแถวใหม่ มีแล้วให้ทับ
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
  return getSettings();
}

module.exports = {
  getSettings,
  setSetting,
};
