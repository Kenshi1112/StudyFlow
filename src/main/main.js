// Owner: Backend
// หน้าที่: entry point ของ Electron main process — เปิด DB, ลงทะเบียน IPC, เปิดหน้าต่างหลัก
'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { initDatabase, closeDatabase } = require('./db/database');
const { registerAllIpc } = require('./ipc');
const pomodoroService = require('./services/pomodoro.service');
const notificationService = require('./services/notification.service');
const classroomSyncService = require('./services/classroom-sync.service');
const cloudSyncService = require('./services/cloud-sync.service');

const isDev = process.argv.includes('--dev');

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // preload ต้อง require ../shared/ipc-channels จึงปิด sandbox เฉพาะ preload (renderer ยังโดน isolate)
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // ปิดหน้าต่างหลัก = ปิดทั้งแอป (ไม่งั้น floating widget ที่ยังเปิดอยู่จะค้างแอปไว้) before-quit จะบันทึก Pomodoro ที่ค้างให้
  win.on('closed', () => app.quit());

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  // Windows ต้องมี AppUserModelId ไม่งั้น OS notification (Pomodoro) บางเครื่องไม่ขึ้น ใช้ค่าเดียวกับ appId ใน package.json
  app.setAppUserModelId('com.studyflow.app');

  // เปิด DB และลงทะเบียน IPC ก่อนเปิดหน้าต่าง เพราะหน้าจอเรียก window.api.invoke ได้ตั้งแต่โหลดหน้า
  try {
    initDatabase();
    registerAllIpc(ipcMain);
    // เช็ค Deadline State ตอนเปิดแอป แล้วเช็คซ้ำทุก 15 นาที (ข้อ 5)
    notificationService.startScheduler();
  } catch (error) {
    dialog.showErrorBox('StudyFlow', `เปิดฐานข้อมูลไม่สำเร็จ\n\n${error.message}`);
    app.quit();
    return;
  }

  createMainWindow();

  // ดึงงานใหม่จาก Classroom 1 ครั้งตอนเปิดแอป (ข้อ 6.6) ไม่รอผล ยังไม่เชื่อมบัญชี/ไม่ตั้ง cutoff = ข้าม, พังแค่ log
  classroomSyncService.fetchOnLaunch();

  // เริ่ม sync tasks/pomodoro_sessions กับ Supabase (ข้อ 7.5): รอบแรกทันที แล้วทุก 5 นาที ยังไม่เชื่อม Google = ข้ามเงียบ ๆ พังแค่ log
  cloudSyncService.startSync();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  // หยุดตัวเช็คแจ้งเตือนก่อนปิด DB ไม่งั้นรอบถัดไปจะอ่าน DB ที่ปิดไปแล้ว
  notificationService.stopScheduler();
  // หยุด sync ก่อนปิด DB เหมือนกัน (timer ทุก 10 วิอ่าน DB อยู่)
  cloudSyncService.stopSync();
  // ปิดแอปกลาง Pomodoro: บันทึกเวลาที่ผ่านไปเป็น completed = 0 (§15.1) ต้องทำก่อนปิด DB
  pomodoroService.stop();
  closeDatabase();
});
