// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Calendar: แสดง task ตามวัน due_date (spec §7: Calendar View = overview of tasks by due date)
// อ่าน task จาก tasks:list ผ่าน window.apiClient เท่านั้น ไม่แก้ข้อมูล

'use strict';

(function () {
  const api = window.apiClient;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MAX_CHIPS = 2;
  const UPCOMING_MAX = 5;

  let root = null;
  let alive = false;
  let cleanups = [];
  let tasks = [];
  let year = 0;
  let month = 0;
  const courseSlot = new Map();

  const $ = (s) => root.querySelector(s);
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  function slotOf(course) {
    const name = course || '';
    if (!courseSlot.has(name)) courseSlot.set(name, courseSlot.size % 5);
    return courseSlot.get(name);
  }

  function msg(text) {
    const box = $('#cl-msg');
    box.textContent = text || '';
    box.hidden = !text;
  }

  // task ที่มีวันครบกำหนดและยังไม่ถูกลบ จัดกลุ่มตามวัน
  function byDay() {
    const map = new Map();
    tasks.forEach((t) => {
      if (!t.due_date || t.deleted_at) return;
      const d = new Date(t.due_date);
      if (Number.isNaN(d.getTime())) return;
      const k = key(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    });
    return map;
  }

  function chip(t) {
    const a = document.createElement('a');
    a.className = `cl__chip cl__c${slotOf(t.course_name)}`;
    a.href = '#/task-board';
    a.textContent = t.title;
    a.title = t.course_name ? `${t.title} (${t.course_name})` : t.title;
    return a;
  }

  function renderGrid() {
    $('#cl-month').textContent = `${MONTHS[month]} ${year}`;
    const grid = $('#cl-grid');
    grid.replaceChildren();
    const days = byDay();
    const todayKey = key(new Date());
    const first = new Date(year, month, 1);
    const count = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < first.getDay(); i += 1) {
      const blank = document.createElement('div');
      blank.className = 'cl__cell cl__cell--blank';
      grid.appendChild(blank);
    }
    for (let day = 1; day <= count; day += 1) {
      const date = new Date(year, month, day);
      const k = key(date);
      const cell = document.createElement('div');
      cell.className = `cl__cell${k === todayKey ? ' cl__cell--today' : ''}`;
      const num = document.createElement('span');
      num.className = 'cl__day';
      num.textContent = String(day);
      cell.appendChild(num);
      const list = days.get(k) || [];
      const shown = list.length > MAX_CHIPS ? MAX_CHIPS - 1 : list.length;
      list.slice(0, shown).forEach((t) => cell.appendChild(chip(t)));
      if (list.length > shown) {
        const more = document.createElement('a');
        more.className = 'cl__chip cl__chip--more';
        more.href = '#/task-board';
        more.textContent = `+${list.length - shown} more`;
        cell.appendChild(more);
      }
      grid.appendChild(cell);
    }
  }

  function renderUpcoming() {
    const box = $('#cl-upcoming');
    box.replaceChildren();
    const today = startOfDay(new Date());
    const list = tasks
      .filter((t) => t.due_date && !t.deleted_at && t.status !== 'completed' && !Number.isNaN(new Date(t.due_date).getTime()) && startOfDay(new Date(t.due_date)) >= today)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, UPCOMING_MAX);
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'cl__empty';
      p.textContent = 'No upcoming deadlines';
      box.appendChild(p);
      return;
    }
    list.forEach((t) => {
      const due = new Date(t.due_date);
      const left = Math.round((startOfDay(due) - today) / 86400000);
      const slot = slotOf(t.course_name);
      const a = document.createElement('a');
      a.className = 'cl__up';
      a.href = '#/task-board';

      const head = document.createElement('div');
      head.className = 'cl__up-head';
      const dot = document.createElement('span');
      dot.className = `cl__dot cl__d${slot}`;
      const title = document.createElement('span');
      title.textContent = t.title;
      head.append(dot, title);
      a.appendChild(head);

      if (t.course_name) {
        const course = document.createElement('p');
        course.className = `cl__up-course cl__t${slot}`;
        course.textContent = t.course_name;
        a.appendChild(course);
      }

      const foot = document.createElement('div');
      foot.className = 'cl__up-foot';
      const date = document.createElement('span');
      date.textContent = `${SHORT[due.getMonth()]} ${due.getDate()}, ${due.getFullYear()}`;
      const days = document.createElement('span');
      days.className = `cl__days ${left <= 2 ? 'cl__days--soon' : 'cl__days--later'}`;
      days.textContent = `${left}d`;
      foot.append(date, days);
      a.appendChild(foot);
      box.appendChild(a);
    });
  }

  function shift(delta) {
    const d = new Date(year, month + delta, 1);
    year = d.getFullYear();
    month = d.getMonth();
    renderGrid();
  }

  async function load() {
    try {
      const list = await api.invoke('tasks:list');
      tasks = Array.isArray(list) ? list : [];
      msg('');
    } catch (err) {
      tasks = [];
      msg('โหลด task ไม่สำเร็จ');
    }
    if (!alive) return;
    renderGrid();
    renderUpcoming();
  }

  window.pages['calendar'] = {
    mount(el) {
      root = el;
      alive = true;
      cleanups = [];
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth();
      const bind = (sel, fn) => {
        const node = $(sel);
        node.addEventListener('click', fn);
        cleanups.push(() => node.removeEventListener('click', fn));
      };
      bind('#cl-prev', () => shift(-1));
      bind('#cl-next', () => shift(1));
      renderGrid();
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
