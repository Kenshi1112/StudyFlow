// Owner: Backend
// หน้าที่: ลงทะเบียน ipcMain.handle ของ feature tasks แล้วส่งต่อให้ task.service
// payload / ค่าที่ตอบกลับ: ดู docs/ipc-contract.md (ถ้า service throw ฝั่ง renderer จะได้ invoke ที่ reject)

'use strict';

const { IPC } = require('../../shared/ipc-channels');
const taskService = require('../services/task.service');

// ipcMain ส่งมาจาก main.js (เทสส่งตัวปลอมเข้ามาได้) ทุก handler รับ (event, payload) แต่ไม่ได้ใช้ event
function registerTasksIpc(ipcMain) {
  ipcMain.handle(IPC.TASKS.LIST, () => taskService.listTasks());
  ipcMain.handle(IPC.TASKS.GET, (_event, payload) => taskService.getTask(payload?.id));
  ipcMain.handle(IPC.TASKS.CREATE, (_event, payload) => taskService.createTask(payload));
  ipcMain.handle(IPC.TASKS.UPDATE, (_event, payload) => taskService.updateTask(payload?.id, payload?.changes));
  ipcMain.handle(IPC.TASKS.DELETE, (_event, payload) => taskService.deleteTask(payload?.id));
}

module.exports = {
  registerTasksIpc,
};
