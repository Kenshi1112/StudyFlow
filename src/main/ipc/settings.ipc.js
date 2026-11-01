// Owner: Backend
// หน้าที่: ลงทะเบียน ipcMain.handle ของ feature settings แล้วส่งต่อให้ settings.service
// payload / ค่าที่ตอบกลับ: ดู docs/ipc-contract.md (ถ้า service throw ฝั่ง renderer จะได้ invoke ที่ reject)

'use strict';

const { IPC } = require('../../shared/ipc-channels');
const settingsService = require('../services/settings.service');
const cloudSync = require('../services/cloud-sync.service');

// key ที่ LINE ต้องรู้ด้วย (§14.4): เปลี่ยนแล้วต้องเขียนค่าล่าสุดไป Supabase
const LINE_REMINDER_KEYS = ['reminder_days', 'reminder_upcoming_enabled'];

// ipcMain ส่งมาจาก main.js (เทสส่งตัวปลอมเข้ามาได้) ทุก handler รับ (event, payload) แต่ไม่ได้ใช้ event
function registerSettingsIpc(ipcMain) {
  ipcMain.handle(IPC.SETTINGS.GET, () => settingsService.getSettings());
  ipcMain.handle(IPC.SETTINGS.SET, (_event, payload) => {
    const result = settingsService.setSetting(payload?.key, payload?.value);
    // บันทึกในเครื่องสำเร็จแล้วค่อยบอก LINE แบบไม่รอ (ไม่ throw: ออฟไลน์ก็ไม่ให้บันทึก settings พัง §14.4)
    // เช่น ติ๊ก 7 และ 1 -> reminder_days = [7, 1] -> LINE เตือนที่ 7 และ 1 วันเหมือนแอป
    if (LINE_REMINDER_KEYS.includes(payload.key)) cloudSync.pushReminderDays();
    return result;
  });
}

module.exports = {
  registerSettingsIpc,
};
