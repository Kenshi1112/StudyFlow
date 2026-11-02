// Owner: Shared (ต้องคุยกันก่อนแก้)
// หน้าที่: สัญญาระหว่าง Frontend กับ Backend — รายชื่อ IPC channel ทั้งหมด (ตอนนี้เป็น placeholder)
// TODO: Backend + Frontend ตกลง channel/payload ร่วมกัน แล้วบันทึก payload shape ใน docs/
'use strict';

// renderer -> main (ใช้ ipcRenderer.invoke / ipcMain.handle)
const IPC = Object.freeze({
  TASKS: Object.freeze({
    LIST: 'tasks:list',
    GET: 'tasks:get',
    CREATE: 'tasks:create',
    UPDATE: 'tasks:update',
    DELETE: 'tasks:delete',
  }),
  CLASSROOM: Object.freeze({
    GET_STATUS: 'classroom:get-status',
    CONNECT: 'classroom:connect',
    DISCONNECT: 'classroom:disconnect',
    SYNC_NOW: 'classroom:sync-now',
    GET_PENDING: 'classroom:get-pending',
    DECIDE: 'classroom:decide',
    TAKE_UPDATES: 'classroom:take-updates', // งานที่ fetch อัปเดตตาม Classroom (spec v0.21 §13.5) อ่านแล้วล้าง
  }),
  POMODORO: Object.freeze({
    START_BATCH: 'pomodoro:start-batch',
    PAUSE: 'pomodoro:pause',
    RESUME: 'pomodoro:resume',
    STOP: 'pomodoro:stop',
    GET_STATE: 'pomodoro:get-state',
    SHOW_WIDGET: 'pomodoro:show-widget', // เปิด floating widget กลับมาหลังผู้ใช้ปิด (2026-11-01)
  }),
  DASHBOARD: Object.freeze({
    GET_METRICS: 'dashboard:get-metrics',
  }),
  SETTINGS: Object.freeze({
    GET: 'settings:get',
    SET: 'settings:set',
  }),
  LINE: Object.freeze({
    GET_STATUS: 'line:get-status',
    GENERATE_CODE: 'line:generate-code',
    DISCONNECT: 'line:disconnect',
  }),
});

// main -> renderer (ใช้ webContents.send / ipcRenderer.on)
const EVENTS = Object.freeze({
  CLASSROOM_PENDING_CHANGED: 'classroom:pending-changed',
  CLASSROOM_TASKS_UPDATED: 'classroom:tasks-updated',
  POMODORO_STATE_CHANGED: 'pomodoro:state-changed',
});

module.exports = { IPC, EVENTS };
