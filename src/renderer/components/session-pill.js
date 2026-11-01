// Owner: Frontend
// หน้าที่: ป้ายลอยมุมขวาล่างของหน้าต่างหลัก โชว์ตอนมี Pomodoro วิ่งอยู่ (running/paused) แต่ผู้ใช้อยู่หน้าอื่น
//   กดแล้วกลับไปหน้า Pomodoro ของ task นั้น (#/pomodoro?task=<task_id>) ซ่อนเองเมื่ออยู่หน้า Pomodoro หรือ batch จบ
// อ่าน State จาก pomodoro:get-state ตอนเปิดแอป แล้วฟัง event pomodoro:state-changed (ไม่นับเวลาเอง)

'use strict';

(function () {
  const { el } = window.dom;
  let state = null;

  const dot = el('span', { class: 'sp__dot', 'aria-hidden': 'true' });
  const phase = el('span', { class: 'sp__phase' });
  const time = el('span', { class: 'sp__time' });
  const cta = el('span', { class: 'sp__cta', text: 'Back to session' });
  const pill = el('a', { class: 'sp', href: '#/room', hidden: true }, dot, phase, time, cta);

  function mmss(sec) {
    const s = Math.max(0, Math.ceil(Number(sec) || 0));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function render() {
    const active = !!state && (state.status === 'running' || state.status === 'paused');
    pill.hidden = !active || location.hash.startsWith('#/pomodoro');
    if (!active) return;
    const kind = state.status === 'paused' ? 'paused' : state.phase === 'break' ? 'break' : 'focus';
    pill.dataset.kind = kind;
    pill.href = `#/pomodoro?task=${encodeURIComponent(state.task_id)}`;
    phase.textContent = kind === 'paused' ? 'Paused' : kind === 'break' ? 'Break' : 'Focus';
    time.textContent = mmss(state.remaining_seconds);
    pill.setAttribute('aria-label', `${phase.textContent} ${time.textContent}, back to Pomodoro session`);
  }

  function apply(s) {
    if (!s || typeof s !== 'object') return;
    state = s;
    render();
  }

  document.body.appendChild(pill);
  window.addEventListener('hashchange', render);
  if (window.api && typeof window.api.on === 'function') {
    try {
      window.api.on('pomodoro:state-changed', apply);
    } catch (err) {
      console.warn('[session-pill] subscribe pomodoro:state-changed ไม่ได้', err);
    }
  }
  if (window.apiClient) {
    window.apiClient.invoke('pomodoro:get-state').then(apply, () => {});
  }
})();
