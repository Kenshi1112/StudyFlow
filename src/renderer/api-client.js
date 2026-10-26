// Owner: Frontend
// หน้าที่: ตัวกลางเรียก backend ฝั่ง renderer เรียก window.api.invoke เสมอ (ห้ามแตะ DB ตรง)
// ถ้า main ยังไม่ลงทะเบียน handler ของ tasks:* จะสลับไปใช้ข้อมูลจำลองใน dev-mock-tasks.js ให้อัตโนมัติ
// (สลับเฉพาะกรณี "No handler registered" error อื่นโยนต่อตามปกติ) พอ Backend เสร็จก็ไม่ใช้ mock เอง

'use strict';

(function () {
  const real = window.api && typeof window.api.invoke === 'function' ? window.api : null;
  const mock = window.__devMockTasks || null;
  let usingMock = !real;

  function isMissingHandler(err) {
    return /No handler registered/i.test(String((err && err.message) || err));
  }

  async function invoke(channel, payload) {
    if (!real) {
      if (mock && mock.handles(channel)) return mock.invoke(channel, payload);
      throw new Error(`window.api ไม่พร้อมใช้งาน (${channel})`);
    }
    try {
      return await real.invoke(channel, payload);
    } catch (err) {
      if (mock && mock.handles(channel) && isMissingHandler(err)) {
        if (!usingMock) console.warn(`[api-client] Backend ยังไม่มี handler ของ ${channel} ใช้ข้อมูลจำลองแทน`);
        usingMock = true;
        return mock.invoke(channel, payload);
      }
      throw err;
    }
  }

  window.apiClient = { invoke, isMock: () => usingMock };
})();
