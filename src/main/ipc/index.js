// Owner: Backend
// หน้าที่: รวมการลงทะเบียน IPC handler ทุก feature ไว้ที่เดียว (main.js เรียกจุดนี้)
// ตอนนี้มี tasks (ข้อ 1), settings (ข้อ 2), pomodoro (ข้อ 3) feature อื่นเพิ่มบรรทัดที่นี่เมื่อถึงข้อของมัน:
//   dashboard (ข้อ 4) / classroom (ข้อ 6) / line (ข้อ 8)

'use strict';

const { registerTasksIpc } = require('./tasks.ipc');
const { registerSettingsIpc } = require('./settings.ipc');
const { registerPomodoroIpc } = require('./pomodoro.ipc');

function registerAllIpc(ipcMain) {
  registerTasksIpc(ipcMain);
  registerSettingsIpc(ipcMain);
  registerPomodoroIpc(ipcMain);
}

module.exports = {
  registerAllIpc,
};
