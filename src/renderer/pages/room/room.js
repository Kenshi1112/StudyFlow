// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Room: ย่อฉาก 1920x1080 ให้พอดีหน้าต่าง, เลือกภาพช่วงเวลา (เช้า/กลางวัน/เย็น/ค่ำ) ตามเวลาเครื่อง
// และขึ้นจุดแดงบน Task Board เมื่อมีงานที่ยังไม่ Completed และเป็น Due Today / Overdue (PROJECT §7, UX Review หัวข้อ Room)
// ห้ามใช้ DOMContentLoaded ลงทะเบียน mount/unmount ที่ window.pages ตามสัญญากับ router.js

'use strict';

(function () {
  const STAGE_W = 1920;
  const STAGE_H = 1080;

  const REFRESH_MS = 60 * 1000; // โหลดงานซ้ำทุก 1 นาที (deadline_state เปลี่ยนตามวันเมื่อข้ามเที่ยงคืน)

  let root = null;
  let timer = null;
  let alertSeq = 0; // กันผลของคำขอเก่ามาทับคำขอใหม่ (โหลดซ้อนกัน)

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

  // นับงานที่ต้องสนใจจาก tasks:list (Backend คำนวณ deadline_state ให้แล้ว เหมือนที่ Task Board กับ Dashboard ใช้ จึงตรงกันเสมอ)
  // ตัวอย่าง: [due_today, overdue, overdue(completed), upcoming] -> { dueToday: 1, overdue: 1 }
  function countAttention(tasks) {
    const count = { dueToday: 0, overdue: 0 };
    for (const task of tasks) {
      if (task.status === 'completed') continue;
      if (task.deadline_state === 'due_today') count.dueToday += 1;
      else if (task.deadline_state === 'overdue') count.overdue += 1;
    }
    return count;
  }

  // ข้อความที่ป้ายตอนเมาส์ชี้ (และ screen reader) เช่น "Task Board · 2 due today · 1 overdue" ไม่มีงานเข้าเงื่อนไข = "Task Board"
  function boardLabel({ dueToday, overdue }) {
    const parts = ['Task Board'];
    if (dueToday > 0) parts.push(`${dueToday} due today`);
    if (overdue > 0) parts.push(`${overdue} overdue`);
    return parts.join(' \u00b7 ');
  }

  // โหลดงานเงียบ ๆ แล้วอัปเดตจุดแดง โหลดไม่สำเร็จ (ยังไม่มี Backend ฯลฯ) = คงสถานะเดิม ไม่กระพริบ ไม่แจ้ง error
  async function refreshAlert() {
    const api = window.apiClient;
    if (!root || !api) return;
    const seq = (alertSeq += 1);
    let tasks;
    try {
      tasks = await api.invoke('tasks:list');
    } catch (err) {
      return;
    }
    if (!root || seq !== alertSeq || !Array.isArray(tasks)) return;
    const count = countAttention(tasks);
    const board = root.querySelector('.room__hotspot--board');
    board.classList.toggle('has-alert', count.dueToday + count.overdue > 0);
    board.setAttribute('aria-label', boardLabel(count));
  }

  function refreshAlertQuietly() {
    if (document.visibilityState === 'hidden') return;
    refreshAlert();
  }

  window.pages.room = {
    mount(rootEl) {
      root = rootEl;
      applyScale();
      applyTime();
      window.addEventListener('resize', applyScale);
      timer = setInterval(() => {
        applyTime();
        refreshAlertQuietly();
      }, REFRESH_MS);
      refreshAlert();
      window.addEventListener('focus', refreshAlertQuietly);
      document.addEventListener('visibilitychange', refreshAlertQuietly);
    },
    unmount() {
      window.removeEventListener('resize', applyScale);
      window.removeEventListener('focus', refreshAlertQuietly);
      document.removeEventListener('visibilitychange', refreshAlertQuietly);
      clearInterval(timer);
      timer = null;
      root = null;
    },
  };
})();
