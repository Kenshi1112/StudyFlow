// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Settings (Figma node 403:64)
// เรียก backend ผ่าน window.apiClient.invoke เท่านั้น
// ส่วนที่ spec/Backend มีจริง: settings:get / settings:set (reminder_window_days)
// ส่วนที่ยังไม่มี Backend (Classroom/LINE connect, โปรไฟล์, Pomodoro duration, toggle แจ้งเตือน) เป็น UI อย่างเดียว ยังไม่บันทึก

'use strict';

(function () {
  const api = window.apiClient;
  let root = null;
  let cleanups = [];

  const $ = (s) => root.querySelector(s);

  function note(text) {
    const box = $('#st-error');
    box.textContent = text || '';
    box.hidden = !text;
  }

  function listen(target, type, fn) {
    target.addEventListener(type, fn);
    cleanups.push(() => target.removeEventListener(type, fn));
  }

  async function loadReminderWindow() {
    try {
      // settings:get คืน object ของทุก key (ตาม settings.service ของ Backend) ถ้ารูปแบบต่างไปจะข้าม ไม่พัง
      const res = await api.invoke('settings:get');
      const days = res && typeof res === 'object' ? res.reminder_window_days : undefined;
      if (Number.isFinite(days) && days >= 1) {
        $('#st-reminder-desc').textContent = `Notify ${days * 24} hours before due dates`;
      }
    } catch (err) {
      // ไม่มี handler / mock: คงข้อความตาม Figma
    }
  }

  function bindNav() {
    root.querySelectorAll('.st__nav[data-target]').forEach((btn) => {
      listen(btn, 'click', () => {
        root.querySelectorAll('.st__nav').forEach((b) => b.classList.toggle('is-active', b === btn));
        const target = root.querySelector('#' + btn.dataset.target);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function bindSteppers() {
    root.querySelectorAll('.st__chev').forEach((btn) => {
      listen(btn, 'click', () => {
        const input = root.querySelector('#' + btn.dataset.for);
        const min = Number(input.min) || 1;
        const max = Number(input.max) || 999;
        const next = (Number(input.value) || min) + Number(btn.dataset.step);
        input.value = Math.min(max, Math.max(min, next));
      });
    });
  }

  function bindSwitches() {
    root.querySelectorAll('.st__switch').forEach((sw) => {
      listen(sw, 'click', () => {
        const on = !sw.classList.contains('is-on');
        sw.classList.toggle('is-on', on);
        sw.setAttribute('aria-checked', String(on));
      });
    });
  }

  function bindPending() {
    const pending = (id, text) => listen($(id), 'click', () => note(text));
    pending('#st-cls-btn', 'การเชื่อม/ยกเลิก Google Classroom ยังไม่พร้อม รอ Backend');
    pending('#st-line-btn', 'การเชื่อม LINE ยังไม่พร้อม รอ Backend');
    pending('#st-signout', 'Sign out ยังไม่พร้อม รอ Backend');
    pending('#st-edit-profile', 'Edit Profile ยังไม่พร้อม');
    pending('#st-save', 'ค่า Focus/Break ยังไม่ถูกบันทึก (ยังไม่มีใน spec/Backend)');
  }

  window.pages['settings'] = {
    mount(el) {
      root = el;
      cleanups = [];
      bindNav();
      bindSteppers();
      bindSwitches();
      bindPending();
      loadReminderWindow();
    },
    unmount() {
      cleanups.forEach((fn) => fn());
      cleanups = [];
      root = null;
    },
  };
})();
