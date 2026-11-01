// Owner: Backend
// หน้าที่: ลงทะเบียน ipcMain.handle ของ feature pomodoro แล้วส่งต่อให้ pomodoro.service
// payload / ค่าที่ตอบกลับ: ดู docs/ipc-contract.md (ถ้า service throw ฝั่ง renderer จะได้ invoke ที่ reject)

'use strict';

const { IPC } = require('../../shared/ipc-channels');
const pomodoroService = require('../services/pomodoro.service');
const { showFloatingWidget } = require('../windows/floating-widget');

// ipcMain ส่งมาจาก main.js (เทสส่งตัวปลอมเข้ามาได้) ทุก handler รับ (event, payload) แต่ไม่ได้ใช้ event
function registerPomodoroIpc(ipcMain) {
  ipcMain.handle(IPC.POMODORO.START_BATCH, (_event, payload) => pomodoroService.startBatch(payload));
  ipcMain.handle(IPC.POMODORO.PAUSE, () => pomodoroService.pause());
  ipcMain.handle(IPC.POMODORO.RESUME, () => pomodoroService.resume());
  ipcMain.handle(IPC.POMODORO.STOP, () => pomodoroService.stop());
  ipcMain.handle(IPC.POMODORO.GET_STATE, () => pomodoroService.getState());
  // เปิด widget กลับมาได้เฉพาะตอนมี batch วิ่งอยู่ (running/paused) ไม่งั้น reject คืน State ปัจจุบัน
  ipcMain.handle(IPC.POMODORO.SHOW_WIDGET, () => {
    const state = pomodoroService.getState();
    if (!state || state.status === 'idle') throw new Error('ไม่มี Pomodoro ที่กำลังจับเวลาอยู่');
    showFloatingWidget();
    return state;
  });
}

module.exports = {
  registerPomodoroIpc,
};
