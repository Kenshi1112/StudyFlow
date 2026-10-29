// Owner: Backend
// หน้าที่: ลงทะเบียน ipcMain.handle ของ feature classroom แล้วส่งต่อให้ classroom-sync.service
// payload / ค่าที่ตอบกลับ: ดู docs/ipc-contract.md (ถ้า service throw ฝั่ง renderer จะได้ invoke ที่ reject)

'use strict';

const { IPC } = require('../../shared/ipc-channels');
const classroomSync = require('../services/classroom-sync.service');

// ipcMain ส่งมาจาก main.js (เทสส่งตัวปลอมเข้ามาได้) ทุก handler รับ (event, payload) แต่ไม่ได้ใช้ event
function registerClassroomIpc(ipcMain) {
  ipcMain.handle(IPC.CLASSROOM.GET_STATUS, () => classroomSync.getStatus());
  ipcMain.handle(IPC.CLASSROOM.CONNECT, () => classroomSync.connect());
  ipcMain.handle(IPC.CLASSROOM.DISCONNECT, () => classroomSync.disconnect());
  ipcMain.handle(IPC.CLASSROOM.SYNC_NOW, () => classroomSync.syncNow());
  ipcMain.handle(IPC.CLASSROOM.GET_PENDING, () => classroomSync.getPendingItems());
  ipcMain.handle(IPC.CLASSROOM.DECIDE, (_event, payload) => classroomSync.decideItem(payload));
}

module.exports = {
  registerClassroomIpc,
};
