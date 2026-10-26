// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Pomodoro (Figma node 412:63, spec §15)
// ตัวเลขเวลาแสดงผลนับในหน้านี้เอง (Focus 25 / Break 5 ตายตัว: spec ยังไม่มี setting ความยาว) ส่วนการบันทึก session,
// set first_started_at / last_focus_started_at, แจ้งเตือน OS และ floating widget เป็นของ Backend
// ส่งคำสั่งไป pomodoro:start-batch / pause / resume / stop (payload ยังไม่กำหนดใน ipc-contract: ส่ง { task_id, session_total })
// ถ้า Backend ยังไม่มี handler หน้านี้ยังนับเวลาให้ดูได้ (โหมดตัวอย่าง) และมีข้อความบอก

'use strict';

(function () {
  const api = window.apiClient;
  const FOCUS_MS = 25 * 60 * 1000;
  const BREAK_MS = 5 * 60 * 1000;
  const MIN_N = 1;
  const MAX_N = 12;

  let root = null;
  let taskId = null;
  let task = null;
  let n = 4;
  let alive = false;

  // สถานะนับเวลา
  let timer = null;
  let session = 1;
  let phase = 'focus'; // focus | break | done
  let endsAt = 0;
  let remaining = 0; // ใช้ตอน pause
  let paused = false;
  let cleanups = [];

  const $ = (s) => root.querySelector(s);

  function say(text) {
    const box = $('#pm-msg');
    box.textContent = text || '';
    box.hidden = !text;
  }

  function listen(target, type, fn) {
    target.addEventListener(type, fn);
    cleanups.push(() => target.removeEventListener(type, fn));
  }

  function fmtTotal(sessions) {
    const mins = sessions * 30;
    return `= ${Math.floor(mins / 60)}h ${mins % 60}m total (25 min focus + 5 min break each)`;
  }

  function mmss(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
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

  // --- หน้านับเวลา ---
  function renderStreaks() {
    const box = $('#pm-streaks');
    box.replaceChildren();
    for (let i = 1; i <= n; i += 1) {
      const bar = document.createElement('span');
      const done = i <= session || phase === 'done'; // ตาม Figma: รอบปัจจุบันนับเป็นขีดเต็ม (Session 2 of 4 = 2 ขีด)
      bar.className = `pm__streak${done ? ' is-done' : ''}`;
      box.appendChild(bar);
    }
  }

  function renderRun() {
    $('#pm-pill').textContent = phase === 'done' ? 'All sessions done' : `Session ${session} of ${n}`;
    const label = $('#pm-phase');
    label.textContent = phase === 'focus' ? 'Focus time' : phase === 'break' ? 'Break time' : 'Well done!';
    label.classList.toggle('is-break', phase !== 'focus');
    $('#pm-hint').textContent =
      phase === 'done'
        ? 'Nice work. You can go back to your Task Board.'
        : 'You can close this window. We\u2019ll notify you when it\u2019s time for a break.';
    $('#pm-toggle').hidden = phase === 'done';
    $('#pm-stop').textContent = phase === 'done' ? 'Back to Task Board' : 'Stop session';
    renderStreaks();
    tick();
  }

  function tick() {
    if (phase === 'done') {
      $('#pm-time').textContent = '00:00';
      return;
    }
    const left = paused ? remaining : endsAt - Date.now();
    $('#pm-time').textContent = mmss(left);
    if (!paused && left <= 0) nextPhase();
  }

  function nextPhase() {
    if (phase === 'focus') {
      phase = 'break';
      endsAt = Date.now() + BREAK_MS;
    } else if (session < n) {
      session += 1;
      phase = 'focus';
      endsAt = Date.now() + FOCUS_MS;
    } else {
      phase = 'done';
      clearInterval(timer);
      timer = null;
    }
    renderRun();
  }

  function call(channel, payload) {
    return api.invoke(channel, payload).catch(() => null); // คำสั่งหยุด/ต่อ ไม่ให้ UI พังถ้า Backend ยังไม่มี handler
  }

  async function start() {
    if (!task) return;
    const btn = $('#pm-start');
    btn.disabled = true;
    say('');
    try {
      await api.invoke('pomodoro:start-batch', { task_id: task.id, session_total: n });
    } catch (err) {
      if (!/No handler registered/i.test(String((err && err.message) || err))) {
        say(String((err && err.message) || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
        btn.disabled = false;
        return;
      }
      // Backend ยังไม่มี handler: นับเวลาให้ดูเฉยๆ (ไม่มีการบันทึก)
      say('โหมดตัวอย่าง: Backend ยังไม่มี pomodoro:start-batch จึงยังไม่บันทึก session');
    }
    if (!alive) return;
    session = 1;
    phase = 'focus';
    paused = false;
    endsAt = Date.now() + FOCUS_MS;
    $('#pm-setup').hidden = true;
    $('#pm-run').hidden = false;
    $('#pm-task-run').textContent = taskLabel();
    $('#pm-toggle').classList.remove('is-paused');
    renderRun();
    clearInterval(timer);
    timer = setInterval(tick, 250);
  }

  function togglePause() {
    if (phase === 'done') return;
    const btn = $('#pm-toggle');
    if (!paused) {
      remaining = endsAt - Date.now();
      paused = true;
      call('pomodoro:pause');
    } else {
      endsAt = Date.now() + remaining;
      paused = false;
      call('pomodoro:resume');
    }
    btn.classList.toggle('is-paused', paused);
    btn.setAttribute('aria-label', paused ? 'เริ่มต่อ' : 'หยุดชั่วคราว');
    tick();
  }

  function stop() {
    if (phase !== 'done') call('pomodoro:stop');
    clearInterval(timer);
    timer = null;
    location.hash = '#/task-board';
  }

  async function loadTask() {
    if (!taskId) return;
    try {
      const list = await api.invoke('tasks:list');
      task = (Array.isArray(list) ? list : []).find((t) => String(t.id) === String(taskId)) || null;
    } catch (err) {
      task = null;
    }
  }

  window.pages['pomodoro'] = {
    async mount(el, params) {
      root = el;
      alive = true;
      cleanups = [];
      taskId = params && params.task ? params.task : null;
      n = 4;
      listen($('#pm-minus'), 'click', () => setN(n - 1));
      listen($('#pm-plus'), 'click', () => setN(n + 1));
      root.querySelectorAll('.pm__preset').forEach((b) => listen(b, 'click', () => setN(Number(b.dataset.n))));
      listen($('#pm-start'), 'click', start);
      listen($('#pm-toggle'), 'click', togglePause);
      listen($('#pm-stop'), 'click', stop);
      renderSetup();
      await loadTask();
      if (!alive) return;
      $('#pm-task-setup').textContent = taskLabel();
      if (!taskId) say('เปิดหน้านี้จากปุ่ม Start Working ของ task เท่านั้น');
      else if (!task) say('ไม่พบ task นี้');
      renderSetup();
    },
    unmount() {
      // ออกจากหน้าไม่ได้หยุด session: Backend/widget ถือสถานะจริง หน้านี้แค่ปิดตัวแสดงผลของตัวเอง
      alive = false;
      clearInterval(timer);
      timer = null;
      cleanups.forEach((fn) => fn());
      cleanups = [];
      root = null;
    },
  };
})();
