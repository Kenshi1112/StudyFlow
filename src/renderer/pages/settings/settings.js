// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Settings (Figma node 403:64)
// เรียก backend ผ่าน window.apiClient.invoke เท่านั้น
// ส่วนที่ Backend มีจริง: settings:get / settings:set (reminder_window_days, pomodoro_focus_minutes, pomodoro_break_minutes, classroom_cutoff_date)
// ปุ่ม Save Change ของ Pomodoro บันทึก Focus/Break ผ่าน settings:set ทีละ key (ใช้ตอนกด Start Working ของ batch ถัดไป)
// LINE (§14.2) ใช้ line:get-status / line:generate-code / line:disconnect ตาม docs/ipc-contract.md
// ส่วนที่ยังไม่มี Backend (toggle แจ้งเตือน) เป็น UI อย่างเดียว ยังไม่บันทึก

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
    // การ์ด Account แสดงบัญชี Google Classroom ที่เชื่อมอยู่ (Backend ส่งมาแค่ account_email)
    const email = on && classroom.account_email ? classroom.account_email : null;
    $('#st-name').textContent = on ? email || 'Google account' : 'Not connected';
    $('#st-avatar').textContent = email ? email.charAt(0).toUpperCase() : 'G';
    $('#st-cls-account').textContent = on && classroom.account_email ? classroom.account_email : '\u2014';
    $('#st-cls-sync').textContent = on && classroom.last_synced_at ? fmtWhen(classroom.last_synced_at) : '\u2014';
    renderLine();
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
        await api.invoke('classroom:disconnect');
        // Disconnect แล้วล้างวัน cutoff ด้วย: Connect ครั้งหน้าจะเด้งป๊อปอัปให้เลือกวันใหม่ (Backend ไม่ล้างให้ ตาม §13.4)
        // งานที่เคยเห็นแล้วยังอยู่ใน classroom_sync_state จึงไม่ถูกดึงซ้ำ
        await api.invoke('settings:set', { key: 'classroom_cutoff_date', value: null });
        classroom = await api.invoke('classroom:get-status');
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


  // ---------- LINE (spec §14.2) ----------
  // line:get-status -> { connected, linked_at } / line:generate-code -> { code, expires_at } / line:disconnect
  // ไม่มี event ตอนผูกสำเร็จ: poll line:get-status ทุก 3 วินาทีระหว่างโชว์โค้ด
  // โค้ดที่รอผูก (code + expires_at) เก็บระดับโมดูลเพราะ router ถอดหน้าตอนสลับหน้า
  const LINE_DEFAULT_HINT = 'Add our LINE account as a friend, then send a one-time code to link it';
  let line = { connected: false, linked_at: null };
  let linePending = null; // { code, expires_at(ms) }
  let linePoll = null;
  let lineTick = null;

  function stopLineTimers() {
    clearInterval(linePoll);
    clearInterval(lineTick);
    linePoll = null;
    lineTick = null;
  }

  function cleanMsg(err) {
    return String((err && err.message) || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  }

  function fmtCountdown(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function renderLine() {
    if (!root) return;
    const hint = $('#st-line-hint');
    const btn = $('#st-line-btn');
    const googleOn = Boolean(classroom && classroom.connected);
    $('#st-line-status').textContent = line.connected ? 'Connected' : 'Not Connected';
    hint.textContent = '';
    if (line.connected) {
      hint.textContent = line.linked_at ? `Linked since ${fmtWhen(line.linked_at)}` : 'Linked';
      btn.textContent = '[ Disconnect LINE ]';
      btn.disabled = false;
    } else if (linePending) {
      hint.append('Send this code to our LINE account within ' + fmtCountdown(linePending.expires_at - Date.now()));
      const code = document.createElement('span');
      code.className = 'st__line-code';
      code.textContent = linePending.code;
      hint.append(code);
      btn.textContent = '[ Show code ]';
      btn.disabled = false;
    } else {
      hint.textContent = googleOn ? LINE_DEFAULT_HINT : 'Connect Google Classroom first, LINE uses the same Google account';
      btn.textContent = '[ Connect LINE ]';
      btn.disabled = !googleOn;
    }
    // ป๊อปอัปโค้ด: อัปเดตโค้ด/เวลา ปิดเองเมื่อผูกสำเร็จหรือโค้ดหมดอายุ
    const dlg = $('#st-line-dlg');
    if (linePending) {
      $('#st-line-dlg-code').textContent = linePending.code;
      $('#st-line-dlg-timer').textContent = `Code expires in ${fmtCountdown(linePending.expires_at - Date.now())}`;
    } else if (dlg.open) {
      dlg.close();
    }
  }

  async function loadLine() {
    try {
      line = await api.invoke('line:get-status');
    } catch (err) {
      // ออฟไลน์/ไม่มี handler: คงสถานะเดิม
    }
    if (line && line.connected) {
      linePending = null;
      stopLineTimers();
    }
    renderLine();
  }

  function startLinePolling() {
    stopLineTimers();
    if (!linePending) return;
    // นับถอยหลังทุกวินาที หมดเวลา = ล้างโค้ด
    lineTick = setInterval(() => {
      if (!linePending || Date.now() >= linePending.expires_at) {
        linePending = null;
        stopLineTimers();
      }
      renderLine();
    }, 1000);
    linePoll = setInterval(loadLine, 3000);
  }

  function openLineDialog() {
    const dlg = $('#st-line-dlg');
    if (linePending && !dlg.open) dlg.showModal();
  }

  async function requestLineCode() {
    const res = await api.invoke('line:generate-code');
    const exp = Date.parse(res.expires_at);
    linePending = { code: res.code, expires_at: Number.isNaN(exp) ? Date.now() + 10 * 60 * 1000 : exp };
    startLinePolling();
    renderLine();
    openLineDialog();
  }

  async function toggleLine() {
    const btn = $('#st-line-btn');
    btn.disabled = true;
    note('');
    try {
      if (line.connected) {
        line = await api.invoke('line:disconnect');
        linePending = null;
        stopLineTimers();
      } else if (linePending && Date.now() < linePending.expires_at) {
        openLineDialog(); // มีโค้ดค้างอยู่แล้ว เปิดป๊อปอัปให้ดูอีกครั้ง
      } else {
        await requestLineCode();
      }
    } catch (err) {
      note(`LINE: ${cleanMsg(err)}`);
    } finally {
      renderLine();
    }
  }

  async function newLineCode() {
    const btn = $('#st-line-dlg-new');
    btn.disabled = true;
    try {
      await requestLineCode();
    } catch (err) {
      $('#st-line-dlg').close();
      note(`LINE: ${cleanMsg(err)}`);
    } finally {
      if (root) btn.disabled = false;
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
      listen($('#st-line-btn'), 'click', toggleLine);
      listen($('#st-line-dlg-new'), 'click', newLineCode);
      listen($('#st-line-dlg-close'), 'click', () => $('#st-line-dlg').close());
      loadSettings();
      // LINE ต้องรู้ว่าเชื่อม Google แล้วหรือยัง จึงรอ classroom status ก่อน render
      loadClassroom().then(() => {
        renderLine();
        loadLine();
        if (linePending && Date.now() < linePending.expires_at) startLinePolling();
        else linePending = null;
      });
    },
    unmount() {
      stopLineTimers();
      if (root) { const d = $('#st-line-dlg'); if (d && d.open) d.close(); }
      cleanups.forEach((fn) => fn());
      cleanups = [];
      root = null;
    },
  };
})();
