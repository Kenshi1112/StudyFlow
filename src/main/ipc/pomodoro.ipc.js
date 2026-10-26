// Owner: Backend
// หน้าที่: ลงทะเบียน ipcMain.handle ของ feature pomodoro แล้วส่งต่อให้ pomodoro.service
// payload / ค่าที่ตอบกลับ: ดู docs/ipc-contract.md (ถ้า service throw ฝั่ง renderer จะได้ invoke ที่ reject)

'use strict';

const { IPC } = require('../../shared/ipc-channels');
const pomodoroService = require('../services/pomodoro.service');

// ipcMain ส่งมาจาก main.js (เทสส่งตัวปลอมเข้ามาได้) ทุก handler รับ (event, payload) แต่ไม่ได้ใช้ event
function registerPomodoroIpc(ipcMain) {
  ipcMain.handle(IPC.POMODORO.START_BATCH, (_event, payload) => pomodoroService.startBatch(payload));
  ipcMain.handle(IPC.POMODORO.PAUSE, () => pomodoroService.pause());
  ipcMain.handle(IPC.POMODORO.RESUME, () => pomodoroService.resume());
  ipcMain.handle(IPC.POMODORO.STOP, () => pomodoroService.stop());
  ipcMain.handle(IPC.POMODORO.GET_STATE, () => pomodoroService.getState());
}

module.exports = {
  registerPomodoroIpc,
};
