// Owner: Backend
// หน้าที่: entry point ของ Electron main process — เปิด DB, ลงทะเบียน IPC, เปิดหน้าต่างหลัก
// TODO: เรียก startScheduler() (ข้อ 5), startSync() (ข้อ 7) เมื่อ service พร้อม
'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { initDatabase, closeDatabase } = require('./db/database');
const { registerAllIpc } = require('./ipc');

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

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  // เปิด DB และลงทะเบียน IPC ก่อนเปิดหน้าต่าง เพราะหน้าจอเรียก window.api.invoke ได้ตั้งแต่โหลดหน้า
  try {
    initDatabase();
    registerAllIpc(ipcMain);
  } catch (error) {
    dialog.showErrorBox('StudyFlow', `เปิดฐานข้อมูลไม่สำเร็จ\n\n${error.message}`);
    app.quit();
    return;
  }

  createMainWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  closeDatabase();
});
