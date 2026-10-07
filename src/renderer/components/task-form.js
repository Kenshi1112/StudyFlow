// Owner: Frontend
// หน้าที่: ฟอร์ม task ตัวเดียวที่ใช้ทั้งโมดัล "+ New Task" (mode 'create') และแผง Task Detail (mode 'edit')
// ช่องและลำดับตาม UX-UI-Design-Review_v0.13 (Task Create / Edit Form): Title, Course, Due, Priority, Progress, Notes
// ส่ง/รับข้อมูลตาม docs/ipc-contract.md (ตัวฟอร์มไม่เรียก IPC เอง ให้หน้าที่เรียกใช้ส่ง callback เข้ามา)

'use strict';

(function () {
  const { el } = window.dom;

  // ตรงกับ TASK_PRIORITY ใน src/shared/constants.js (renderer import ตรงไม่ได้)
  const PRIORITIES = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];

  // ถ้าผู้ใช้กรอกวันที่แต่ไม่กรอกเวลา ใช้สิ้นวัน (spec ยังไม่กำหนดค่าเริ่มต้นของเวลา: รอยืนยันกับ Backend)
  const DEFAULT_DUE_TIME = '23:59';

  let counter = 0;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function isoToLocalParts(iso) {
    if (!iso) return { date: '', time: '' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: '', time: '' };
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }

  function localToIso(date, time) {
    const d = new Date(`${date}T${time || DEFAULT_DUE_TIME}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function errorMessage(err) {
    return (err && err.message ? err.message : String(err)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  }

  // Priority: segmented control 3 ช่อง ไม่เลือกค่าไหนเป็นค่าเริ่มต้น กดช่องที่เลือกอยู่ซ้ำเพื่อล้างเป็น "ไม่ตั้ง"
  // ใช้ลูกศรเลื่อนได้ (radiogroup)  ไม่แสดงน้ำหนัก/คะแนน และไม่ใช้สีแดง/ส้ม (UX Review §2, §6)
  function priorityControl({ value, labelledBy, describedBy, onChange }) {
    let current = value || null;
    const buttons = PRIORITIES.map((p) =>
      el('button', { type: 'button', class: 'seg__btn', role: 'radio', 'data-value': p.value, text: p.label }),
    );
    const group = el(
      'div',
      { class: 'seg', role: 'radiogroup', 'aria-labelledby': labelledBy, 'aria-describedby': describedBy },
      buttons,
    );

    function paint() {
      buttons.forEach((button, i) => {
        const on = button.dataset.value === current;
        button.setAttribute('aria-checked', String(on));
        // roving tabindex: เข้ากลุ่มด้วย Tab ได้จุดเดียว
        button.tabIndex = on || (current === null && i === 0) ? 0 : -1;
      });
    }

    function set(next, notify) {
      current = next;
      paint();
      if (notify) onChange(next);
    }

    group.addEventListener('click', (event) => {
      const button = event.target.closest('.seg__btn');
      if (!button) return;
      set(current === button.dataset.value ? null : button.dataset.value, true);
    });

    group.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const index = PRIORITIES.findIndex((p) => p.value === current);
      let next;
      if (index === -1) next = step === 1 ? 0 : PRIORITIES.length - 1;
      else next = (index + step + PRIORITIES.length) % PRIORITIES.length;
      set(PRIORITIES[next].value, true);
      buttons[next].focus();
    });

    paint();
    return { element: group, getValue: () => current, setValue: (v) => set(v || null, false) };
  }

  // สร้างฟอร์ม
  //   mode 'create': onSubmit(payload) -> Promise  (payload ตรงกับ tasks:create)  onCancel()
  //   mode 'edit'  : onCommit(changes) -> Promise<Task>  เรียกทันทีเมื่อแก้ช่องนั้น (ตรงกับ changes ของ tasks:update)
  function create({ mode, task, courses, onSubmit, onCommit, onCancel }) {
    const isEdit = mode === 'edit';
    const uid = ++counter;
    const id = (name) => `tf${uid}-${name}`;
    let saved = { ...(task || {}) };

    const errorBox = el('p', { class: 'task-form__error', role: 'alert', hidden: true });
    const showError = (message) => {
      errorBox.textContent = message;
      errorBox.hidden = false;
    };
    const clearError = () => {
      errorBox.textContent = '';
      errorBox.hidden = true;
    };

    // --- ช่องกรอก ---
    const titleInput = el('input', { id: id('title'), type: 'text', name: 'title', autocomplete: 'off', 'aria-required': 'true' });
    const courseList = el(
      'datalist',
      { id: id('courses') },
      (courses || []).map((name) => el('option', { value: name })),
    );
    const courseInput = el('input', { id: id('course'), type: 'text', name: 'course_name', list: id('courses'), autocomplete: 'off' });
    const dateInput = el('input', { id: id('due-date'), type: 'date', name: 'due_date', 'aria-label': 'Due date' });
    const timeInput = el('input', { id: id('due-time'), type: 'time', name: 'due_time', 'aria-label': 'Due time' });
    const progressInput = el('input', { id: id('progress'), type: 'number', name: 'progress_percentage', min: 0, max: 100, step: 1, inputmode: 'numeric' });
    const notesInput = el('textarea', { id: id('notes'), name: 'notes', rows: 4 });

    const priority = priorityControl({
      value: saved.priority,
      labelledBy: id('priority-label'),
      describedBy: id('priority-help'),
      onChange: (value) => {
        if (isEdit) commit({ priority: value });
      },
    });

    function fill(source) {
      titleInput.value = source.title || '';
      courseInput.value = source.course_name || '';
      const due = isoToLocalParts(source.due_date);
      dateInput.value = due.date;
      timeInput.value = due.time;
      priority.setValue(source.priority);
      progressInput.value = source.progress_percentage == null ? '' : String(source.progress_percentage);
      notesInput.value = source.notes || '';
    }

    function readDue() {
      return dateInput.value ? localToIso(dateInput.value, timeInput.value) : null;
    }

    // คืน { ok, value } ช่องว่าง = ok แต่ไม่มีค่า
    function readProgress() {
      const raw = progressInput.value.trim();
      if (raw === '') return { ok: true, value: undefined };
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false };
      return { ok: true, value: n };
    }

    // --- โหมดแก้ไขในแผง: บันทึกทันทีที่เปลี่ยนช่อง ---
    async function commit(changes) {
      clearError();
      try {
        const updated = await onCommit(changes);
        if (updated) saved = { ...updated };
      } catch (err) {
        showError(errorMessage(err));
        fill(saved); // ย้อนช่องกลับเป็นค่าที่บันทึกไว้ล่าสุด
      }
    }

    if (isEdit) {
      titleInput.addEventListener('change', () => {
        const value = titleInput.value.trim();
        if (!value) {
          showError('Title is required.');
          titleInput.value = saved.title || '';
          return;
        }
        commit({ title: value });
      });
      courseInput.addEventListener('change', () => commit({ course_name: courseInput.value.trim() || null }));
      const onDueChange = () => {
        if (!dateInput.value) {
          timeInput.value = '';
          commit({ due_date: null });
        } else {
          commit({ due_date: readDue() });
        }
      };
      dateInput.addEventListener('change', onDueChange);
      timeInput.addEventListener('change', () => {
        if (dateInput.value) onDueChange();
      });
      progressInput.addEventListener('change', () => {
        const result = readProgress();
        if (!result.ok) {
          showError('Progress must be a number from 0 to 100.');
          progressInput.value = String(saved.progress_percentage ?? 0);
          return;
        }
        commit({ progress_percentage: result.value === undefined ? 0 : result.value });
      });
      notesInput.addEventListener('change', () => commit({ notes: notesInput.value.trim() || null }));
    }

    // --- ประกอบ layout ตามลำดับใน UX Review ---
    const row = (labelFor, labelText, control, extra) =>
      el('div', { class: 'task-form__row' }, el('label', { for: labelFor, text: labelText }), control, extra);

    const titleLabel = el('label', { for: id('title') }, 'Title ', el('span', { 'aria-hidden': 'true', text: '*' }));
    const form = el(
      'form',
      { class: 'task-form', novalidate: true },
      el('div', { class: 'task-form__row' }, titleLabel, titleInput),
      row(id('course'), 'Course', courseInput, courseList),
      el(
        'div',
        { class: 'task-form__row', role: 'group', 'aria-labelledby': id('due-label') },
        el('span', { id: id('due-label'), class: 'task-form__label', text: 'Due' }),
        el('div', { class: 'task-form__inline' }, dateInput, timeInput),
      ),
      el(
        'div',
        { class: 'task-form__row' },
        el('span', { id: id('priority-label'), class: 'task-form__label', text: 'Priority' }),
        priority.element,
        el('p', { id: id('priority-help'), class: 'task-form__help', text: 'Optional. Higher priority moves a task up within its group.' }),
      ),
      el(
        'div',
        { class: 'task-form__row' },
        el('label', { for: id('progress'), text: 'Progress' }),
        el('div', { class: 'task-form__inline' }, progressInput, el('span', { 'aria-hidden': 'true', text: '%' })),
      ),
      row(id('notes'), 'Notes', notesInput),
      errorBox,
    );

    fill(saved);
    if (!isEdit && progressInput.value === '') progressInput.value = '0';

    // --- โหมดสร้าง: ปุ่ม Cancel / Create Task ---
    if (!isEdit) {
      const submitButton = el('button', { type: 'submit', class: 'btn btn--primary', text: 'Create Task' });
      const cancelButton = el('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: () => onCancel && onCancel() });
      form.append(el('div', { class: 'task-form__actions' }, cancelButton, submitButton));

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearError();
        const title = titleInput.value.trim();
        if (!title) {
          showError('Title is required.');
          titleInput.focus();
          return;
        }
        const payload = { title };
        const course = courseInput.value.trim();
        if (course) payload.course_name = course;
        const due = readDue();
        if (due) payload.due_date = due;
        const level = priority.getValue();
        if (level) payload.priority = level; // ไม่ตั้ง = ไม่ส่ง (null)
        const progress = readProgress();
        if (!progress.ok) {
          showError('Progress must be a number from 0 to 100.');
          progressInput.focus();
          return;
        }
        if (progress.value !== undefined) payload.progress_percentage = progress.value;
        const notes = notesInput.value.trim();
        if (notes) payload.notes = notes;

        submitButton.disabled = true;
        try {
          await onSubmit(payload);
        } catch (err) {
          showError(errorMessage(err));
        } finally {
          submitButton.disabled = false;
        }
      });
    } else {
      // โหมดแก้ไขไม่มีปุ่มส่ง กัน Enter ใน input ทำให้หน้ารีโหลด
      form.addEventListener('submit', (event) => event.preventDefault());
    }

    form.focusFirst = () => titleInput.focus();
    return form;
  }

  window.TaskForm = { create };
})();
