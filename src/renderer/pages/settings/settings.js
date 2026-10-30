// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Settings (Figma node 403:64)
// เรียก backend ผ่าน window.apiClient.invoke เท่านั้น
// ส่วนที่ Backend มีจริง: settings:get / settings:set (reminder_window_days, pomodoro_focus_minutes, pomodoro_break_minutes, classroom_cutoff_date)
// ปุ่ม Save Change ของ Pomodoro บันทึก Focus/Break ผ่าน settings:set ทีละ key (ใช้ตอนกด Start Working ของ batch ถัดไป)
// ส่วนที่ยังไม่มี Backend (LINE connect, โปรไฟล์, Sign out, toggle แจ้งเตือน) เป็น UI อย่างเดียว ยังไม่บันทึก

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

  async function loadSettings() {
    try {
      // settings:get คืน object ของทุก key (ตาม settings.service ของ Backend) ถ้ารูปแบบต่างไปจะข้าม ไม่พัง
      const res = await api.invoke('settings:get');
      if (!root || !res || typeof res !== 'object') return;
      const days = res.reminder_window_days;
      if (Number.isFinite(days) && days >= 1) {
        $('#st-reminder-desc').textContent = `Notify ${days * 24} hours before due dates`;
      }
      if (Number.isInteger(res.pomodoro_focus_minutes) && res.pomodoro_focus_minutes >= 1) $('#st-focus').value = res.pomodoro_focus_minutes;
      if (Number.isInteger(res.pomodoro_break_minutes) && res.pomodoro_break_minutes >= 1) $('#st-break').value = res.pomodoro_break_minutes;
    } catch (err) {
      // ไม่มี handler / mock: คงข้อความและค่าตาม Figma
    }
  }

  function errText(err) {
    return String((err && err.message) || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  }

  // อ่านค่าจากช่องตัวเลข: ต้องเป็นจำนวนเต็มในช่วง min-max ของช่อง ไม่งั้นคืน null
  function readMinutes(id) {
    const input = $(id);
    const v = Number(input.value);
    const min = Number(input.min) || 1;
    const max = Number(input.max) || 999;
    return input.value.trim() !== '' && Number.isInteger(v) && v >= min && v <= max ? v : null;
  }

  async function savePomodoro() {
    const focus = readMinutes('#st-focus');
    const brk = readMinutes('#st-break');
    if (focus === null) return note(`Focus Duration ต้องเป็นจำนวนเต็ม ${$('#st-focus').min}-${$('#st-focus').max} นาที`);
    if (brk === null) return note(`Break Duration ต้องเป็นจำนวนเต็ม ${$('#st-break').min}-${$('#st-break').max} นาที`);
    const btn = $('#st-save');
    btn.disabled = true;
    note('');
    try {
      await api.invoke('settings:set', { key: 'pomodoro_focus_minutes', value: focus });
      await api.invoke('settings:set', { key: 'pomodoro_break_minutes', value: brk });
      note('บันทึกแล้ว ใช้กับ Pomodoro batch ถัดไป');
    } catch (err) {
      note(`บันทึกไม่สำเร็จ: ${errText(err)}`);
    } finally {
      if (root) btn.disabled = false;
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
    pending('#st-line-btn', 'การเชื่อม LINE ยังไม่พร้อม รอ Backend');
    pending('#st-signout', 'Sign out ยังไม่พร้อม รอ Backend');
    pending('#st-edit-profile', 'Edit Profile ยังไม่พร้อม');
    listen($('#st-save'), 'click', savePomodoro);
  }

  // ---------- Google Classroom (spec §13.1) ----------
  // payload ตาม docs/ipc-contract.md หัวข้อ classroom:*: classroom:get-status -> { connected, account_email, last_synced_at, cutoff_date }
  // เชื่อมครั้งแรก (ยังไม่มี cutoff) ต้องเลือกวัน cutoff ก่อน fetch แรก -> settings:set { key: 'classroom_cutoff_date', value: ISO }
  let classroom = null;

  function fmtWhen(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '\u2014';
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const h = d.getHours();
    return `${m} ${d.getDate()}, ${d.getFullYear()} ${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  function renderClassroom() {
    const on = Boolean(classroom && classroom.connected);
    $('#st-cls-dot').classList.toggle('is-off', !on);
    const label = $('#st-cls-status');
    label.classList.toggle('is-off', !on);
    label.textContent = on ? 'Connected' : 'Not connected';
    $('#st-cls-account').textContent = on && classroom.account_email ? classroom.account_email : '\u2014';
    $('#st-cls-sync').textContent = on && classroom.last_synced_at ? fmtWhen(classroom.last_synced_at) : '\u2014';
    $('#st-cls-btn').textContent = !on ? '[ Connect ]' : classroom.cutoff_date ? '[ Disconnect ]' : '[ Choose import date ]';
  }

  async function loadClassroom() {
    try {
      classroom = await api.invoke('classroom:get-status');
    } catch (err) {
      classroom = null;
    }
    if (root) renderClassroom();
  }

  function askCutoff() {
    window.ClassroomPopups.cutoff({
      onConfirm: async (date) => {
        await api.invoke('settings:set', { key: 'classroom_cutoff_date', value: date.toISOString() });
        note('');
        loadClassroom();
      },
      onCancel: () => note('ยังไม่ได้เลือกวันเริ่มดึงงาน Classroom จะยังไม่ดึงงานจนกว่าจะเลือก (กด Connect อีกครั้ง)'),
    });
  }

  async function toggleClassroom() {
    const btn = $('#st-cls-btn');
    btn.disabled = true;
    note('');
    try {
      if (classroom && classroom.connected && classroom.cutoff_date) {
        classroom = await api.invoke('classroom:disconnect');
      } else {
        if (!(classroom && classroom.connected)) classroom = await api.invoke('classroom:connect');
        if (classroom && classroom.connected && !classroom.cutoff_date) askCutoff();
      }
    } catch (err) {
      note(`Google Classroom: ${String((err && err.message) || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}`);
    } finally {
      if (root) {
        btn.disabled = false;
        renderClassroom();
      }
    }
  }

  window.pages['settings'] = {
    mount(el) {
      root = el;
      cleanups = [];
      bindNav();
      bindSteppers();
      bindSwitches();
      bindPending();
      listen($('#st-cls-btn'), 'click', toggleClassroom);
      loadSettings();
      loadClassroom();
    },
    unmount() {
      cleanups.forEach((fn) => fn());
      cleanups = [];
      root = null;
    },
  };
})();
