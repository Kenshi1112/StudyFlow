// Owner: Backend
// หน้าที่: จัดการ batch ของ Pomodoro (focus/break) จับเวลาใน main process, บันทึก session, ส่ง state ให้ widget/หน้าจอ
// อ้างอิง: PROJECT_v0.14 section 9.1, 15 และ docs/ipc-contract.md

'use strict';

const crypto = require('crypto');
const { Notification, BrowserWindow } = require('electron');
const { getDb } = require('../db/database');
const { getSettings } = require('./settings.service');
const { createFloatingWidget, closeFloatingWidget } = require('../windows/floating-widget');
const { EVENTS } = require('../../shared/ipc-channels');
const { TASK_STATUS } = require('../../shared/constants');

// state ตอนไม่มี batch
const IDLE = {
  status: 'idle',
  phase: null,
  task_id: null,
  batch_id: null,
  session_index: null,
  session_total: null,
  phase_total_seconds: null,
  remaining_seconds: null,
};

// state ของ batch ที่กำลังวิ่ง (หน้าตาเดียวกับที่ส่งให้หน้าจอ) null = ไม่มี batch ทีละ batch เท่านั้น
let state = null;
let timer = null; // setInterval ที่เรียก tick() ทุก 1 วินาที
let focusSeconds = 0; // ความยาว focus / break ของ batch นี้ (อ่านจาก settings ตอนกด Start)
let breakSeconds = 0;
let phaseStartedAt = null; // เวลาที่ phase ปัจจุบันเริ่ม (ISO) เอาไปใส่ started_at

// ---------------------------------------------------------------------------
// ตัวช่วยภายใน
// ---------------------------------------------------------------------------

function getState() {
  return state ? { ...state } : { ...IDLE };
}

// ส่ง state ให้ทุกหน้าต่างที่เปิดอยู่ (หน้าหลัก + widget) ผ่าน event pomodoro:state-changed (ข้อ 3.5)
function publish() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(EVENTS.POMODORO_STATE_CHANGED, getState());
  }
}

// OS notification ตอนเปลี่ยน phase (ข้อ 3.7)
function notify(text) {
  if (Notification.isSupported()) new Notification({ title: 'StudyFlow', body: text }).show();
}

// เริ่ม phase ใหม่ ('focus' หรือ 'break') เช่น focus 25 นาที -> phase_total_seconds = 1500, remaining_seconds = 1500
function startPhase(phase, seconds) {
  state.phase = phase;
  state.phase_total_seconds = seconds;
  state.remaining_seconds = seconds;
  phaseStartedAt = new Date().toISOString();
}

// บันทึก focus ปัจจุบัน 1 แถว (ข้อ 3.3) break ไม่บันทึก
// completed = true เมื่อ focus ครบเวลา / false เมื่อถูกหยุดกลางคัน (ข้อ 3.4, §15.1)
// เวลาที่ใช้จริง = เวลาที่ตั้ง - เวลาที่เหลือ เช่น ตั้ง 1500 วิ เหลือ 900 -> ใช้ไป 600 วิ
// ถ้าใช้ไป 0 วินาที (กด Stop ทันที) ไม่บันทึก
function saveFocusSession(completed) {
  const actual = state.phase_total_seconds - state.remaining_seconds;
  if (actual <= 0) return;

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO pomodoro_sessions
         (id, task_id, started_at, planned_duration_seconds, actual_duration_seconds, completed,
          batch_id, session_index, session_total, created_at, updated_at)
       VALUES
         (@id, @task_id, @started_at, @planned, @actual, @completed,
          @batch_id, @session_index, @session_total, @now, @now)`
    )
    .run({
      id: crypto.randomUUID(),
      task_id: state.task_id,
      started_at: phaseStartedAt,
      planned: state.phase_total_seconds,
      actual,
      completed: completed ? 1 : 0,
      batch_id: state.batch_id,
      session_index: state.session_index,
      session_total: state.session_total,
      now,
    });
}

// จบ batch: หยุด timer, ปิด widget, ส่ง state idle ให้หน้าจอ
function endBatch() {
  clearInterval(timer);
  state = null;
  closeFloatingWidget();
  publish();
}

// ทำงานทุก 1 วินาที (ข้อ 3.2): ลดเวลาที่เหลือลง 1 ถ้าถึง 0 ให้ไป phase ถัดไป
//   focus จบ -> บันทึกแถว -> ถ้าเป็นรอบสุดท้ายจบ batch (ไม่มี break หลังรอบสุดท้าย) ไม่งั้นไป break
//   break จบ -> focus รอบถัดไป
function tick() {
  state.remaining_seconds -= 1;
  if (state.remaining_seconds > 0) {
    publish();
    return;
  }

  if (state.phase === 'focus') {
    saveFocusSession(true);
    if (state.session_index === state.session_total) {
      endBatch();
      notify('ครบทุกรอบแล้ว');
      return;
    }
    startPhase('break', breakSeconds);
    notify(`ถึงเวลาพักแล้ว (${breakSeconds / 60} นาที)`);
  } else {
    state.session_index += 1;
    startPhase('focus', focusSeconds);
    notify(`ถึงเวลาทำงานแล้ว (รอบที่ ${state.session_index}/${state.session_total})`);
  }
  publish();
}

// ---------------------------------------------------------------------------
// ฟังก์ชันที่ IPC เรียก
// ---------------------------------------------------------------------------

// กด "Start Working" (ข้อ 3.1) payload: { task_id, session_total } ความยาว focus/break อ่านจาก settings
function startBatch(input) {
  // ตรวจ payload
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('payload must be an object');
  }
  for (const key of Object.keys(input)) {
    if (key !== 'task_id' && key !== 'session_total') throw new Error(`payload: field not allowed: ${key}`);
  }
  const { task_id, session_total } = input;
  if (typeof task_id !== 'string' || task_id === '') throw new Error('task_id must be a non-empty string');
  if (!Number.isInteger(session_total) || session_total < 1) {
    throw new Error('session_total must be an integer >= 1');
  }
  if (state) throw new Error('A Pomodoro batch is already running');

  // ตรวจ task: ต้องมี ไม่ถูกลบ และยังไม่เสร็จ (ถ้าจะทำต่อให้ผู้ใช้เปลี่ยน status เป็น In Progress เองก่อน)
  const task = getDb()
    .prepare('SELECT status, first_started_at FROM tasks WHERE id = ? AND deleted_at IS NULL')
    .get(task_id);
  if (!task) throw new Error(`Task not found: ${task_id}`);
  if (task.status === TASK_STATUS.COMPLETED) throw new Error('Task is completed');

  // ผลข้างเคียงกับ task ตาม §15.3
  //   1. last_focus_started_at = ตอนนี้ ทุกครั้งที่เริ่ม batch
  //   2. first_started_at = ตอนนี้ เฉพาะตอนที่ยังว่าง (กดครั้งแรก) ไม่เขียนทับ
  //   3. ถ้าเป็นครั้งแรกและ status = not_started -> เปลี่ยนเป็น in_progress
  // ตัวอย่าง: task ใหม่กด Start 09:00 -> in_progress, first_started_at = 09:00
  //           กดอีกรอบ 10:00 -> status เดิม, first_started_at ยัง 09:00, last_focus_started_at = 10:00
  const now = new Date().toISOString();
  const isFirstStart = task.first_started_at === null;
  const newStatus = isFirstStart && task.status === TASK_STATUS.NOT_STARTED ? TASK_STATUS.IN_PROGRESS : task.status;
  getDb()
    .prepare(
      `UPDATE tasks
       SET status = @status, first_started_at = @first_started_at, last_focus_started_at = @now, updated_at = @now
       WHERE id = @id`
    )
    .run({ status: newStatus, first_started_at: task.first_started_at ?? now, now, id: task_id });

  // ความยาวอ่านจาก settings ตอนกด Start ถ้าไปแก้ settings ระหว่างวิ่ง batch นี้ไม่เปลี่ยนตาม
  const settings = getSettings();
  focusSeconds = settings.pomodoro_focus_minutes * 60;
  breakSeconds = settings.pomodoro_break_minutes * 60;

  state = {
    status: 'running',
    phase: null,
    task_id,
    batch_id: crypto.randomUUID(),
    session_index: 1,
    session_total,
    phase_total_seconds: 0,
    remaining_seconds: 0,
  };
  startPhase('focus', focusSeconds);

  createFloatingWidget();
  timer = setInterval(tick, 1000);
  publish();
  return getState();
}

// หยุดชั่วคราว: หยุด timer เวลาที่เหลือค้างไว้ที่เดิม (กดซ้ำไม่เป็นไร)
function pause() {
  if (!state) throw new Error('No Pomodoro batch is running');
  if (state.status === 'running') {
    clearInterval(timer);
    state.status = 'paused';
    publish();
  }
  return getState();
}

// เล่นต่อ: เริ่ม timer ใหม่ นับต่อจากเวลาที่เหลือ (กดตอนไม่ได้ pause ไม่ทำอะไร)
function resume() {
  if (!state) throw new Error('No Pomodoro batch is running');
  if (state.status === 'paused') {
    state.status = 'running';
    timer = setInterval(tick, 1000);
    publish();
  }
  return getState();
}

// หยุด batch (ข้อ 3.4): ถ้าอยู่ใน focus บันทึกเวลาที่ผ่านไปเป็น completed = false
// main.js เรียกฟังก์ชันนี้ตอนปิดแอป (before-quit) ด้วย จึงไม่ throw เมื่อไม่มี batch
function stop() {
  if (!state) return getState();
  if (state.phase === 'focus') saveFocusSession(false);
  endBatch();
  return getState();
}

module.exports = {
  startBatch,
  pause,
  resume,
  stop,
  getState,
};
