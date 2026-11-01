// Owner: Frontend
// หน้าที่: ฟอร์ม task ตัวเดียวที่ใช้ทั้งป๊อปอัป "Create New Task" (mode 'create') และ "Edit Task" (mode 'edit') ตาม Figma
// ช่อง: Subject / Classroom (course_name), Status (เฉพาะ edit), Task Name (title), Description (notes), Deadline (due_date)
// เพิ่มเอง (ไม่อยู่ใน Figma แต่ spec v0.15 ให้มี): Priority แบบ segmented control ไม่บังคับ ไม่มีค่าเริ่มต้น กดซ้ำเพื่อล้าง
// ตัวฟอร์มไม่เรียก IPC เอง ให้หน้าที่เรียกใช้ส่ง onSubmit เข้ามา
//   create: onSubmit(payload)  ตรงกับ tasks:create
//   edit  : onSubmit(changes)  ตรงกับ changes ของ tasks:update (ส่งเฉพาะช่องที่เปลี่ยน)
// Progress ไม่อยู่ในฟอร์ม Figma (ปรับด้วยแถบเลื่อนในป๊อปอัปรายละเอียด)

'use strict';

(function () {
  const { el } = window.dom;

  // ตรงกับ TASK_PRIORITY ใน src/shared/constants.js (renderer import ตรงไม่ได้)
  const PRIORITIES = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];

  const STATUSES = [
    { value: 'not_started', label: 'Not Started' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ช่องเวลาเพิ่มเอง (Figma มีแค่วันที่) ใช้รูปแบบ 24 ชั่วโมง HH:MM ค่าเริ่มต้นเป็นสิ้นวัน
  const DEFAULT_DUE_TIME = '23:59';

  let counter = 0;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function isoToLocalParts(iso) {
    if (!iso) return { date: '', time: DEFAULT_DUE_TIME };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: '', time: DEFAULT_DUE_TIME };
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }

  function localToIso(date, time) {
    const d = new Date(`${date}T${time || DEFAULT_DUE_TIME}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // รับ "23:59", "9:05" หรือ "2359" คืน "HH:MM" ถ้าไม่ใช่เวลา 00:00-23:59 คืน null
  function parseTime(value) {
    const match = /^(\d{1,2}):?(\d{2})$/.exec(String(value || '').trim());
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    return h <= 23 && m <= 59 ? `${pad(h)}:${pad(m)}` : null;
  }

  // 'YYYY-MM-DD' -> 'Jan 31, 2026' (รูปแบบตาม Figma)
  function formatDateValue(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return '';
    return `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`;
  }

  function errorMessage(err) {
    return (err && err.message ? err.message : String(err)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  }

  // Priority: segmented control 3 ช่อง ไม่เลือกค่าไหนเป็นค่าเริ่มต้น กดช่องที่เลือกอยู่ซ้ำเพื่อล้างเป็น "ไม่ตั้ง"
  // ใช้ลูกศรเลื่อนได้ (radiogroup)  ไม่แสดงน้ำหนัก/คะแนน และไม่ใช้สีแดง/ส้ม (UX Review §2, §6)
  function priorityControl({ value, labelledBy }) {
    let current = value || null;
    const buttons = PRIORITIES.map((p) =>
      el('button', { type: 'button', class: 'seg__btn', role: 'radio', 'data-value': p.value, text: p.label }),
    );
    const group = el('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': labelledBy }, buttons);

    function paint() {
      buttons.forEach((button, i) => {
        const on = button.dataset.value === current;
        button.setAttribute('aria-checked', String(on));
        // roving tabindex: เข้ากลุ่มด้วย Tab ได้จุดเดียว
        button.tabIndex = on || (current === null && i === 0) ? 0 : -1;
      });
    }

    function set(next) {
      current = next;
      paint();
    }

    group.addEventListener('click', (event) => {
      const button = event.target.closest('.seg__btn');
      if (!button) return;
      set(current === button.dataset.value ? null : button.dataset.value);
    });

    group.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const index = PRIORITIES.findIndex((p) => p.value === current);
      let next;
      if (index === -1) next = step === 1 ? 0 : PRIORITIES.length - 1;
      else next = (index + step + PRIORITIES.length) % PRIORITIES.length;
      set(PRIORITIES[next].value);
      buttons[next].focus();
    });

    paint();
    return { element: group, getValue: () => current, setValue: (v) => set(v || null) };
  }

  function create({ mode, task, courses, onSubmit, onCancel }) {
    const isEdit = mode === 'edit';
    const uid = ++counter;
    const id = (name) => `tf${uid}-${name}`;
    const original = { ...(task || {}) };
    const originalDue = isoToLocalParts(original.due_date);

    const errorBox = el('p', { class: 'tf__error', role: 'alert', hidden: true });
    const showError = (message) => {
      errorBox.textContent = message;
      errorBox.hidden = false;
    };
    const clearError = () => {
      errorBox.textContent = '';
      errorBox.hidden = true;
    };

    // --- ช่องกรอก ---
    const courseInput = el('input', { id: id('course'), class: 'tf-field__input', type: 'text', name: 'course_name', list: id('courses'), autocomplete: 'off' });
    const courseList = el('datalist', { id: id('courses') }, (courses || []).map((name) => el('option', { value: name })));
    const statusSelect = el(
      'select',
      { id: id('status'), class: 'tf-field__input', name: 'status' },
      STATUSES.map((s) => el('option', { value: s.value, text: s.label })),
    );
    const titleInput = el('input', { id: id('title'), class: 'tf-field__input', type: 'text', name: 'title', autocomplete: 'off', 'aria-required': 'true' });
    const notesInput = el('textarea', { id: id('notes'), class: 'tf-field__input tf-field__input--area', name: 'notes' });
    // ช่องวันที่: ตัว <input type=date> จริงโปร่งใสวางทับ ส่วนที่เห็นเป็นข้อความรูปแบบ "Jan 31, 2026" ตาม Figma
    const dateInput = el('input', { id: id('due'), class: 'tf-date__input', type: 'date', name: 'due_date' });
    const dateText = el('span', { class: 'tf-date__text' });
    const clearDate = el('button', { type: 'button', class: 'tf-date__clear', 'aria-label': 'Clear deadline', text: '✕' });
    // ช่องเวลา: ช่องข้อความธรรมดาแทน <input type=time> เพราะ type=time แสดง AM/PM ตามภาษาเครื่อง บังคับ 24 ชั่วโมงไม่ได้
    const timeInput = el('input', {
      id: id('due-time'),
      class: 'tf-date__time',
      type: 'text',
      name: 'due_time',
      inputmode: 'numeric',
      maxlength: '5',
      placeholder: DEFAULT_DUE_TIME,
      autocomplete: 'off',
      'aria-label': 'Deadline time, 24-hour (HH:MM)',
    });

    const priority = priorityControl({ value: original.priority, labelledBy: id('priority-label') });

    function paintDate() {
      dateText.textContent = formatDateValue(dateInput.value) || 'No deadline';
      dateText.classList.toggle('tf-date__text--empty', !dateInput.value);
      clearDate.hidden = !dateInput.value;
      timeInput.hidden = !dateInput.value; // ไม่มีวันที่ = ไม่มีเวลา
    }

    dateInput.addEventListener('change', paintDate);
    dateInput.addEventListener('click', () => {
      if (typeof dateInput.showPicker === 'function') {
        try {
          dateInput.showPicker();
        } catch (err) {
          /* เปิดไม่ได้ก็พิมพ์ได้ตามปกติ */
        }
      }
    });
    // พิมพ์ได้แค่ตัวเลขกับ ":" และพอออกจากช่องให้จัดเป็น HH:MM (เช่น 930 -> 09:30)
    timeInput.addEventListener('input', () => {
      const cleaned = timeInput.value.replace(/[^\d:]/g, '');
      if (cleaned !== timeInput.value) timeInput.value = cleaned;
    });
    timeInput.addEventListener('blur', () => {
      const t = parseTime(timeInput.value);
      if (t) timeInput.value = t;
    });
    clearDate.addEventListener('click', () => {
      dateInput.value = '';
      timeInput.value = DEFAULT_DUE_TIME;
      paintDate();
      dateInput.focus();
    });

    courseInput.value = original.course_name || '';
    statusSelect.value = original.status || 'not_started';
    titleInput.value = original.title || '';
    notesInput.value = original.notes || '';
    dateInput.value = originalDue.date;
    timeInput.value = originalDue.time;
    paintDate();

    function field(modifier, labelText, forId, control, extra) {
      return el(
        'div',
        { class: `tf-field tf-field--${modifier}` },
        el('label', { class: 'tf-field__label', for: forId, text: labelText }),
        control,
        extra,
      );
    }

    const heading = el('h2', { class: 'tf__title', id: id('heading'), text: isEdit ? 'Edit Task' : 'Create New Task' });

    const topRow = el(
      'div',
      { class: isEdit ? 'tf__split' : 'tf__single' },
      field('course', 'Subject / Classroom', id('course'), courseInput, courseList),
      isEdit ? field('status', 'Status', id('status'), statusSelect) : null,
    );

    const deadline = el(
      'div',
      { class: 'tf-field tf-field--deadline' },
      el('label', { class: 'tf-field__label', for: id('due'), text: 'Deadline' }),
      el('div', { class: 'tf-date' }, el('span', { class: 'tf-date__pick' }, dateText, dateInput), timeInput, clearDate),
    );

    const priorityRow = el(
      'div',
      { class: 'tf__priority' },
      el('span', { class: 'tf__priority-label', id: id('priority-label'), text: 'Priority (optional)' }),
      priority.element,
    );

    const cancelButton = el('button', { type: 'button', class: 'tf__btn tf__btn--cancel', text: 'Cancel', onclick: () => onCancel && onCancel() });
    const submitButton = el('button', { type: 'submit', class: 'tf__btn tf__btn--save', text: isEdit ? 'Save Edit' : 'Save Task' });

    const form = el(
      'form',
      { class: 'tf', novalidate: true, 'aria-labelledby': id('heading') },
      heading,
      topRow,
      field('name', 'Task Name', id('title'), titleInput),
      field('des', 'Description', id('notes'), notesInput),
      deadline,
      priorityRow,
      errorBox,
      el('div', { class: 'tf__actions' }, cancelButton, submitButton),
    );

    // วันที่ + เวลาในช่อง -> ISO (ช่องเวลาว่าง = 23:59)
    function readTime() {
      return timeInput.value.trim() ? parseTime(timeInput.value) : DEFAULT_DUE_TIME;
    }

    function readDue() {
      return dateInput.value ? localToIso(dateInput.value, readTime()) : null;
    }

    function collect() {
      const title = titleInput.value.trim();
      const course = courseInput.value.trim();
      const notes = notesInput.value.trim();
      const level = priority.getValue();
      const due = readDue();

      if (!isEdit) {
        const payload = { title };
        if (course) payload.course_name = course;
        if (due) payload.due_date = due;
        if (level) payload.priority = level; // ไม่ตั้ง = ไม่ส่ง (null)
        if (notes) payload.notes = notes;
        return payload;
      }

      const changes = {};
      if (title !== (original.title || '')) changes.title = title;
      if (course !== (original.course_name || '')) changes.course_name = course || null;
      if (notes !== (original.notes || '')) changes.notes = notes || null;
      if (level !== (original.priority || null)) changes.priority = level;
      if (statusSelect.value !== original.status) changes.status = statusSelect.value;
      if (dateInput.value !== originalDue.date || (dateInput.value && readTime() !== originalDue.time)) changes.due_date = due;
      return changes;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearError();
      if (!titleInput.value.trim()) {
        showError('Task Name is required.');
        titleInput.focus();
        return;
      }
      if (dateInput.value && !readTime()) {
        showError('Enter the time as 24-hour HH:MM, e.g. 23:59.');
        timeInput.focus();
        return;
      }
      const data = collect();
      if (isEdit && Object.keys(data).length === 0) {
        if (onCancel) onCancel(); // ไม่มีอะไรเปลี่ยน
        return;
      }
      submitButton.disabled = true;
      try {
        await onSubmit(data);
      } catch (err) {
        showError(errorMessage(err));
      } finally {
        submitButton.disabled = false;
      }
    });

    form.focusFirst = () => courseInput.focus();
    return form;
  }

  window.TaskForm = { create };
})();
