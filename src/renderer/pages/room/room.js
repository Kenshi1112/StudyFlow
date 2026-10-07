// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Room: ย่อฉาก 1920x1080 ให้พอดีหน้าต่าง และเลือกภาพช่วงเวลา (เช้า/กลางวัน/เย็น/ค่ำ) ตามเวลาเครื่อง
// ห้ามใช้ DOMContentLoaded ลงทะเบียน mount/unmount ที่ window.pages ตามสัญญากับ router.js

'use strict';

(function () {
  const STAGE_W = 1920;
  const STAGE_H = 1080;

  let root = null;
  let timer = null;

  // ช่วงเวลา: ยังไม่มีในสเปก เป็นสมมติฐานชั่วคราวของ Frontend (ถามทีมถ้าต้องการเปลี่ยน)
  function timeOfDay(date) {
    const h = date.getHours();
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 16) return 'noon';
    if (h >= 16 && h < 19) return 'evening';
    return 'night';
  }

  function applyScale() {
    if (!root) return;
    const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    root.style.setProperty('--room-scale', String(scale));
    root.style.setProperty('--room-x', `${(window.innerWidth - STAGE_W * scale) / 2}px`);
    root.style.setProperty('--room-y', `${(window.innerHeight - STAGE_H * scale) / 2}px`);
  }

  function applyTime() {
    if (!root) return;
    const time = timeOfDay(new Date());
    const stage = root.querySelector('#room-stage');
    if (stage.dataset.time === time && stage.dataset.applied) return;
    stage.dataset.time = time;
    stage.dataset.applied = '1';
    for (const img of root.querySelectorAll('img[data-variant]')) {
      img.src = `assets/room/${img.dataset.variant}-${time}.png`;
    }
  }

  window.pages.room = {
    mount(rootEl) {
      root = rootEl;
      applyScale();
      applyTime();
      window.addEventListener('resize', applyScale);
      timer = setInterval(applyTime, 60 * 1000);
    },
    unmount() {
      window.removeEventListener('resize', applyScale);
      clearInterval(timer);
      timer = null;
      root = null;
    },
  };
})();
