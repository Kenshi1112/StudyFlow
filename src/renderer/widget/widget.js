// Owner: Frontend
// หน้าที่: อัปเดตหน้า widget จาก state ที่ได้รับผ่าน IPC
// TODO: subscribe event pomodoro:state-changed ผ่าน window.api.on

'use strict';

// เรียก backend ผ่าน window.api.invoke(...) เท่านั้น ห้ามแตะ DB ตรง
function init() {}

document.addEventListener('DOMContentLoaded', init);
