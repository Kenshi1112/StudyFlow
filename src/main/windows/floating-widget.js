// Owner: Backend
// หน้าที่: สร้าง/ปิด BrowserWindow ตัวที่ 2 (floating widget, always-on-top) ของ Pomodoro
// widget แสดงผลอย่างเดียว (PROJECT_v0.15 section 15.4): ขอ state ผ่าน pomodoro:get-state ตอนเปิด แล้วฟัง event pomodoro:state-changed

'use strict';

const path = require('path');
const { BrowserWindow } = require('electron');

// หน้าต่าง widget ที่เปิดอยู่ (null = ไม่มี)
let widgetWindow = null;

// เปิด widget ถ้าเปิดอยู่แล้วไม่ทำอะไร ใช้ preload ตัวเดียวกับหน้าต่างหลักเพื่อให้มี window.api
// ขนาดเล็ก + กรอบหน้าต่างปกติ (ผู้ใช้ลากย้ายได้เลย) หน้าตาข้างในเป็นของฝั่ง Frontend (widget.html)
function createFloatingWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) return;

  widgetWindow = new BrowserWindow({
    width: 280,
    height: 140,
    alwaysOnTop: true,
    resizable: false,
    title: 'StudyFlow - Pomodoro',
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // เหมือนหน้าต่างหลัก: preload ต้อง require ../shared/ipc-channels
    },
  });
  widgetWindow.setMenuBarVisibility(false);
  widgetWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'widget', 'widget.html'));
  widgetWindow.on('closed', () => {
    widgetWindow = null; // ผู้ใช้ปิด widget เอง timer ไม่หยุด
  });
}

// ปิด widget ตอน batch จบ / หยุด
function closeFloatingWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.close();
  widgetWindow = null;
}

module.exports = {
  createFloatingWidget,
  closeFloatingWidget,
};
