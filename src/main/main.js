// Owner: Backend
// หน้าที่: entry point ของ Electron main process — เปิดหน้าต่างหลัก (ตอนนี้เป็นหน้าต่างเปล่า)
// TODO: เรียก initDatabase(), registerAllIpc(), startScheduler(), startSync() เมื่อ service พร้อม
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');

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

  return win;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
