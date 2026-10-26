// Owner: Backend
// หน้าที่: ลงทะเบียน ipcMain.handle ของ feature dashboard แล้วส่งต่อให้ dashboard.service
// payload / ค่าที่ตอบกลับ: ดู docs/ipc-contract.md (ถ้า range ผิด service throw ฝั่ง renderer จะได้ invoke ที่ reject)

'use strict';

const { IPC } = require('../../shared/ipc-channels');
const dashboardService = require('../services/dashboard.service');

// ipcMain ส่งมาจาก main.js (เทสส่งตัวปลอมเข้ามาได้) handler รับ (event, payload) แต่ไม่ได้ใช้ event
function registerDashboardIpc(ipcMain) {
  ipcMain.handle(IPC.DASHBOARD.GET_METRICS, (_event, payload) => dashboardService.getMetrics(payload?.range));
}

module.exports = {
  registerDashboardIpc,
};
