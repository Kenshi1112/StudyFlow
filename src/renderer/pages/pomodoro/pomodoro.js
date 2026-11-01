// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Pomodoro (Figma node 412:63, spec §15)
// หน้านี้ไม่นับเวลาเอง: timer อยู่ใน main process (Backend) หน้านี้แค่สั่งงานและแสดงผลตาม State ที่ได้
//   - ตอนเปิดหน้า เรียก pomodoro:get-state (ถ้ามี batch วิ่งอยู่แล้วจะแสดงหน้านับเวลาต่อทันที)
//   - ฟัง event pomodoro:state-changed (ส่งทุก 1 วินาทีขณะ running) แล้ว render จาก remaining_seconds
//   - ส่งคำสั่ง pomodoro:start-batch { task_id, session_total } / pause / resume / stop
//   - ความยาว Focus/Break อ่านจาก settings:get (pomodoro_focus_minutes / pomodoro_break_minutes) ไว้ preview เวลารวมเท่านั้น
// State ตาม docs/ipc-contract.md: { status: idle|running|paused, phase: focus|break|null, task_id, batch_id,
//   session_index, session_total, phase_total_seconds, remaining_seconds }

'use strict';

(function () {
  const api = window.apiClient;
  const MIN_N = 1;
  const MAX_N = 12;
  const DEFAULT_FOCUS = 25;
  const DEFAULT_BREAK = 5;

  let root = null;
  let taskId = null; // task จาก URL (#/pomodoro?task=<id>)
  let task = null; // task ที่แสดงอยู่ (ของ URL หรือของ batch ที่กำลังวิ่ง)
  let n = 4;
  let focusMin = DEFAULT_FOCUS;
  let breakMin = DEFAULT_BREAK;
  let alive = false;

  let running = false; // กำลังแสดงหน้านับเวลาอยู่หรือไม่
  let finished = false; // batch จบครบทุกรอบแล้ว (Backend ส่ง idle มาหลังเคยวิ่ง)
  let stopping = false; // ผู้ใช้กดหยุดเอง (ไม่นับเป็นจบครบ)
  let last = null; // State ล่าสุดที่เป็น running/paused
  let offState = null;
  let cleanups = [];

  const $ = (s) => root.querySelector(s);

  function say(text) {
    const box = $('#pm-msg');
    box.textContent = text || '';
    box.hidden = !text;
  }

  function errText(err) {
    return String((err && err.message) || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  }

  function listen(target, type, fn) {
    target.addEventListener(type, fn);
    cleanups.push(() => target.removeEventListener(type, fn));
  }

  // เวลารวมของ batch = รอบ x focus + (รอบ - 1) x break (ไม่มี break หลังรอบสุดท้าย)
  function fmtTotal(sessions) {
    const mins = sessions * focusMin + (sessions - 1) * breakMin;
    return `= ${Math.floor(mins / 60)}h ${mins % 60}m total (${focusMin} min focus + ${breakMin} min break each)`;
  }

  function mmss(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function taskLabel() {
    if (!task) return 'ไม่พบงานนี้';
    return task.course_name ? `${task.title} | ${task.course_name}` : task.title;
  }

  // --- หน้าเลือกรอบ ---
  function renderSetup() {
    $('#pm-count').textContent = String(n);
    $('#pm-total').textContent = fmtTotal(n);
    $('#pm-minus').disabled = n <= MIN_N;
    $('#pm-plus').disabled = n >= MAX_N;
    root.querySelectorAll('.pm__preset').forEach((b) => b.classList.toggle('is-on', Number(b.dataset.n) === n));
    $('#pm-start').disabled = !task;
  }

  function setN(v) {
    n = Math.min(MAX_N, Math.max(MIN_N, v));
    renderSetup();
  }

  // --- หน้านับเวลา (render จาก State ของ Backend) ---
  function renderStreaks(total, index) {
    const box = $('#pm-streaks');
    box.replaceChildren();
    for (let i = 1; i <= total; i += 1) {
      const bar = document.createElement('span');
      const done = i <= index || finished; // ตาม Figma: รอบปัจจุบันนับเป็นขีดเต็ม (Session 2 of 4 = 2 ขีด)
      bar.className = `pm__streak${done ? ' is-done' : ''}`;
      box.appendChild(bar);
    }
  }

  function renderRun() {
    const s = last;
    if (!s) return;
    const total = s.session_total || n;
    const isBreak = !finished && s.phase === 'break';
    $('#pm-pill').textContent = finished ? 'All sessions done' : `Session ${s.session_index} of ${total}`;
    const label = $('#pm-phase');
    label.textContent = finished ? 'Well done!' : isBreak ? 'Break time' : 'Focus time';
    label.classList.toggle('is-break', finished || isBreak);
    $('#pm-hint').textContent = finished
      ? 'Nice work. You can go back to your Task Board.'
      : 'You can close this window. We’ll notify you when it’s time for a break.';
    $('#pm-time').textContent = finished ? '00:00' : mmss(s.remaining_seconds);
    const paused = !finished && s.status === 'paused';
    const toggle = $('#pm-toggle');
    toggle.hidden = finished;
    toggle.classList.toggle('is-paused', paused);
    toggle.setAttribute('aria-label', paused ? 'เริ่มต่อ' : 'หยุดชั่วคราว');
    $('#pm-stop').textContent = finished ? 'Back to Task Board' : 'Stop session';
    $('#pm-widget').hidden = finished;
    renderStreaks(total, s.session_index);
  }

  function showRun() {
    if (!running) {
      running = true;
      $('#pm-setup').hidden = true;
      $('#pm-run').hidden = false;
    }
    $('#pm-task-run').textContent = taskLabel();
    renderRun();
  }

  async function loadTask(id) {
    if (!id) return null;
    try {
      const list = await api.invoke('tasks:list');
      return (Array.isArray(list) ? list : []).find((t) => String(t.id) === String(id)) || null;
    } catch (err) {
      return null;
    }
  }

  // รับ State จาก Backend ทั้งจากคำสั่ง, get-state และ event
  async function applyState(s) {
    if (!alive || !s || typeof s !== 'object') return;
    if (s.status === 'running' || s.status === 'paused') {
      last = s;
      finished = false;
      // batch ที่วิ่งอยู่อาจเป็นของ task อื่นที่ไม่ใช่ใน URL: โหลดชื่อ task ของ batch จริงมาแสดง
      if (!task || String(task.id) !== String(s.task_id)) {
        const t = await loadTask(s.task_id);
        if (!alive) return;
        task = t;
      }
      showRun();
      return;
    }
    // idle: ถ้าเคยวิ่งอยู่และผู้ใช้ไม่ได้กดหยุดเอง แปลว่า batch จบครบทุกรอบ
    if (running && !stopping) {
      finished = true;
      renderRun();
    }
  }

  async function loadSettings() {
    try {
      const res = await api.invoke('settings:get');
      if (res && Number.isFinite(res.pomodoro_focus_minutes) && res.pomodoro_focus_minutes >= 1) focusMin = res.pomodoro_focus_minutes;
      if (res && Number.isFinite(res.pomodoro_break_minutes) && res.pomodoro_break_minutes >= 1) breakMin = res.pomodoro_break_minutes;
    } catch (err) {
      // ไม่มี handler: ใช้ค่า default 25/5 เหมือน Backend
    }
  }

  // เปิด floating widget กลับมา (Backend: pomodoro:show-widget)
  async function showWidget() {
    try {
      await api.invoke('pomodoro:show-widget');
    } catch (err) {
      say(errText(err));
    }
  }

  async function start() {
    if (!task) return;
    const btn = $('#pm-start');
    btn.disabled = true;
    say('');
    try {
      const s = await api.invoke('pomodoro:start-batch', { task_id: task.id, session_total: n });
      await applyState(s);
    } catch (err) {
      say(errText(err));
      btn.disabled = false;
    }
  }

  async function togglePause() {
    if (!running || finished || !last) return;
    const channel = last.status === 'paused' ? 'pomodoro:resume' : 'pomodoro:pause';
    try {
      await applyState(await api.invoke(channel));
    } catch (err) {
      say(errText(err));
    }
  }

  async function stop() {
    if (running && !finished) {
      stopping = true;
      try {
        await api.invoke('pomodoro:stop');
      } catch (err) {
        // ไปหน้า Task Board ต่อได้เสมอ
      }
    }
    location.hash = '#/task-board';
  }

  window.pages['pomodoro'] = {
    async mount(el, params) {
      root = el;
      alive = true;
      running = false;
      finished = false;
      stopping = false;
      last = null;
      cleanups = [];
      taskId = params && params.task ? params.task : null;
      n = 4;
      listen($('#pm-minus'), 'click', () => setN(n - 1));
      listen($('#pm-plus'), 'click', () => setN(n + 1));
      root.querySelectorAll('.pm__preset').forEach((b) => listen(b, 'click', () => setN(Number(b.dataset.n))));
      listen($('#pm-start'), 'click', start);
      listen($('#pm-toggle'), 'click', togglePause);
      listen($('#pm-stop'), 'click', stop);
      listen($('#pm-widget'), 'click', showWidget);

      // subscribe ก่อนขอ state ตั้งต้น (ตามที่ contract แนะนำ) event ที่มาก่อนขอ state ก็ไม่หาย
      if (window.api && typeof window.api.on === 'function') {
        try {
          offState = window.api.on('pomodoro:state-changed', applyState);
        } catch (err) {
          console.warn('[pomodoro] subscribe pomodoro:state-changed ไม่ได้', err);
        }
      }

      renderSetup();
      await loadSettings();
      if (!alive) return;
      renderSetup();
      task = await loadTask(taskId);
      if (!alive) return;
      $('#pm-task-setup').textContent = taskLabel();
      if (!taskId) say('เปิดหน้านี้จากปุ่ม Start Working ของ task เท่านั้น');
      else if (!task) say('ไม่พบ task นี้');
      renderSetup();

      // ถ้ามี batch วิ่งอยู่แล้ว (เช่นกลับมาหน้านี้ระหว่างจับเวลา) แสดงหน้านับเวลาต่อ
      try {
        await applyState(await api.invoke('pomodoro:get-state'));
      } catch (err) {
        // Backend ยังไม่มี handler: ค้างที่หน้าเลือกรอบ ปุ่ม Start จะแจ้ง error เอง
      }
    },
    unmount() {
      // ออกจากหน้าไม่ได้หยุด session: Backend/widget ถือสถานะจริง หน้านี้แค่เลิกฟัง event
      alive = false;
      if (offState) offState();
      offState = null;
      cleanups.forEach((fn) => fn());
      cleanups = [];
      root = null;
    },
  };
})();
