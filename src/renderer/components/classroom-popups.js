// Owner: Frontend
// หน้าที่: ป๊อปอัป Google Classroom 2 แบบ ตาม Figma node 413:66 ใช้ร่วมกันระหว่างหน้า
//   ClassroomPopups.review({ items, syncedAt, onConfirm })  ป๊อปอัปรับงานใหม่ (spec §13.5 ข้อ 5-8)
//   ClassroomPopups.cutoff({ onConfirm, onCancel })          เลือกวัน cutoff ตอนเชื่อมครั้งแรก (spec §13.1)
// เป็น UI อย่างเดียว: หน้าที่เรียกเป็นคนส่ง IPC (classroom:decide / settings:set) ตามผลที่ได้จาก onConfirm

'use strict';

(function () {
  const { el } = window.dom;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function fmtDate(d) {
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function fmtSynced(value) {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return '\u2014';
    const today = new Date();
    const day = d.toDateString() === today.toDateString() ? 'Today' : fmtDate(d);
    const h = d.getHours();
    const time = `${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    return `${day}, ${time}`;
  }

  function open(className, label, content, onClosed) {
    const d = el('dialog', { class: `cr-popup ${className}`, 'aria-label': label }, content);
    d.addEventListener('close', () => {
      d.remove();
      if (onClosed) onClosed(d.returnValue);
    });
    document.body.append(d);
    d.showModal();
    return d;
  }

  // ---------- ป๊อปอัปรับงานใหม่ ----------
  // items: [{ id, title, course_name, due_date }] (id = ตัวที่ส่งกลับไปใน classroom:decide)
  // onConfirm(decisions): decisions = [{ id, decision: 'import' | 'ignore' }] เฉพาะที่ผู้ใช้เลือก ที่ไม่ได้เลือกยัง pending (§13.5 ข้อ 8)
  function review({ items, syncedAt, onConfirm, onClose }) {
    const choice = new Map();
    const groups = new Map();
    items.forEach((item) => {
      const course = item.course_name || 'Google Classroom';
      if (!groups.has(course)) groups.set(course, []);
      groups.get(course).push(item);
    });

    function row(item) {
      const createBtn = el('button', { type: 'button', class: 'cr-btn cr-btn--create', text: '+ Create Task' });
      const ignoreBtn = el('button', { type: 'button', class: 'cr-btn cr-btn--ignore', text: 'Ignore' });
      const node = el(
        'div',
        { class: 'cr-item' },
        el('div', { class: 'cr-item__info' },
          el('p', { class: 'cr-item__title', text: item.title || '(no title)' }),
          el('p', { class: 'cr-item__due', text: item.due_date ? `Due ${fmtDate(new Date(item.due_date))}` : 'No due date' })),
        createBtn,
        ignoreBtn,
      );
      function pick(value) {
        if (choice.get(item.id) === value) choice.delete(item.id);
        else choice.set(item.id, value);
        const v = choice.get(item.id);
        node.classList.toggle('is-create', v === 'import');
        node.classList.toggle('is-ignore', v === 'ignore');
        createBtn.setAttribute('aria-pressed', String(v === 'import'));
        ignoreBtn.setAttribute('aria-pressed', String(v === 'ignore'));
        createBtn.textContent = v === 'import' ? '\u2713 Create Task' : '+ Create Task';
        ignoreBtn.textContent = v === 'ignore' ? '\u2713 Ignore' : 'Ignore';
        updateConfirm();
      }
      createBtn.setAttribute('aria-pressed', 'false');
      ignoreBtn.setAttribute('aria-pressed', 'false');
      createBtn.addEventListener('click', () => pick('import'));
      ignoreBtn.addEventListener('click', () => pick('ignore'));
      return node;
    }

    const list = el('div', { class: 'cr-list' },
      [...groups.entries()].map(([course, group]) =>
        el('section', { class: 'cr-course' },
          el('h3', { class: 'cr-course__title' },
            el('b', { text: `${course} |` }),
            el('span', { text: ` Found ${group.length} New Item${group.length === 1 ? '' : 's'}` })),
          group.map(row))));

    const confirm = el('button', { type: 'button', class: 'cr-confirm' });
    function updateConfirm() {
      confirm.textContent = choice.size ? `Confirm (${choice.size})` : 'Decide later';
    }
    updateConfirm();

    const error = el('p', { class: 'cr-error', role: 'status', hidden: true });

    const dialog = open('cr-popup--review', 'New assignments from Google Classroom',
      el('div', { class: 'cr-review' },
        el('h2', { class: 'cr-review__heading', text: 'There are new assignments for you!' }),
        el('div', { class: 'cr-review__meta' },
          el('p', { class: 'cr-review__synced', text: `Syncing information as of: ${fmtSynced(syncedAt)}` }),
          el('p', { class: 'cr-review__hint', text: 'Select items you wish to change into your Tasks' })),
        list,
        error,
        confirm),
      onClose);

    confirm.addEventListener('click', async () => {
      if (!choice.size) {
        dialog.close();
        return;
      }
      confirm.disabled = true;
      error.hidden = true;
      try {
        await onConfirm([...choice.entries()].map(([id, decision]) => ({ id, decision })));
        dialog.close('confirmed');
      } catch (err) {
        error.textContent = String((err && err.message) || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
        error.hidden = false;
        confirm.disabled = false;
      }
    });
    return dialog;
  }

  // ---------- ป๊อปอัปเลือกวัน cutoff ----------
  // "Start of semester" spec ไม่ได้กำหนดวัน: ใช้วันเปิดภาคล่าสุดแบบประมาณ (1 มิ.ย. หรือ 1 พ.ย.) แก้ได้ด้วย Custom
  function semesterStart(now) {
    const y = now.getFullYear();
    const candidates = [new Date(y, 10, 1), new Date(y, 5, 1), new Date(y - 1, 10, 1)];
    return candidates.find((d) => d <= now);
  }

  function toInputValue(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // onConfirm(date): date = Date เวลาเที่ยงคืนตามเวลาเครื่องของวันที่เลือก
  function cutoff({ onConfirm, onCancel }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const options = { today, semester: semesterStart(today) };
    let mode = 'today';
    let picked = today;

    const dateText = el('span', { class: 'cr-date__text' });
    const input = el('input', { type: 'date', class: 'cr-date__input', max: toInputValue(today), 'aria-label': 'Custom import start date' });
    const buttons = {};
    const optionRow = el('div', { class: 'cr-options', role: 'group', 'aria-label': 'Import start date' },
      [['today', 'Today'], ['semester', 'Start of semester'], ['custom', 'Custom']].map(([key, label]) => {
        buttons[key] = el('button', { type: 'button', class: 'cr-option', text: label, onclick: () => setMode(key) });
        return buttons[key];
      }));

    function render() {
      Object.entries(buttons).forEach(([key, b]) => {
        b.classList.toggle('is-on', key === mode);
        b.setAttribute('aria-pressed', String(key === mode));
      });
      dateText.textContent = fmtDate(picked);
      input.value = toInputValue(picked);
    }

    function setMode(key) {
      mode = key;
      if (key !== 'custom') picked = options[key];
      render();
      if (key === 'custom' && typeof input.showPicker === 'function') {
        try { input.showPicker(); } catch (err) { /* บางกรณีเปิดไม่ได้ ผู้ใช้กดช่องวันที่เองได้ */ }
      }
    }

    input.addEventListener('change', () => {
      if (!input.value) return;
      const [y, m, d] = input.value.split('-').map(Number);
      picked = new Date(y, m - 1, d);
      mode = 'custom';
      render();
    });

    const calendarIcon = el('span', { class: 'cr-date__icon', 'aria-hidden': 'true' });
    const error = el('p', { class: 'cr-error', role: 'status', hidden: true });
    const confirm = el('button', { type: 'button', class: 'cr-cutoff__confirm', text: 'Confirm and start syncing' });
    let confirmed = false;

    const dialog = open('cr-popup--cutoff', 'Choose your import start date',
      el('div', { class: 'cr-cutoff' },
        el('div', { class: 'cr-cutoff__banner' },
          el('img', { class: 'cr-cutoff__logo', src: 'assets/settings/classroom-icon.png', alt: '' }),
          el('p', { class: 'cr-cutoff__brand', text: 'Google Classroom' }),
          el('p', { class: 'cr-cutoff__status', text: 'Connected' })),
        el('h2', { class: 'cr-cutoff__title', text: 'Choose your import start date' }),
        el('p', { class: 'cr-cutoff__desc', text: 'So we don\u2019t pull in a backlog of old assignments, we\u2019ll only import coursework created on or after this date' }),
        optionRow,
        el('label', { class: 'cr-date' }, calendarIcon, dateText, input),
        error,
        confirm,
        el('p', { class: 'cr-cutoff__foot', text: 'After this, Classroom syncs automatically each time you open the app. You can also press Sync now on Task Board anytime.' })),
      () => {
        if (!confirmed && onCancel) onCancel();
      });

    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      error.hidden = true;
      try {
        await onConfirm(new Date(picked));
        confirmed = true;
        dialog.close('confirmed');
      } catch (err) {
        error.textContent = String((err && err.message) || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
        error.hidden = false;
        confirm.disabled = false;
      }
    });
    render();
    return dialog;
  }

  window.ClassroomPopups = { review, cutoff };
})();
