// Owner: Frontend
// หน้าที่: อัปเดตหน้า widget จาก state ที่ได้รับผ่าน IPC (แสดงผลอย่างเดียว spec §15.4)
// ฟัง event pomodoro:state-changed ผ่าน window.api.on และขอ state ตั้งต้นด้วย pomodoro:get-state
// State ตาม docs/ipc-contract.md: { status: idle|running|paused, phase: focus|break|null, task_id, session_index,
//   session_total, phase_total_seconds, remaining_seconds } (ไม่มีชื่อ task: widget เรียก tasks:list มาหาชื่อจาก task_id เอง)
// main ส่ง event ทุก 1 วินาที widget นับถอยหลังต่อเองระหว่างรอ event ถัดไปให้ตัวเลขเดินลื่น

'use strict';

(function () {
  const SAMPLE = { phase: 'focus', paused: false, task_title: 'Read chapter 4', session_index: 2, session_total: 4, remaining_ms: 24 * 60 * 1000 + 58 * 1000 };

  let state = null;
  let endsAt = 0; // เวลาจบของ phase นี้ (ms ตามนาฬิกาเครื่อง)
  let frozen = 0; // เวลาที่เหลือตอนหยุดชั่วคราว
  let timer = null;
  let titles = null; // แคช id -> ชื่อ task (โหลดจาก tasks:list ครั้งเดียวต่อครั้งที่หาไม่เจอ)
  let titleLoading = false;
  let triedFor = null;

  const $ = (id) => document.getElementById(id);

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const active = raw.status === 'running' || raw.status === 'paused';
    let remaining = null;
    if (Number.isFinite(raw.remaining_seconds)) remaining = raw.remaining_seconds * 1000;
    else if (Number.isFinite(raw.remaining_ms)) remaining = raw.remaining_ms; // ใช้กับข้อมูลตัวอย่างตอนเปิดไฟล์ตรง
    return {
      phase: active && raw.phase === 'break' ? 'break' : active && raw.phase === 'focus' ? 'focus' : 'idle',
      paused: raw.status === 'paused' || raw.paused === true,
      taskId: raw.task_id ?? null,
      title: raw.task_title || '',
      index: raw.session_index ?? null,
      total: raw.session_total ?? null,
      remaining,
    };
  }

  function mmss(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function renderStreaks(s) {
    const box = $('wg-streaks');
    box.replaceChildren();
    if (!Number.isFinite(s.total) || s.total < 1) return;
    for (let i = 1; i <= s.total; i += 1) {
      const bar = document.createElement('span');
      bar.className = `wg__streak${Number.isFinite(s.index) && i <= s.index ? ' is-done' : ''}`;
      box.appendChild(bar);
    }
  }

  function tick() {
    if (!state || state.phase === 'idle') return;
    const left = state.paused ? frozen : endsAt - Date.now();
    $('wg-time').textContent = mmss(left);
  }

  // หาชื่อ task จาก task_id (State ของ Backend ไม่มีชื่อมาให้) แล้วอัปเดตชื่อบน widget
  async function resolveTitle(s) {
    if (!s || s.title || s.taskId == null) return;
    const key = String(s.taskId);
    if (titles && titles[key] !== undefined) {
      s.title = titles[key];
      return;
    }
    if (titleLoading || triedFor === key || !window.api) return; // เคยโหลดแล้วยังไม่เจอ task นี้: ไม่ยิงซ้ำทุกวินาที
    titleLoading = true;
    triedFor = key;
    try {
      const list = await window.api.invoke('tasks:list');
      titles = {};
      (Array.isArray(list) ? list : []).forEach((t) => {
        titles[String(t.id)] = t.title;
      });
    } catch (err) {
      titles = null;
    }
    titleLoading = false;
    if (state === s && titles && titles[key] !== undefined) {
      s.title = titles[key];
      $('wg-task').textContent = s.title;
    }
  }

  function apply(raw) {
    const s = normalize(raw);
    state = s;
    const root = $('widget');
    const idle = !s || s.phase === 'idle';
    root.classList.toggle('is-idle', idle);
    root.classList.toggle('is-break', !idle && s.phase === 'break');
    root.classList.toggle('is-paused', !idle && s.paused);
    clearInterval(timer);
    timer = null;
    if (idle) {
      $('wg-task').textContent = 'No active session';
      $('wg-phase').textContent = 'Idle';
      $('wg-session').textContent = '';
      $('wg-time').textContent = '--:--';
      $('wg-streaks').replaceChildren();
      return;
    }
    resolveTitle(s);
    $('wg-task').textContent = s.title || 'Focus session';
    $('wg-phase').textContent = s.paused ? 'Paused' : s.phase === 'break' ? 'Break time' : 'Focus time';
    $('wg-session').textContent = Number.isFinite(s.index) && Number.isFinite(s.total) ? `Session ${s.index} of ${s.total}` : '';
    const remaining = Number.isFinite(s.remaining) ? s.remaining : 0;
    endsAt = Date.now() + remaining;
    frozen = remaining;
    renderStreaks(s);
    tick();
    if (!s.paused) timer = setInterval(tick, 250);
  }

  async function init() {
    const api = window.api;
    if (!api || typeof api.invoke !== 'function') {
      apply(SAMPLE); // เปิดไฟล์ตรง ๆ ในเบราว์เซอร์: แสดงตัวอย่าง
      return;
    }
    try {
      api.on('pomodoro:state-changed', apply);
    } catch (err) {
      console.warn('[widget] subscribe pomodoro:state-changed ไม่ได้', err);
    }
    try {
      apply(await api.invoke('pomodoro:get-state'));
    } catch (err) {
      apply(null); // Backend ยังไม่มี handler: แสดงสถานะว่าง
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
