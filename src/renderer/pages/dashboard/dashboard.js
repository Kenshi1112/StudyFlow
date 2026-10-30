// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Dashboard (Figma node 410:63, spec v0.15 หัวข้อ 10: 6 metrics)
// ตัวเลข 6 metrics มาจาก dashboard:get-metrics { range } ตาม docs/ipc-contract.md (Backend คำนวณทั้งหมด หน้านี้แค่แสดง)
//   Metrics = { range, total_assignments, completed_assignments, remaining_assignments, overdue_assignments,
//               percent_completed_before_deadline (0-100 | null), average_time_to_start_lag (% | null) }
//   null = ยังไม่มีข้อมูลพอ แสดง "—" (empty state ไม่ใช่ 0)
// กราฟโดนัท "By Deadline State": Backend ยังไม่ส่งจำนวนแยกตาม state มาใน Metrics จึงนับจาก tasks:list
//   (แต่ละ task มี deadline_state ที่ Backend คำนวณให้แล้ว ไม่คิดซ้ำเอง) โดยนับเฉพาะ task ที่ due_date อยู่ในช่วงที่เลือก
//   ตามกฎเดียวกับ Total Assignments (task ไม่มี due นับเฉพาะ All Time) ถ้าโหลดไม่ได้ โดนัทจะว่าง
// โหลด metrics ไม่ได้: แสดง "—" พร้อมข้อความ error ไม่แสดงข้อมูลตัวอย่าง
// ไม่มี "Longest Inactive Assignment" เพราะ v0.14 ตัดออกแล้ว (Figma ยังมีอยู่)

'use strict';

(function () {
  const api = window.apiClient;
  const NS = 'http://www.w3.org/2000/svg';

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
  // Backend ส่งทศนิยม 1 ตำแหน่ง: แสดงตามจริง ตัดศูนย์ท้าย (80 -> "80", 33.3 -> "33.3") null -> "—"
  const num = (v) => (Number.isFinite(v) ? String(Number(v.toFixed(1))) : '—');
  const pct = (v) => (Number.isFinite(v) ? `${num(v)}%` : '—');
  const EMPTY = { total: null, completed: null, remaining: null, overdue: null, completed_before_deadline_pct: null, avg_time_to_start_pct: null, by_state: {} };
  let loadSeq = 0; // กันผลของคำขอเก่าที่ตอบกลับหลังผู้ใช้เปลี่ยนช่วงเวลาไปแล้ว

  function note(text) {
    const box = $('#db-note');
    box.textContent = text || '';
    box.hidden = !text;
  }

  // แปลง Metrics ตาม contract เป็นรูปที่ render ใช้ ถ้ารูปไม่ตรง contract (ไม่มี total_assignments เป็นตัวเลข) คืน null
  function normalize(m) {
    if (!m || typeof m !== 'object' || !Number.isFinite(m.total_assignments)) return null;
    return {
      total: m.total_assignments,
      completed: m.completed_assignments,
      remaining: m.remaining_assignments,
      overdue: m.overdue_assignments,
      completed_before_deadline_pct: m.percent_completed_before_deadline,
      avg_time_to_start_pct: m.average_time_to_start_lag,
      by_state: {},
    };
  }

  // ช่วงเวลา [start, end) ตามเวลาเครื่อง ตรงกับ getRangeBounds ของ Backend (สัปดาห์เริ่มวันจันทร์) null = ไม่จำกัด
  function rangeBounds(r, now = new Date()) {
    const y = now.getFullYear();
    const mo = now.getMonth();
    const d = now.getDate();
    if (r === 'this_week') {
      const back = (now.getDay() + 6) % 7;
      return { start: new Date(y, mo, d - back), end: new Date(y, mo, d - back + 7) };
    }
    if (r === 'this_month') return { start: new Date(y, mo, 1), end: new Date(y, mo + 1, 1) };
    return null;
  }

  // จำนวน task แยกตาม deadline_state (ที่ Backend คำนวณมาใน tasks:list) เฉพาะที่ due_date อยู่ในช่วง: กฎเดียวกับ Total Assignments
  function countByState(list, r) {
    const b = rangeBounds(r);
    const counts = {};
    (Array.isArray(list) ? list : []).forEach((task) => {
      if (task.due_date) {
        const due = new Date(task.due_date);
        if (b && !(due >= b.start && due < b.end)) return;
      } else if (b) {
        return; // ไม่มี due_date นับเฉพาะ All Time
      }
      counts[task.deadline_state] = (counts[task.deadline_state] || 0) + 1;
    });
    return counts;
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
    // ไม่มีงานที่เข้าเกณฑ์ (ไม่มี first_started_at) Backend ส่ง null -> แสดง —
    $('#db-lag').textContent = Number.isFinite(d.avg_time_to_start_pct) ? `${num(d.avg_time_to_start_pct)} %` : '—';
    renderBars({ ...d, completed: d.completed || 0, remaining: d.remaining || 0 });
    renderDonut(d);
  }

  async function load() {
    const seq = (loadSeq += 1);
    const r = range;
    const [metrics, list] = await Promise.all([
      api.invoke('dashboard:get-metrics', { range: r }).then((v) => ({ v }), (err) => ({ err })),
      api.invoke('tasks:list').then((v) => ({ v }), () => ({ v: null })),
    ]);
    if (!alive || seq !== loadSeq) return;
    const data = metrics.err ? null : normalize(metrics.v);
    if (!data) {
      const why = metrics.err ? String((metrics.err && metrics.err.message) || metrics.err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'รูปแบบข้อมูลไม่ตรง contract';
      note(`โหลดข้อมูล Dashboard ไม่ได้: ${why}`);
      render(EMPTY);
      return;
    }
    note('');
    data.by_state = countByState(list.v, r);
    render(data);
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
