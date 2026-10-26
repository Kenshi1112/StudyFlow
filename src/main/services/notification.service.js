// Owner: Backend
// หน้าที่: เช็ค Deadline State เป็นระยะและส่ง OS notification (กันซ้ำด้วย notification_log)
// อ้างอิง: PROJECT_v0.14 section 11 (11.1 กฎ, 11.2 ตั้งเวลา, 11.3 กันซ้ำ) และ 9.2 (Deadline State)

'use strict';

const { Notification } = require('electron');
const { getDb } = require('../db/database');
const { getSettings } = require('./settings.service');
const { computeDeadlineState } = require('./task.service');
const { DEADLINE_STATE } = require('../../shared/constants');

// เช็คทุก 15 นาที (§11.2)
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

// state ที่ 6 ที่ใช้เฉพาะแจ้งเตือน (§11.3) ไม่ใช่ deadline state จริง จึงไม่อยู่ใน constants.js
const UPCOMING_WITHIN_WINDOW = 'upcoming_within_window';

// state ที่ต้องแจ้ง 3 ตัว (§11.1) พร้อมข้อความ state อื่นไม่มีในนี้ = ไม่แจ้ง
const MESSAGES = {
  [UPCOMING_WITHIN_WINDOW]: 'ใกล้ถึงกำหนด',
  [DEADLINE_STATE.DUE_TODAY]: 'ถึงกำหนดวันนี้',
  [DEADLINE_STATE.OVERDUE]: 'เลยกำหนดแล้ว',
};

let timer = null;

// state สำหรับแจ้งเตือนของ task 1 ตัว = deadline state ของข้อ 1.5 แต่แยก upcoming ออกเป็น 2 แบบ
// "อยู่ในหน้าต่าง" นับตามวันที่ในปฏิทิน: due ไม่เกินวันนี้ + windowDays
// ตัวอย่าง: ตอนนี้ 24 ต.ค. 15:00, windowDays = 1 -> หน้าต่างจบก่อน 26 ต.ค. 00:00
//   due 25 ต.ค. 23:59 -> upcoming_within_window / due 26 ต.ค. 09:00 -> upcoming
function getNotificationState(task, windowDays, now = new Date()) {
  const state = computeDeadlineState(task, now);
  if (state !== DEADLINE_STATE.UPCOMING) return state;

  const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + windowDays + 1);
  return new Date(task.due_date) < windowEnd ? UPCOMING_WITHIN_WINDOW : DEADLINE_STATE.UPCOMING;
}

// วนทุก task ที่ยังไม่ถูกลบ แจ้งเฉพาะที่ state เปลี่ยนจากที่แจ้งไปล่าสุด (§11.3) คืนจำนวนที่แจ้งรอบนี้
// log จดเฉพาะตอนที่แจ้งจริง เช่น แจ้ง due_today แล้ว เช็คอีกรอบ state ยังเป็น due_today -> เงียบ
// พอข้ามเที่ยงคืน state เป็น overdue (ต่างจาก due_today) -> แจ้งอีก 1 ครั้ง
// now ส่งเองได้เพื่อใช้ทดสอบ
function checkDeadlineStates(now = new Date()) {
  if (!Notification.isSupported()) return 0;

  const db = getDb();
  const windowDays = getSettings().reminder_window_days;
  const tasks = db.prepare('SELECT * FROM tasks WHERE deleted_at IS NULL').all();

  const lastNotified = new Map();
  for (const row of db.prepare('SELECT task_id, last_notified_state FROM notification_log').all()) {
    lastNotified.set(row.task_id, row.last_notified_state);
  }
  const saveLog = db.prepare(
    'INSERT OR REPLACE INTO notification_log (task_id, last_notified_state, notified_at) VALUES (?, ?, ?)'
  );

  let sent = 0;
  for (const task of tasks) {
    try {
      const state = getNotificationState(task, windowDays, now);
      if (!MESSAGES[state]) continue; // no_deadline / completed / upcoming (ยังไกล)
      if (lastNotified.get(task.id) === state) continue; // แจ้ง state นี้ไปแล้ว

      new Notification({ title: 'StudyFlow', body: `${MESSAGES[state]}: ${task.title}` }).show();
      saveLog.run(task.id, state, now.toISOString());
      sent += 1;
    } catch (error) {
      // task เดียวที่ข้อมูลเพี้ยน (เช่น due_date อ่านไม่ออก) ต้องไม่ทำให้ task อื่นไม่ถูกเช็ค
      console.error(`notification: skip task ${task.id}: ${error.message}`);
    }
  }
  return sent;
}

// เช็คทันที 1 ครั้งตอนเปิดแอป แล้วเช็คซ้ำทุก 15 นาที (เรียกซ้ำตอนมีตัวจับเวลาอยู่แล้ว = ไม่ทำอะไร)
function startScheduler() {
  if (timer) return;
  checkDeadlineStates();
  timer = setInterval(() => checkDeadlineStates(), CHECK_INTERVAL_MS);
}

function stopScheduler() {
  clearInterval(timer);
  timer = null;
}

module.exports = {
  getNotificationState,
  checkDeadlineStates,
  startScheduler,
  stopScheduler,
};
