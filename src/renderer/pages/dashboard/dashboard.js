// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Dashboard (Figma node 410:63, spec v0.15 หัวข้อ 10: 6 metrics)
// เรียก backend ผ่าน window.apiClient.invoke ('dashboard:get-metrics') ถ้า Backend ยังไม่มี handler / รูปแบบข้อมูลต่าง
// จะแสดงข้อมูลตัวอย่างจาก Figma พร้อมข้อความเตือน (payload ของ channel นี้ Backend ยังไม่กำหนด)
// ไม่มี "Longest Inactive Assignment" เพราะ v0.14 ตัดออกแล้ว (Figma ยังมีอยู่)

'use strict';

(function () {
  const api = window.apiClient;
  const NS = 'http://www.w3.org/2000/svg';

  const SAMPLE = {
    total: 7, completed: 6, remaining: 1, overdue: 1,
    completed_before_deadline_pct: 80, avg_time_to_start_pct: 45,
    by_state: { upcoming: 2, due_today: 1, overdue: 1, no_deadline: 1, completed: 2 },
  };

  const STATES = [
    ['upcoming', 'Upcoming'], ['due_today', 'Due Today'], ['overdue', 'Overdue'],
    ['no_deadline', 'No Deadline'], ['completed', 'Completed'],
  ];
  const SEG_CLASS = { upcoming: 'upcoming', due_today: 'due', overdue: 'overdue', no_deadline: 'none', completed: 'completed' };

  let root = null;
  let range = 'all_time';
  let alive = false;
  let cleanups = [];

  const $ = (s) => root.querySelector(s);
  const pct = (v) => (Number.isFinite(v) ? `${Math.round(v)}%` : '—');

  function note(text) {
    const box = $('#db-note');
    box.textContent = text || '';
    box.hidden = !text;
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : raw;
    if (!Number.isFinite(m.total) && !Number.isFinite(m.total_assignments)) return null;
    return {
      total: m.total ?? m.total_assignments,
      completed: m.completed ?? m.completed_assignments,
      remaining: m.remaining ?? m.remaining_assignments,
      overdue: m.overdue ?? m.overdue_assignments,
      completed_before_deadline_pct: m.completed_before_deadline_pct ?? m.percent_completed_before_deadline,
      avg_time_to_start_pct: m.avg_time_to_start_pct ?? m.average_time_to_start_lag,
      by_state: m.by_state || m.by_deadline_state || {},
    };
  }

  function renderBars(d) {
    const box = $('#db-bars');
    box.replaceChildren();
    const max = Math.max(6, d.completed, d.remaining);
    [['done', d.completed], ['rest', d.remaining]].forEach(([kind, n]) => {
      const bar = document.createElement('div');
      bar.className = `db__bar db__bar--${kind}`;
      bar.dataset.value = String(n ?? 0);
      bar.style.setProperty('--h-n', String(((n || 0) / max) * 320));
      box.appendChild(bar);
    });
  }

  function renderDonut(d) {
    const svg = $('#db-donut');
    svg.replaceChildren();
    const r = 80;
    const c = 2 * Math.PI * r;
    const total = STATES.reduce((sum, [k]) => sum + (d.by_state[k] || 0), 0);
    let offset = 0;
    if (total > 0) {
      STATES.forEach(([k]) => {
        const n = d.by_state[k] || 0;
        if (!n) return;
        const len = (n / total) * c;
        const seg = document.createElementNS(NS, 'circle');
        seg.setAttribute('class', `seg--${SEG_CLASS[k]}`);
        seg.setAttribute('cx', '100');
        seg.setAttribute('cy', '100');
        seg.setAttribute('r', String(r));
        seg.setAttribute('stroke-dasharray', `${len} ${c - len}`);
        seg.setAttribute('stroke-dashoffset', String(-offset));
        svg.appendChild(seg);
        offset += len;
      });
    }
    $('#db-donut-pct').textContent = pct(d.completed_before_deadline_pct);
    const legend = $('#db-donut-legend');
    legend.replaceChildren();
    STATES.forEach(([k, label]) => {
      const item = document.createElement('span');
      const sw = document.createElement('i');
      sw.className = `db__sw db__sw--${SEG_CLASS[k]}`;
      item.append(sw, label);
      legend.appendChild(item);
    });
  }

  function render(d) {
    $('#db-total').textContent = d.total ?? '—';
    $('#db-completed').textContent = d.completed ?? '—';
    $('#db-remaining').textContent = d.remaining ?? '—';
    $('#db-overdue').textContent = d.overdue ?? '—';
    $('#db-before').textContent = pct(d.completed_before_deadline_pct);
    // ไม่มีงานที่เข้าเกณฑ์ (ไม่มี first_started_at) Backend ควรส่ง null -> แสดง —
    $('#db-lag').textContent = Number.isFinite(d.avg_time_to_start_pct) ? `${Math.round(d.avg_time_to_start_pct)} %` : '—';
    renderBars({ ...d, completed: d.completed || 0, remaining: d.remaining || 0 });
    renderDonut(d);
  }

  async function load() {
    let data = null;
    try {
      data = normalize(await api.invoke('dashboard:get-metrics', { range }));
    } catch (err) {
      data = null;
    }
    if (!alive) return;
    if (data) {
      note('');
      render(data);
    } else {
      note('ข้อมูลตัวอย่างจาก Figma (Backend ยังไม่ส่ง dashboard:get-metrics)');
      render(SAMPLE);
    }
  }

  window.pages['dashboard'] = {
    mount(el) {
      root = el;
      alive = true;
      cleanups = [];
      root.querySelectorAll('.db__range-btn').forEach((btn) => {
        const fn = () => {
          range = btn.dataset.range;
          root.querySelectorAll('.db__range-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
          load();
        };
        btn.addEventListener('click', fn);
        cleanups.push(() => btn.removeEventListener('click', fn));
      });
      load();
    },
    unmount() {
      alive = false;
      cleanups.forEach((fn) => fn());
      cleanups = [];
      root = null;
    },
  };
})();
