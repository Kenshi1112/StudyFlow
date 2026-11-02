// Owner: Backend
// หน้าที่: เช็ค Deadline State เป็นระยะและส่ง OS notification (เตือนซ้ำ Overdue / Due Today ตามเวลา + เตือน Upcoming วันละรอบ)
// อ้างอิง: PROJECT_v0.20 section 11 (11.1 กฎ, 11.2 ตั้งเวลา, 11.3 กันซ้ำ, 11.4 Upcoming เตือนเป็นช่วง, 11.5 เตือนซ้ำ Overdue / Due Today) และ 9.2 (Deadline State)
// ถ้าแก้กฎ Upcoming ที่นี่ ต้องแก้ supabase/functions/_shared/reminders.ts ด้วย (§17.2, §20) แล้วรัน parity test

'use strict';

const { Notification } = require('electron');
const { getDb } = require('../db/database');
const { getSettings, setSetting } = require('./settings.service');
const { computeDeadlineState } = require('./task.service');
const { DEADLINE_STATE } = require('../../shared/constants');

// เช็คทุก 15 นาที (§11.2)
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// เตือนซ้ำ Overdue / Due Today ห่างกัน 1 ชั่วโมง (§11.5) ตายตัว ไม่มี Settings
// setInterval เลื่อนได้เล็กน้อย (เช่น 59 นาที 59 วินาที) จึงยอมให้ถึงเกณฑ์ก่อนเวลาไม่เกิน 1 นาที ไม่งั้นรอบนั้นจะข้ามไปรอรอบเช็คถัดไปอีก 15 นาที
const REPEAT_INTERVAL_MS = 60 * 60 * 1000;
const REPEAT_SLACK_MS = 60 * 1000;

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
function daysUntilDue(dueDate, now = new Date()) {
  const due = new Date(dueDate);
  // Date.UTC ของ "ปี/เดือน/วัน ตามเครื่อง" ให้ทุกวันยาว 24 ชม. เท่ากัน (ไม่โดนวันเปลี่ยนเวลา DST)
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueDay - today) / MS_PER_DAY);
}

// งานที่เป็น Upcoming อยู่ในช่วงเตือนไหม (§11.4): วันนี้ >= (วันที่ของ due_date - N วัน) เท่ากับ เหลืออีกไม่เกิน N วัน
// (ส่วนเงื่อนไข "เป็น Upcoming และไม่ Completed" เช็คแยกจาก computeDeadlineState)
// ตัวอย่าง: due 10 พ.ย., N = 3 -> 6 พ.ย. เหลือ 4 = ไม่ใช่ / 7 พ.ย. เหลือ 3 = ใช่ / 9 พ.ย. เหลือ 1 = ใช่
function isInReminderWindow(daysLeft, windowDays) {
  return daysLeft <= windowDays;
}

// วันที่ตามปฏิทินเครื่องเป็นข้อความ YYYY-MM-DD ใช้เป็น marker ของรอบ Upcoming (§11.4) ตัวอย่าง: 4 พ.ย. 2026 -> '2026-11-04'
function toDateText(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
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

// ข้อความ notification รอบ Upcoming อันเดียว (§11.4) upcoming = [{ task, daysLeft }]
//   งานเดียว  -> "ใกล้ถึงกำหนด: ส่งรายงาน · อีก 3 วัน"
//   หลายงาน   -> จำนวน + เหลือน้อยสุดกี่วัน เช่น 4 งาน เหลือ 5, 2, 3, 7 วัน -> "ใกล้ถึงกำหนด 4 งาน · เร็วสุดอีก 2 วัน"
function buildUpcomingBody(upcoming) {
  if (upcoming.length === 1) return `ใกล้ถึงกำหนด: ${upcoming[0].task.title} · อีก ${upcoming[0].daysLeft} วัน`;
  const fewest = Math.min(...upcoming.map((item) => item.daysLeft));
  return `ใกล้ถึงกำหนด ${upcoming.length} งาน · เร็วสุดอีก ${fewest} วัน`;
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

// วนทุก task ที่ยังไม่ถูกลบ คืนจำนวน notification ที่เด้งรอบนี้ (แต่ละรอบนับเป็น 1 ไม่ว่ากี่งาน) now ส่งเองได้เพื่อใช้ทดสอบ
//   Due Today / Overdue (§11.1, §11.5): รวมทุกงานที่ยัง Overdue / Due Today เป็น notification เดียว เด้งเมื่อ
//     1) มีงาน "เพิ่งเข้า" state นี้ (state ต่างจากที่จดใน log §11.3) -> เด้งทันที แม้มี Start Working อยู่
//     2) ยังไม่เคยเด้งรอบนี้เลยตั้งแต่เปิดแอป -> เด้งตอนเปิดแอป
//     3) ห่างจากรอบก่อน >= 1 ชม. -> เด้งซ้ำ ยกเว้นมี Start Working อยู่ (ข้ามโดยไม่จดเวลา รอบเช็คแรกหลังจบ session จะได้เด้ง)
//     ทุกรอบเริ่มนับ 1 ชม. ใหม่ ไม่มีงาน Overdue / Due Today เลย = ไม่เด้ง
//   Upcoming (§11.4 v0.20): งานที่อยู่ "ในช่วงเตือน" รวมเป็น notification เดียว เด้งวันละรอบที่การเช็กแรกของวันใหม่
//     (เทียบกับ settings.last_upcoming_round_on) เด้งแล้วจดวันที่ไว้ ไม่เด้งซ้ำวันเดียวกันแม้ restart
//     ไม่มีงานในช่วง = ไม่เด้งและไม่จด / มี Start Working อยู่ = ข้ามและไม่จด รอบเช็กแรกหลังจบ session จะได้เด้ง
//   รอบ Overdue / Due Today แสดงก่อนรอบ Upcoming เสมอ
//   ปิด "Remind me about upcoming deadlines" = ข้ามส่วน Upcoming ทั้งหมด (ไม่แจ้ง ไม่จด) ส่วน Overdue / Due Today ยังทำงาน
//   options.isSessionActive ใส่เองได้เพื่อทดสอบ (ปกติถามจาก pomodoro.service)
function checkDeadlineStates(now = new Date(), { isSessionActive = defaultIsSessionActive } = {}) {
  if (!Notification.isSupported()) return 0;

  const db = getDb();
  const settings = getSettings();
  const tasks = db.prepare('SELECT * FROM tasks WHERE deleted_at IS NULL').all();

  const logs = new Map();
  for (const row of db.prepare('SELECT task_id, last_notified_state FROM notification_log').all()) {
    logs.set(row.task_id, row);
  }
  // notification_log ใช้จำแค่ "งานนี้เพิ่งแจ้ง Due Today / Overdue ไปหรือยัง" (§11.3) คอลัมน์ reminders_sent ไม่ใช้แล้ว (ใช้ค่า default)
  const saveLog = db.prepare(
    `INSERT INTO notification_log (task_id, last_notified_state, notified_at) VALUES (?, ?, ?)
     ON CONFLICT(task_id) DO UPDATE SET last_notified_state = excluded.last_notified_state, notified_at = excluded.notified_at`
  );
  const deleteLog = db.prepare('DELETE FROM notification_log WHERE task_id = ?');

  let hasEntered = false; // มีงานเพิ่งเข้า Due Today / Overdue รอบนี้ไหม
  const urgent = []; // ทุกงานที่ตอนนี้ Overdue หรือ Due Today { task, state } (ไม่ว่าเคยแจ้งแล้วหรือยัง)
  const upcoming = []; // งาน Upcoming ที่อยู่ในช่วงเตือน { task, daysLeft }
  for (const task of tasks) {
    try {
      const state = computeDeadlineState(task, now);
      const log = logs.get(task.id);

      if (MESSAGES[state]) {
        urgent.push({ task, state });
        if (log?.last_notified_state !== state) {
          // เพิ่งเข้า state นี้ จดทันที: รอบนี้ได้เด้งแน่ (ข้อ 1 ด้านบน) ไม่ต้องรอตัดสินใจ
          saveLog.run(task.id, state, now.toISOString());
          hasEntered = true;
        }
        continue;
      }

      if (state !== DEADLINE_STATE.UPCOMING) continue; // no_deadline / completed

      // งานกลับมาเป็น Upcoming (เช่นผู้ใช้เลื่อน due ไปไกลขึ้นหลังเคยเป็น Due Today / Overdue) = ลบแถว log ทิ้ง
      // ไม่งั้นพอถึง Due Today อีกรอบ state ซ้ำกับที่จดไว้ จะไม่นับว่า "เพิ่งเข้า" (ไม่เขียนค่า Upcoming ลง log ตาม v0.20)
      if (log) deleteLog.run(task.id);

      if (!settings.reminder_upcoming_enabled) continue; // ปิดการเตือนล่วงหน้า
      const daysLeft = daysUntilDue(task.due_date, now);
      if (isInReminderWindow(daysLeft, settings.reminder_days)) upcoming.push({ task, daysLeft });
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

  // รอบ Upcoming (§11.4): วันละรอบ ตัวอย่าง marker = '2026-11-04' ตอนนี้ 4 พ.ย. = แจ้งไปแล้ววันนี้ ข้าม / ตอนนี้ 5 พ.ย. = วันใหม่ แจ้งได้
  const today = toDateText(now);
  if (upcoming.length > 0 && settings.last_upcoming_round_on !== today && !isSessionActive()) {
    show(buildUpcomingBody(upcoming));
    setSetting('last_upcoming_round_on', today);
    shown += 1;
  }
  return shown;
}

// เช็คทันที 1 ครั้งตอนเปิดแอป (= รอบ Overdue / Due Today และรอบ Upcoming ของวันนั้น) แล้วเช็คซ้ำทุก 15 นาที (เรียกซ้ำตอนมีตัวจับเวลาอยู่แล้ว = ไม่ทำอะไร)
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
  isInReminderWindow,
  toDateText,
  buildDigestBody,
  buildUpcomingBody,
  checkDeadlineStates,
  resetRepeatState,
  startScheduler,
  stopScheduler,
};
