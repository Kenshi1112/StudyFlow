// Owner: Backend
// หน้าที่: เช็ค Deadline State เป็นระยะและส่ง OS notification (กันซ้ำด้วย notification_log + เตือนซ้ำ Overdue / Due Today ตามเวลา)
// อ้างอิง: PROJECT_v0.19 section 11 (11.1 กฎ, 11.2 ตั้งเวลา, 11.3 กันซ้ำ, 11.4 Upcoming reminder, 11.5 เตือนซ้ำ Overdue / Due Today) และ 9.2 (Deadline State)
// ถ้าแก้กฎ Upcoming ที่นี่ ต้องแก้ supabase/functions/_shared/reminders.ts ด้วย (§17.2, §20) แล้วรัน parity test

'use strict';

const { Notification } = require('electron');
const { getDb } = require('../db/database');
const { getSettings } = require('./settings.service');
const { computeDeadlineState } = require('./task.service');
const { DEADLINE_STATE } = require('../../shared/constants');

// เช็คทุก 15 นาที (§11.2)
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// เตือนซ้ำ Overdue / Due Today ห่างกัน 1 ชั่วโมง (§11.5) ตายตัว ไม่มี Settings
// setInterval เลื่อนได้เล็กน้อย (เช่น 59 นาที 59 วินาที) จึงยอมให้ถึงเกณฑ์ก่อนเวลาไม่เกิน 1 นาที ไม่งั้นรอบนั้นจะข้ามไปรอรอบเช็คถัดไปอีก 15 นาที
const REPEAT_INTERVAL_MS = 60 * 60 * 1000;
const REPEAT_SLACK_MS = 60 * 1000;

// state ที่ 6 ที่ใช้เฉพาะแจ้งเตือน (§11.3) ไม่ใช่ deadline state จริง จึงไม่อยู่ใน constants.js
// v0.16: ความหมายคือ "ส่ง Upcoming reminder (รวมที่จดเงียบ ๆ) ไปแล้วอย่างน้อย 1 ค่า" ไม่ต้องแก้ CHECK constraint
const UPCOMING_WITHIN_WINDOW = 'upcoming_within_window';

// Upcoming reminder เกินกี่อันในรอบเดียวถึงรวมเป็น notification เดียว (§11.4)
const MAX_SEPARATE_UPCOMING = 3;

// ข้อความ Due Today / Overdue (§11.1) state อื่นไม่มีในนี้ = ไม่แจ้งด้วยกฎนี้
const MESSAGES = {
  [DEADLINE_STATE.DUE_TODAY]: 'ถึงกำหนดวันนี้',
  [DEADLINE_STATE.OVERDUE]: 'เลยกำหนดแล้ว',
};

let timer = null;
// เวลาที่แจ้งรอบ Overdue / Due Today ล่าสุด เก็บในหน่วยความจำเท่านั้น (§11.5) ปิดแอป = ลืม ซึ่งถูกต้อง เพราะเปิดแอปครั้งหน้าแจ้งรอบแรกอยู่แล้ว
// null = ยังไม่เคยแจ้งในการเปิดแอปครั้งนี้
let lastRoundAt = null;

// เหลืออีกกี่ "วันตามปฏิทิน" จนถึงวันที่ของ due_date (ไม่ดูเวลา) ใช้วันตามนาฬิกาเครื่องเหมือน §9.2
// ตัวอย่าง: now = 7 พ.ย. 15:00 -> due 10 พ.ย. 23:59 = 3 / due 8 พ.ย. 00:00 = 1 / due 7 พ.ย. 23:00 = 0
// reminder N วัน "ถึงแล้ว" เมื่อ daysUntilDue <= N (due 10 พ.ย., N = 3 -> ถึงตั้งแต่ 7 พ.ย. ไม่ว่าเวลาไหน)
function daysUntilDue(dueDate, now = new Date()) {
  const due = new Date(dueDate);
  // Date.UTC ของ "ปี/เดือน/วัน ตามเครื่อง" ให้ทุกวันยาว 24 ชม. เท่ากัน (ไม่โดนวันเปลี่ยนเวลา DST)
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueDay - today) / MS_PER_DAY);
}

// reminders_sent ใน DB เป็นข้อความ '7,3' <-> array [7, 3]
const parseSent = (text) => (text ? text.split(',').map(Number) : []);

// ตัดสิน Upcoming reminder ของ task 1 ตัว (§11.4) เป็นฟังก์ชันล้วน ไม่แตะ DB
//   daysLeft     เหลืออีกกี่วัน (task ที่ Upcoming จะได้ >= 1)
//   ticked       วันที่ผู้ใช้ติ๊ก เช่น [7, 3, 1]
//   sent         วันที่จดว่าจัดการแล้ว เช่น [7]
//   isFirstSight task นี้ยังไม่มีแถวใน notification_log (เพิ่งสร้าง/เพิ่งเห็นครั้งแรก)
// คืน { sent: ค่าที่ต้องจดใหม่ (มากไปน้อย), notify: ต้องเด้งไหม }
// เด้งได้อย่างมาก 1 ครั้งต่อรอบ ข้อความบอกจำนวนวันจริง (daysLeft) จึงไม่ต้องรู้ว่าเด้งเพราะค่าไหน (= ค่า N น้อยสุดที่ถึงแล้ว)
// ตัวอย่าง (ติ๊ก 7, 3, 1):
//   เจอครั้งแรก daysLeft 5, sent []      -> { sent: [7],    notify: false }  7 ถึงแล้ว จดเงียบ ๆ
//   ต่อมา daysLeft 3,       sent [7]     -> { sent: [7, 3], notify: true }   3 ถึงแล้ว เด้ง
//   แอปปิดหลายวัน daysLeft 2, sent []    -> { sent: [7, 3], notify: true }   7 กับ 3 ถึงแล้ว เด้งอันเดียว "อีก 2 วัน" จดทั้งคู่
//   ย้าย due ไป daysLeft 10, sent [7, 3] -> { sent: [],     notify: false }  ไม่ถึงแล้ว ลบทิ้ง เตือนใหม่ได้
function decideReminders({ daysLeft, ticked, sent, isFirstSight }) {
  const kept = sent.filter((n) => daysLeft <= n); // ค่าที่ยังถึงแล้ว (ที่ไม่ถึงแล้ว = due ถูกย้ายไกลขึ้น ทิ้ง)
  const newlyReached = ticked.filter((n) => daysLeft <= n && !kept.includes(n)); // ถึงแล้วและยังไม่เคยจด
  return {
    sent: [...kept, ...newlyReached].sort((a, b) => b - a),
    notify: !isFirstSight && newlyReached.length > 0,
  };
}

// ข้อความ notification รอบ Overdue / Due Today อันเดียว (§11.5) urgent = [{ task, state }]
//   งานเดียว  -> ใช้คำเดิมพร้อมชื่อ "เลยกำหนดแล้ว: ส่งรายงาน"
//   หลายงาน   -> บอกแค่จำนวน เลยกำหนดก่อน "เลยกำหนด 2 งาน · ครบกำหนดวันนี้ 1 งาน" (ไม่ใส่ชื่อ เพราะ notification ยาวได้จำกัด)
function buildDigestBody(urgent) {
  if (urgent.length === 1) return `${MESSAGES[urgent[0].state]}: ${urgent[0].task.title}`;
  const overdue = urgent.filter((item) => item.state === DEADLINE_STATE.OVERDUE).length;
  const dueToday = urgent.length - overdue;
  const parts = [];
  if (overdue > 0) parts.push(`เลยกำหนด ${overdue} งาน`);
  if (dueToday > 0) parts.push(`ครบกำหนดวันนี้ ${dueToday} งาน`);
  return parts.join(' · ');
}

// มี Start Working (Pomodoro) อยู่ไหม: running / paused ทุก phase (focus, break) = มี (§11.5)
// require ตอนเรียกเพื่อไม่ให้ service สองตัวผูกกันตั้งแต่โหลด ถ้าโหลดไม่ได้ (เช่นตอนเทส) ถือว่าไม่มี session
function defaultIsSessionActive() {
  try {
    return require('./pomodoro.service').getState().status !== 'idle';
  } catch {
    return false;
  }
}

function show(body) {
  new Notification({ title: 'StudyFlow', body }).show();
}

// วนทุก task ที่ยังไม่ถูกลบ คืนจำนวน notification ที่เด้งรอบนี้ (รอบ Overdue / Due Today นับเป็น 1 ไม่ว่ากี่งาน) now ส่งเองได้เพื่อใช้ทดสอบ
//   Due Today / Overdue (§11.1, §11.5): รวมทุกงานที่ยัง Overdue / Due Today เป็น notification เดียว เด้งเมื่อ
//     1) มีงาน "เพิ่งเข้า" state นี้ (state ต่างจากที่จดใน log §11.3) -> เด้งทันที แม้มี Start Working อยู่
//     2) ยังไม่เคยเด้งรอบนี้เลยตั้งแต่เปิดแอป -> เด้งตอนเปิดแอป
//     3) ห่างจากรอบก่อน >= 1 ชม. -> เด้งซ้ำ ยกเว้นมี Start Working อยู่ (ข้ามโดยไม่จดเวลา รอบเช็คแรกหลังจบ session จะได้เด้ง)
//     ทุกรอบเริ่มนับ 1 ชม. ใหม่ ไม่มีงาน Overdue / Due Today เลย = ไม่เด้ง
//   Upcoming (§11.4): ใช้ decideReminders แล้วจดผลลง log ทุกครั้งที่เปลี่ยน (ไม่เปลี่ยนก็ไม่เขียน) เด้งครั้งเดียวต่อ reminder ไม่เด้งซ้ำ
//   ปิด "Remind me about upcoming deadlines" = ข้ามส่วน Upcoming ทั้งหมด (ไม่แจ้ง ไม่เขียน log) ส่วน Overdue / Due Today ยังทำงาน
//   options.isSessionActive ใส่เองได้เพื่อทดสอบ (ปกติถามจาก pomodoro.service)
function checkDeadlineStates(now = new Date(), { isSessionActive = defaultIsSessionActive } = {}) {
  if (!Notification.isSupported()) return 0;

  const db = getDb();
  const settings = getSettings();
  const ticked = settings.reminder_upcoming_enabled ? settings.reminder_days : []; // [] = ปิด
  const tasks = db.prepare('SELECT * FROM tasks WHERE deleted_at IS NULL').all();

  const logs = new Map();
  for (const row of db.prepare('SELECT task_id, last_notified_state, reminders_sent FROM notification_log').all()) {
    logs.set(row.task_id, row);
  }
  const saveLog = db.prepare(
    `INSERT INTO notification_log (task_id, last_notified_state, reminders_sent, notified_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(task_id) DO UPDATE SET last_notified_state = excluded.last_notified_state,
       reminders_sent = excluded.reminders_sent, notified_at = excluded.notified_at`
  );

  let hasEntered = false; // มีงานเพิ่งเข้า Due Today / Overdue รอบนี้ไหม
  const urgent = []; // ทุกงานที่ตอนนี้ Overdue หรือ Due Today { task, state } (ไม่ว่าเคยแจ้งแล้วหรือยัง)
  const upcoming = []; // Upcoming reminder ที่ต้องเด้งรอบนี้ { task, daysLeft } แสดงหลังวนเสร็จ เพราะอาจต้องรวมเป็นอันเดียว
  for (const task of tasks) {
    try {
      const state = computeDeadlineState(task, now);
      const log = logs.get(task.id);

      if (MESSAGES[state]) {
        urgent.push({ task, state });
        if (log?.last_notified_state !== state) {
          // เพิ่งเข้า state นี้ จดทันที: รอบนี้ได้เด้งแน่ (ข้อ 1 ด้านบน) ไม่ต้องรอตัดสินใจ
          saveLog.run(task.id, state, log?.reminders_sent ?? '', now.toISOString());
          hasEntered = true;
        }
        continue;
      }

      if (state !== DEADLINE_STATE.UPCOMING || ticked.length === 0) continue; // no_deadline / completed / ปิดการเตือนล่วงหน้า

      const daysLeft = daysUntilDue(task.due_date, now);
      const result = decideReminders({ daysLeft, ticked, sent: parseSent(log?.reminders_sent), isFirstSight: !log });

      // state ใน log ตามค่าที่จด: เคยจดอย่างน้อย 1 ค่า = upcoming_within_window ไม่งั้น upcoming
      // ถ้า log เดิมเป็น due_today/overdue (ผู้ใช้ย้าย due ไปไกลขึ้น) บรรทัดนี้รีเซ็ตให้ Due Today เด้งได้อีกรอบ
      const newState = result.sent.length > 0 ? UPCOMING_WITHIN_WINDOW : DEADLINE_STATE.UPCOMING;
      const newSent = result.sent.join(',');
      if (!log || log.last_notified_state !== newState || log.reminders_sent !== newSent) {
        saveLog.run(task.id, newState, newSent, now.toISOString());
      }
      if (result.notify) upcoming.push({ task, daysLeft });
    } catch (error) {
      // task เดียวที่ข้อมูลเพี้ยน (เช่น due_date อ่านไม่ออก) ต้องไม่ทำให้ task อื่นไม่ถูกเช็ค
      console.error(`notification: skip task ${task.id}: ${error.message}`);
    }
  }

  let shown = 0;

  // รอบ Overdue / Due Today (§11.5) เรียงให้ Overdue มาก่อนเสมอในข้อความ (buildDigestBody ทำให้แล้ว)
  if (urgent.length > 0) {
    const isLaunchRound = lastRoundAt === null;
    const repeatDue = lastRoundAt !== null && now.getTime() - lastRoundAt.getTime() >= REPEAT_INTERVAL_MS - REPEAT_SLACK_MS;
    if (hasEntered || isLaunchRound || (repeatDue && !isSessionActive())) {
      show(buildDigestBody(urgent));
      lastRoundAt = now;
      shown += 1;
    }
  }

  // เกิน 3 อัน -> รวมเป็น notification เดียว (§11.4) ไม่เกิน -> แยกทีละงาน
  if (upcoming.length > MAX_SEPARATE_UPCOMING) {
    show(`มี ${upcoming.length} งานใกล้ถึงกำหนด`);
    shown += 1;
  } else {
    for (const { task, daysLeft } of upcoming) {
      show(`อีก ${daysLeft} วันถึงกำหนด: ${task.title}`);
      shown += 1;
    }
  }
  return shown;
}

// เช็คทันที 1 ครั้งตอนเปิดแอป (= รอบ Overdue / Due Today ตอนเปิดแอป) แล้วเช็คซ้ำทุก 15 นาที (เรียกซ้ำตอนมีตัวจับเวลาอยู่แล้ว = ไม่ทำอะไร)
function startScheduler() {
  if (timer) return;
  lastRoundAt = null;
  checkDeadlineStates();
  timer = setInterval(() => checkDeadlineStates(), CHECK_INTERVAL_MS);
}

function stopScheduler() {
  clearInterval(timer);
  timer = null;
}

// ล้างเวลารอบล่าสุด = เหมือนเปิดแอปใหม่ (ใช้ในเทส)
function resetRepeatState() {
  lastRoundAt = null;
}

module.exports = {
  REPEAT_INTERVAL_MS,
  daysUntilDue,
  decideReminders,
  buildDigestBody,
  checkDeadlineStates,
  resetRepeatState,
  startScheduler,
  stopScheduler,
};
