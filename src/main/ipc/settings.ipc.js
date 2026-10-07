// Owner: Backend
// หน้าที่: ลงทะเบียน ipcMain.handle ของ feature settings แล้วส่งต่อให้ settings.service
// payload / ค่าที่ตอบกลับ: ดู docs/ipc-contract.md (ถ้า service throw ฝั่ง renderer จะได้ invoke ที่ reject)

'use strict';

const { IPC } = require('../../shared/ipc-channels');
const settingsService = require('../services/settings.service');

// ipcMain ส่งมาจาก main.js (เทสส่งตัวปลอมเข้ามาได้) ทุก handler รับ (event, payload) แต่ไม่ได้ใช้ event
function registerSettingsIpc(ipcMain) {
  ipcMain.handle(IPC.SETTINGS.GET, () => settingsService.getSettings());
  ipcMain.handle(IPC.SETTINGS.SET, (_event, payload) => settingsService.setSetting(payload?.key, payload?.value));
}

module.exports = {
  registerSettingsIpc,
};
