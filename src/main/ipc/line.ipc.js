// Owner: Backend
// หน้าที่: ลงทะเบียน ipcMain.handle ของ feature line แล้วส่งต่อให้ cloud-sync.service (ส่วน LINE ฝั่งแอป)
// payload / ค่าที่ตอบกลับ: ดู docs/ipc-contract.md (ถ้า service throw ฝั่ง renderer จะได้ invoke ที่ reject)

'use strict';

const { IPC } = require('../../shared/ipc-channels');
const cloudSync = require('../services/cloud-sync.service');

// ipcMain ส่งมาจาก main.js (เทสส่งตัวปลอมเข้ามาได้) ทั้ง 3 channel ไม่รับ payload
function registerLineIpc(ipcMain) {
  ipcMain.handle(IPC.LINE.GET_STATUS, () => cloudSync.getLineStatus());
  ipcMain.handle(IPC.LINE.GENERATE_CODE, () => cloudSync.createLineLinkCode());
  ipcMain.handle(IPC.LINE.DISCONNECT, () => cloudSync.disconnectLine());
}

module.exports = {
  registerLineIpc,
};
