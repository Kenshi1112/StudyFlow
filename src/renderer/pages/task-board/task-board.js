// Owner: Frontend
// หน้าที่: logic ฝั่ง UI ของหน้า Task Board
// เรียก backend ผ่าน window.apiClient.invoke (ข้างในเรียก window.api.invoke) ตาม docs/ipc-contract.md

'use strict';

// สัญญากับ router.js: ลงทะเบียน mount/unmount ที่ window.pages ห้ามใช้ DOMContentLoaded
(function () {
  const { el } = window.dom;
  const api = window.apiClient;

  let root = null;
  let tasks = [];
  let selectedId = null;
  let dialog = null;
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
  // (ยังไม่แบ่งกลุ่มตาม Deadline State: ทำในงาน Task Board ถัดไป)
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

  function renderList() {
    const list = $('#tb-list');
    list.replaceChildren();
    $('#tb-empty').hidden = tasks.length > 0;
    for (const task of sortTasks(tasks)) {
      const button = el(
        'button',
        {
          type: 'button',
          class: 'tb-card',
          'data-id': task.id,
          'aria-expanded': String(task.id === selectedId),
          'aria-controls': 'tb-detail',
          onclick: () => openDetail(task.id),
        },
        el('span', { class: 'tb-card__title', text: task.title }),
        task.course_name ? el('span', { class: 'tb-card__course', text: task.course_name }) : null,
        // ธงเฉพาะ High เท่านั้น (Medium/Low ดูได้ในแผง Detail)
        task.priority === 'high'
          ? el('span', { class: 'tb-card__flag' }, el('span', { 'aria-hidden': 'true', text: '⚑' }), el('span', { class: 'visually-hidden', text: 'High priority' }))
          : null,
      );
      list.append(el('li', {}, button));
    }
    $('#tb-mock').hidden = !api.isMock();
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

  // ---------- แผง Task Detail (แก้ไขในที่ บันทึกทันทีเมื่อเปลี่ยนช่อง) ----------

  function closeDetail(restoreFocus) {
    const previous = selectedId;
    selectedId = null;
    const panel = $('#tb-detail');
    panel.hidden = true;
    panel.replaceChildren();
    renderList();
    if (restoreFocus && previous) {
      const card = root.querySelector(`.tb-card[data-id="${CSS.escape(previous)}"]`);
      if (card) card.focus();
    }
  }

  function openDetail(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    selectedId = id;
    const panel = $('#tb-detail');

    const form = window.TaskForm.create({
      mode: 'edit',
      task,
      courses: courseNames(),
      onCommit: async (changes) => {
        const updated = await api.invoke('tasks:update', { id, changes });
        if (!alive) return updated;
        tasks = tasks.map((t) => (t.id === id ? updated : t));
        renderList(); // อัปเดตการ์ด/ลำดับ แต่ไม่สร้างฟอร์มใหม่ เพื่อไม่ให้โฟกัสหลุด
        return updated;
      },
    });

    panel.replaceChildren(
      el(
        'div',
        { class: 'tb__detail-header' },
        el('h2', { class: 'tb__detail-title', text: 'Task detail' }),
        el('button', { type: 'button', class: 'btn', text: 'Close', onclick: () => closeDetail(true) }),
      ),
      form,
    );
    panel.hidden = false;
    renderList();
  }

  // ---------- โมดัลสร้าง task ----------

  function closeDialog() {
    if (!dialog) return;
    if (dialog.open) dialog.close();
    dialog.remove();
    dialog = null;
  }

  function openCreate() {
    closeDialog();
    let focusOpener = true; // สร้างสำเร็จแล้วโฟกัสไปที่การ์ดใหม่แทน
    const form = window.TaskForm.create({
      mode: 'create',
      courses: courseNames(),
      onCancel: closeDialog,
      onSubmit: async (payload) => {
        const created = await api.invoke('tasks:create', payload);
        if (!alive) return;
        tasks = [...tasks, created];
        focusOpener = false;
        closeDialog();
        renderList();
        const card = root.querySelector(`.tb-card[data-id="${CSS.escape(created.id)}"]`);
        if (card) card.focus();
      },
    });

    dialog = el(
      'dialog',
      { class: 'tb-dialog', 'aria-labelledby': 'tb-dialog-title' },
      el(
        'div',
        { class: 'tb-dialog__header' },
        el('h2', { id: 'tb-dialog-title', class: 'tb-dialog__title', text: 'New Task' }),
        el('button', { type: 'button', class: 'btn', 'aria-label': 'Close', text: '✕', onclick: closeDialog }),
      ),
      form,
    );
    dialog.addEventListener('close', () => {
      if (dialog) {
        dialog.remove();
        dialog = null;
      }
      const opener = focusOpener && root && root.querySelector('#tb-new');
      if (opener) opener.focus();
    });
    root.append(dialog);
    dialog.showModal();
    form.focusFirst();
  }

  function onKeydown(event) {
    // Esc ปิดแผง Detail เมื่อโฟกัสอยู่ในแผง (Esc ของโมดัลเบราว์เซอร์จัดการให้เอง)
    if (event.key === 'Escape' && selectedId && !dialog && $('#tb-detail').contains(document.activeElement)) {
      closeDetail(true);
    }
  }

  window.pages['task-board'] = {
    mount(rootEl) {
      root = rootEl;
      alive = true;
      tasks = [];
      selectedId = null;
      $('#tb-new').addEventListener('click', openCreate);
      document.addEventListener('keydown', onKeydown);
      load();
    },
    unmount() {
      alive = false;
      document.removeEventListener('keydown', onKeydown);
      closeDialog();
      root = null;
      dialog = null;
    },
  };
})();
