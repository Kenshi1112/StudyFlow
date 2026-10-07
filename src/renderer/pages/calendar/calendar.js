// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Calendar
// TODO: เรียก backend ผ่าน window.api เท่านั้น

'use strict';

// สัญญากับ router.js: ลงทะเบียน mount/unmount ที่ window.pages ห้ามใช้ DOMContentLoaded
// เพราะสคริปต์นี้ถูกโหลดตอนสลับหน้า ไม่ใช่ตอนเปิดหน้าต่าง
// mount(root, params): root คือ element ของหน้านี้ใน #app, params มาจาก query ของ hash
// unmount(): ล้าง timer / listener ที่หน้านี้ตั้งไว้ (router ไม่เก็บให้)
(function () {
  window.pages['calendar'] = {
    mount(root, params) {
      // เรียก backend ผ่าน window.api.invoke(...) เท่านั้น ห้ามแตะ DB ตรง
    },
    unmount() {},
  };
})();
