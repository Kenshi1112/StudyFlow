// Owner: Shared (ต้องคุยกันก่อนแก้)
// หน้าที่: สะพานเดียวระหว่าง renderer กับ main — เปิดให้ใช้เฉพาะ channel ที่ประกาศใน src/shared/ipc-channels.js
// TODO: เพิ่ม helper เมื่อ Frontend/Backend ตกลงกันแล้วว่าต้องใช้
'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const { IPC, EVENTS } = require('../shared/ipc-channels');

const invokeChannels = new Set(Object.values(IPC).flatMap((group) => Object.values(group)));
const eventChannels = new Set(Object.values(EVENTS));

contextBridge.exposeInMainWorld('api', {
  // รายชื่อ channel ให้ renderer อ้างอิง: window.api.channels.IPC.TASKS.LIST
  channels: { IPC, EVENTS },

  // renderer -> main (request/response)
  invoke(channel, payload) {
    if (!invokeChannels.has(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, payload);
  },

  // main -> renderer (event) คืนฟังก์ชันสำหรับยกเลิกการ subscribe
  on(channel, listener) {
    if (!eventChannels.has(channel)) {
      throw new Error(`IPC event not allowed: ${channel}`);
    }
    const handler = (_event, data) => listener(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
