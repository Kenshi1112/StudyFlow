// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Task Board
// เรียก backend ผ่าน window.apiClient.invoke (ข้างในเรียก window.api.invoke) ตาม docs/ipc-contract.md

'use strict';

// สัญญากับ router.js: ลงทะเบียน mount/unmount ที่ window.pages ห้ามใช้ DOMContentLoaded
(function () {
  const { el } = window.dom;
  const api = window.apiClient;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const STATUS_LABEL = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' };

  let root = null;
  let tasks = [];
  let selectedId = null;
  let filter = 'all';
  let query = '';
  let sourceFilter = 'all';
  let courseFilter = '';
  let alive = false; // กันผลของ request ที่ตอบกลับหลังออกจากหน้านี้แล้ว

  const $ = (selector) => root.querySelector(selector);

  function message(err) {
    return (err && err.message ? err.message : String(err)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  }

  function showError(text) {
    const box = $('#tb-error');
    box.textContent = text || '';
    box.hidden = !text;
  }

  // ipc-contract ข้อ 2: tasks:list ไม่รับประกันลำดับ เรียงเองด้วย urgency_score มาก -> น้อย แล้วเอา null ไว้ท้าย
  function sortTasks(list) {
    return [...list].sort((a, b) => {
      if (a.urgency_score === null && b.urgency_score !== null) return 1;
      if (b.urgency_score === null && a.urgency_score !== null) return -1;
      const diff = (b.urgency_score || 0) - (a.urgency_score || 0);
      return diff || String(b.created_at).localeCompare(String(a.created_at));
    });
  }

  function courseNames() {
    return [...new Set(tasks.map((t) => t.course_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  // รูปแบบวันที่ตาม Figma: "Jan 31,2026"
  function formatDate(iso) {
    const d = new Date(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()},${d.getFullYear()}`;
  }

  function daysLeft(iso) {
    return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  }

  function matchesFilter(task) {
    if (filter === 'all') return true;
    if (filter === 'overdue') return task.status !== 'completed' && task.deadline_state === 'overdue';
    return task.status === filter;
  }

  function matchesSource(task) {
    return sourceFilter === 'all' || task.source === sourceFilter;
  }

  function matchesCourse(task) {
    return !courseFilter || task.course_name === courseFilter;
  }

  function matchesQuery(task) {
    if (!query) return true;
    const q = query.toLowerCase();
    return String(task.title).toLowerCase().includes(q) || String(task.course_name || '').toLowerCase().includes(q);
  }

  // ป้ายสถานะบนการ์ด: ถ้าเลยกำหนดและยังไม่เสร็จ แสดง Overdue (สีแดง) แทนสถานะ (ตาม Figma)
  function pillOf(task) {
    if (task.status !== 'completed' && task.deadline_state === 'overdue') return { text: 'Overdue', overdue: true };
    return { text: STATUS_LABEL[task.status] || task.status, overdue: false };
  }

  function buildCard(task) {
    const pill = pillOf(task);
    const completed = task.status === 'completed';
    const progress = Math.max(0, Math.min(100, Number(task.progress_percentage) || 0));

    let leftText = null;
    let urgent = false;
    if (task.due_date && !completed && !pill.overdue) {
      const n = Math.max(1, daysLeft(task.due_date));
      leftText = `${n} ${n === 1 ? 'day' : 'days'} left`;
      urgent = n <= 2;
    }

    const fill = el('span', { class: 'tb-card__fill' });
    fill.style.setProperty('--fill', String(progress));

    return el(
      'button',
      {
        type: 'button',
        class: completed ? 'tb-card tb-card--completed' : 'tb-card',
        'data-id': task.id,
                'aria-haspopup': 'dialog',
        onclick: () => openDetails(task.id),
      },
      el('span', { class: pill.overdue ? 'tb-card__pill tb-card__pill--overdue' : 'tb-card__pill', text: pill.text }),
      leftText ? el('span', { class: urgent ? 'tb-card__left tb-card__left--urgent' : 'tb-card__left', text: leftText }) : null,
      // ธงเฉพาะ High เท่านั้น เป็นไอคอนเล็กโทนกลาง (UX Review §2) ไม่อยู่ใน Figma
      task.priority === 'high'
        ? el('span', { class: 'tb-card__flag' }, el('span', { 'aria-hidden': 'true', text: '⚑' }), el('span', { class: 'visually-hidden', text: 'High priority' }))
        : null,
      el('span', { class: 'tb-card__course', text: task.course_name || '' }),
      el(
        'span',
        { class: 'tb-card__source' },
        window.SourceIcon.create(task.source, 26),
        el('span', { class: 'visually-hidden', text: window.SourceIcon.label(task.source) }),
      ),
      el('span', { class: 'tb-card__title', text: `ชื่องาน : ${task.title}` }),
      el(
        'span',
        { class: 'tb-card__meta' },
        el('span', { text: `Deadline: ${task.due_date ? formatDate(task.due_date) : '-'}` }),
        el('br'),
        el('span', { text: `Progress: ${progress}%` }),
      ),
      el('span', { class: 'tb-card__bar' }, fill),
    );
  }

  function refreshCourseOptions() {
    const select = $('#tb-course');
    const names = courseNames();
    if (courseFilter && !names.includes(courseFilter)) courseFilter = '';
    select.replaceChildren(el('option', { value: '', text: 'All courses' }), ...names.map((n) => el('option', { value: n, text: n })));
    select.value = courseFilter;
  }

  function renderList() {
    refreshCourseOptions();
    const list = $('#tb-list');
    list.replaceChildren();
    const visible = sortTasks(tasks).filter((t) => matchesFilter(t) && matchesSource(t) && matchesCourse(t) && matchesQuery(t));
    const empty = $('#tb-empty');
    if (tasks.length === 0) {
      empty.textContent = 'No tasks yet. Create your first task with “+ New Task”.';
    } else if (visible.length === 0) {
      empty.textContent = 'No tasks match this filter.';
    }
    empty.hidden = visible.length > 0;
    for (const task of visible) list.append(el('li', {}, buildCard(task)));
    $('#tb-mock').hidden = !api.isMock();
  }

  function setSource(next) {
    sourceFilter = next;
    for (const tab of root.querySelectorAll('.tb__tab--sub')) {
      tab.setAttribute('aria-pressed', String(tab.dataset.source === next));
    }
    renderList();
  }

  function setFilter(next) {
    filter = next;
    for (const tab of root.querySelectorAll('.tb__tab')) {
      tab.setAttribute('aria-pressed', String(tab.dataset.filter === next));
    }
    renderList();
  }

  async function load() {
    try {
      const result = await api.invoke('tasks:list');
      if (!alive) return;
      tasks = result;
      showError('');
    } catch (err) {
      if (!alive) return;
      showError(`โหลด task ไม่ได้: ${message(err)}`);
    }
    renderList();
  }

  // ---------- ป๊อปอัป (Figma: รายละเอียดงาน / Create New Task / Edit Task / ยืนยันลบ) ----------

  let dialog = null;
  let suppressFocus = false; // กำลังสลับจากป๊อปอัปหนึ่งไปอีกอัน ไม่ต้องคืนโฟกัสระหว่างทาง
  let returnFocusId = null; // การ์ดที่โฟกัสควรกลับไปหาเมื่อปิดป๊อปอัป

  function restoreFocus() {
    if (!root) return;
    const card = returnFocusId && root.querySelector(`.tb-card[data-id="${CSS.escape(returnFocusId)}"]`);
    const target = card || $('#tb-new');
    if (target) target.focus();
  }

  function closeDialog() {
    if (dialog && dialog.open) dialog.close();
  }

  function showDialog(className, label, content) {
    if (dialog) {
      suppressFocus = true;
      closeDialog();
    }
    const d = el('dialog', { class: `tb-popup ${className}`, 'aria-label': label }, content);
    d.addEventListener('close', () => {
      d.remove();
      if (dialog === d) {
        dialog = null;
        selectedId = null;
        renderList();
      }
      if (!suppressFocus) restoreFocus();
      suppressFocus = false;
    });
    // คลิกพื้นหลังมืดนอกป๊อปอัป = ปิด
    d.addEventListener('click', (event) => {
      if (event.target === d) d.close();
    });
    dialog = d;
    root.append(d);
    d.showModal();
    return d;
  }

  function dueSummary(task) {
    if (task.status === 'completed') return 'Completed';
    if (!task.due_date) return 'No deadline';
    if (task.deadline_state === 'overdue') return 'Overdue';
    return `Due in ${Math.max(1, daysLeft(task.due_date))} day(s)`;
  }

  function formatLong(iso) {
    const d = new Date(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  // ไอคอนถังขยะชั่วคราว: ยังโหลดไฟล์จาก Figma ไม่ได้ (โควต้า MCP หมด) เปลี่ยนเป็น <img> ของ Figma เมื่อได้ไฟล์
  function trashIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) {
      svg.setAttribute(k, v);
    }
    for (const d of ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6']) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  async function updateTask(id, changes) {
    const updated = await api.invoke('tasks:update', { id, changes });
    if (alive) {
      tasks = tasks.map((t) => (t.id === id ? updated : t));
      renderList();
    }
    return updated;
  }

  function progressBox(task, onCommit) {
    const percent = Math.max(0, Math.min(100, Number(task.progress_percentage) || 0));
    const value = el('p', { class: 'dt-box__value', text: `${percent}%` });
    const range = el('input', { type: 'range', class: 'dt-range', min: '0', max: '100', step: '1', 'aria-label': 'Progress percentage' });
    range.value = String(percent);
    const paint = () => {
      range.style.setProperty('--p', range.value);
      value.textContent = `${range.value}%`;
    };
    range.addEventListener('input', paint);
    range.addEventListener('change', () => onCommit(Number(range.value)));
    paint();
    return el(
      'div',
      { class: 'dt-box' },
      el('p', { class: 'dt-box__label', text: 'Progress' }),
      value,
      range,
      el('div', { class: 'dt-ticks', 'aria-hidden': 'true' }, el('span', { text: '0%' }), el('span', { text: '50%' }), el('span', { text: '100%' })),
    );
  }

  // Description ใน Figma = ฟิลด์ notes ของ task (spec มี notes ช่องเดียว จึงไม่ทำกล่อง Notes แยก)
  function buildDetails(task) {
    const completed = task.status === 'completed';
    const errorBox = el('p', { class: 'dt__error', role: 'alert', hidden: true });

    async function guarded(action) {
      errorBox.hidden = true;
      try {
        await action();
      } catch (err) {
        errorBox.textContent = message(err);
        errorBox.hidden = false;
      }
    }

    return el(
      'div',
      { class: 'dt' },
      el(
        'div',
        { class: 'dt__head' },
        task.course_name ? el('span', { class: 'dt__chip dt__chip--course', text: task.course_name }) : null,
        el('span', { class: 'dt__chip dt__chip--status', text: STATUS_LABEL[task.status] || task.status }),
        el(
          'div',
          { class: 'dt__tools' },
          el(
            'button',
            { type: 'button', class: 'dt__icon-btn', 'aria-label': 'Edit task', onclick: () => openForm('edit', task) },
            el('img', { src: 'assets/task-board/edit.svg', alt: '' }),
          ),
          el('button', { type: 'button', class: 'dt__icon-btn dt__icon-btn--delete', 'aria-label': 'Delete task', onclick: () => openDelete(task) }, trashIcon()),
        ),
      ),
      el('h2', { class: 'dt__title', text: task.title }),
      el(
        'p',
        { class: 'dt__source' },
        window.SourceIcon.create(task.source, 18),
        el('span', { text: `${window.SourceIcon.label(task.source)} · ${task.created_at ? formatLong(task.created_at) : '-'}` }),
      ),
      el(
        'div',
        { class: 'dt__due' },
        el('span', { text: dueSummary(task) }),
        el('span', { text: task.due_date ? formatLong(task.due_date) : '' }),
      ),
      el(
        'div',
        { class: 'dt__grid' },
        el(
          'div',
          { class: 'dt-box' },
          el('p', { class: 'dt-box__label', text: 'Description' }),
          el('p', task.notes ? { class: 'dt-box__text', text: task.notes } : { class: 'dt-box__text dt-box__text--empty', text: 'No description' }),
        ),
        progressBox(task, (value) =>
          guarded(async () => {
            const updated = await updateTask(task.id, { progress_percentage: value });
            if (dialog && alive) refreshDetails(updated);
          }),
        ),
      ),
      errorBox,
      el(
        'div',
        { class: 'dt__actions' },
        el('button', { type: 'button', class: 'dt__btn dt__btn--start', text: 'Start Working', disabled: completed, onclick: () => startWorking(task) }),
        el('button', {
          type: 'button',
          class: 'dt__btn dt__btn--done',
          text: 'Mark as Completed',
          disabled: completed,
          onclick: () =>
            guarded(async () => {
              const updated = await updateTask(task.id, { status: 'completed' });
              if (dialog && alive) refreshDetails(updated);
            }),
        }),
      ),
    );
  }

  function refreshDetails(task) {
    if (!dialog || !dialog.classList.contains('tb-popup--details')) return;
    dialog.replaceChildren(buildDetails(task));
  }

  function openDetails(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    returnFocusId = id;
    selectedId = id;
    showDialog('tb-popup--details', 'Task details', buildDetails(task));
    renderList();
  }

  // Start Working: ไปหน้า Pomodoro ของ task นี้ (spec §15: เข้า Pomodoro ผ่าน task เท่านั้น) ตัวตั้งเวลาเป็นงานของ Backend/หน้า Pomodoro
  function startWorking(task) {
    suppressFocus = true;
    closeDialog();
    window.location.hash = `#/pomodoro?task=${encodeURIComponent(task.id)}`;
  }

  // mode 'create' | 'edit'
  function openForm(mode, task) {
    const isEdit = mode === 'edit';
    if (isEdit) returnFocusId = task.id;
    const form = window.TaskForm.create({
      mode,
      task,
      courses: courseNames(),
      onCancel: () => {
        if (isEdit) openDetails(task.id);
        else closeDialog();
      },
      onSubmit: async (data) => {
        if (isEdit) {
          await updateTask(task.id, data);
          if (alive) openDetails(task.id);
          return;
        }
        const created = await api.invoke('tasks:create', data);
        if (!alive) return;
        tasks = [...tasks, created];
        returnFocusId = created.id;
        closeDialog();
        renderList();
      },
    });
    showDialog('tb-popup--form', isEdit ? 'Edit Task' : 'Create New Task', form);
    form.focusFirst();
  }

  function openDelete(task) {
    const errorBox = el('p', { class: 'dt__error', role: 'alert', hidden: true });
    const confirmButton = el('button', { type: 'button', class: 'dl__btn dl__btn--confirm', text: 'Confirm' });
    confirmButton.addEventListener('click', async () => {
      confirmButton.disabled = true;
      errorBox.hidden = true;
      try {
        await api.invoke('tasks:delete', { id: task.id });
        if (!alive) return;
        tasks = tasks.filter((t) => t.id !== task.id);
        returnFocusId = null;
        closeDialog();
        renderList();
      } catch (err) {
        errorBox.textContent = message(err);
        errorBox.hidden = false;
        confirmButton.disabled = false;
      }
    });
    showDialog(
      'tb-popup--delete',
      'Delete this task',
      el(
        'div',
        { class: 'dl' },
        el('h2', { class: 'dl__title', text: 'Delete this Task?' }),
        el('p', { class: 'dl__text', text: 'You are going to delete this task forever. Do you want to process?' }),
        errorBox,
        el(
          'div',
          { class: 'dl__actions' },
          el('button', { type: 'button', class: 'dl__btn dl__btn--cancel', text: 'Cancel', onclick: () => openDetails(task.id) }),
          confirmButton,
        ),
      ),
    );
  }

  function onTabClick(event) {
    const tab = event.target.closest('.tb__tab');
    if (tab && tab.dataset.filter) setFilter(tab.dataset.filter);
  }

  function onSourceClick(event) {
    const tab = event.target.closest('.tb__tab--sub');
    if (tab) setSource(tab.dataset.source);
  }

  function onCourseChange(event) {
    courseFilter = event.target.value;
    renderList();
  }

  function onSearch(event) {
    query = event.target.value.trim();
    renderList();
  }

  // ---------- Google Classroom: Sync now + ป๊อปอัปรับงานใหม่ (spec §13.2, §13.5) ----------
  // payload ของ classroom:* ยังไม่อยู่ใน ipc-contract (การเดาของ Frontend):
  //   classroom:get-status -> { connected, account_email, last_synced_at }
  //   classroom:get-pending -> [{ id, title, course_name, due_date }]
  //   classroom:decide { id, decision: 'import' | 'ignore' }
  // ยังไม่ได้กันกรณีกำลังจับเวลา Pomodoro (spec §13.5 Interruption-safe) เพราะ renderer ยังไม่รู้สถานะ session จริง

  let reviewDialog = null;
  let toastTimer = null;
  let offPending = null;

  function toast(text) {
    const box = $('#tb-toast');
    if (!box) return;
    box.textContent = text;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (root) $('#tb-toast').hidden = true;
    }, 3000);
  }

  function formatSync(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '\u2014';
    const h = d.getHours();
    const time = `${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    return d.toDateString() === new Date().toDateString() ? `Today, ${time}` : `${formatLong(iso)}, ${time}`;
  }

  async function loadSyncStatus() {
    try {
      const s = await api.invoke('classroom:get-status');
      if (!alive) return null;
      $('#tb-last-sync').textContent = s && s.last_synced_at ? `Last sync: ${formatSync(s.last_synced_at)}` : 'Last sync: \u2014';
      return s;
    } catch (err) {
      return null;
    }
  }

  async function checkPending(manual) {
    let items = [];
    try {
      items = await api.invoke('classroom:get-pending');
    } catch (err) {
      if (manual) showError(`โหลดงานจาก Classroom ไม่ได้: ${message(err)}`);
      return;
    }
    if (!alive) return;
    if (!Array.isArray(items) || !items.length) {
      if (manual) toast('No new items from Classroom');
      return;
    }
    if (reviewDialog) return;
    const status = await loadSyncStatus();
    if (!alive) return;
    reviewDialog = window.ClassroomPopups.review({
      items,
      syncedAt: status && status.last_synced_at,
      onConfirm: async (decisions) => {
        for (const d of decisions) await api.invoke('classroom:decide', d);
        await load();
      },
      onClose: () => {
        reviewDialog = null;
      },
    });
  }

  async function syncNow() {
    const btn = $('#tb-sync');
    btn.disabled = true;
    showError('');
    try {
      await api.invoke('classroom:sync-now');
      await loadSyncStatus();
      await checkPending(true);
    } catch (err) {
      if (alive) showError(`Sync ไม่สำเร็จ: ${message(err)} (เชื่อม Google Classroom ได้ที่หน้า Settings)`);
    } finally {
      if (alive) btn.disabled = false;
    }
  }

  window.pages['task-board'] = {
    mount(rootEl) {
      root = rootEl;
      alive = true;
      tasks = [];
      selectedId = null;
      filter = 'all';
      query = '';
      sourceFilter = 'all';
      courseFilter = '';
      for (const holder of root.querySelectorAll('.tb__tab-icon')) holder.append(window.SourceIcon.create(holder.dataset.icon, 22));
      $('.tb__tabs--sub').addEventListener('click', onSourceClick);
      $('#tb-course').addEventListener('change', onCourseChange);
      $('#tb-new').addEventListener('click', () => {
        returnFocusId = null;
        openForm('create');
      });
      root.querySelector('.tb__tabs:not(.tb__tabs--sub)').addEventListener('click', onTabClick);
      $('#tb-search').addEventListener('input', onSearch);
      $('#tb-sync').addEventListener('click', syncNow);
      try {
        // Backend แจ้งเมื่อมีงาน pending ใหม่ (เช่น fetch ตอนเปิดแอปเสร็จ)
        if (window.api && typeof window.api.on === 'function') offPending = window.api.on('classroom:pending-changed', () => checkPending(false));
      } catch (err) {
        offPending = null;
      }
      load().then(() => {
        loadSyncStatus();
        checkPending(false);
      });
    },
    unmount() {
      alive = false;
      if (offPending) offPending();
      offPending = null;
      clearTimeout(toastTimer);
      if (reviewDialog) {
        const d = reviewDialog;
        reviewDialog = null;
        if (d.open) d.close();
      }
      if (dialog) {
        const d = dialog;
        dialog = null;
        if (d.open) d.close();
        d.remove();
      }
      root = null;
    },
  };
})();
