// Owner: Frontend
// หน้าที่: ข้อมูลจำลอง tasks:* ไว้พัฒนา UI ระหว่างรอ Backend (ROADMAP ข้อ 1.7) รูปแบบตาม docs/ipc-contract.md
// ใช้เฉพาะเมื่อ main ยังไม่ลงทะเบียน handler หรือเปิดหน้าในเบราว์เซอร์ตรง ๆ ไม่มี window.api (api-client.js เป็นคนเลือก)
// Backend ทำ tasks:* / settings:* / classroom:* / pomodoro:* ครบแล้ว: ไฟล์นี้จำลองเฉพาะ tasks:* ไว้ดูหน้าตาโดยไม่ต้องรัน Electron ลบทิ้งได้เมื่อไม่ต้องการ
// หมายเหตุ: deadline_state / urgency_score ที่นี่เป็นค่าจำลองแบบง่าย ไม่ใช่สูตร §9.2 / §9.5 (Backend เป็นคนคำนวณจริง)

'use strict';

(function () {
  const CHANNELS = ['tasks:list', 'tasks:get', 'tasks:create', 'tasks:update', 'tasks:delete'];
  // ตรงกับ TASK_PRIORITY / TASK_STATUS ใน src/shared/constants.js (renderer import ตรงไม่ได้)
  const PRIORITIES = ['low', 'medium', 'high'];
  const STATUSES = ['not_started', 'in_progress', 'completed'];
  const UPDATABLE = ['title', 'notes', 'status', 'due_date', 'progress_percentage', 'course_name', 'priority'];

  const store = [];
  let seq = 1;

  function iso(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  function insert(fields) {
    const stamp = new Date().toISOString();
    const task = {
      id: `mock-${seq++}`,
      title: '',
      notes: null,
      status: 'not_started',
      due_date: null,
      progress_percentage: 0,
      priority: null,
      source: 'manual',
      classroom_assignment_id: null,
      course_name: null,
      classroom_last_updated: null,
      completed_at: null,
      deleted_at: null,
      last_focus_started_at: null,
      created_at: stamp,
      updated_at: stamp,
      ...fields,
    };
    store.push(task);
    return task;
  }

  insert({ title: 'Essay Draft', course_name: 'CS101', due_date: iso(-1), priority: 'high', progress_percentage: 60 });
  insert({ title: 'Lab Report', course_name: 'CS101', due_date: iso(3), priority: 'medium' });
  insert({ title: 'Read chapter 4', due_date: iso(7) });

  function deadlineState(t) {
    if (t.status === 'completed') return 'completed';
    if (!t.due_date) return 'no_deadline';
    const due = new Date(t.due_date);
    const now = new Date();
    if (due < now) return 'overdue';
    return due.toDateString() === now.toDateString() ? 'due_today' : 'upcoming';
  }

  // ค่าจำลอง: มีแค่ส่วน priority (0.2 x factor x 100) เพื่อให้เห็นว่าลำดับขยับตาม priority
  function urgencyScore(t) {
    if (t.status === 'completed') return null;
    const factor = { high: 1, medium: 0.5 }[t.priority] || 0;
    return factor * 20;
  }

  function view(t) {
    return { ...t, deadline_state: deadlineState(t), urgency_score: urgencyScore(t) };
  }

  function findLive(id) {
    const task = store.find((t) => t.id === id && !t.deleted_at);
    if (!task) throw new Error(`Task not found: ${id}`);
    return task;
  }

  function validate(fields) {
    if ('title' in fields && (typeof fields.title !== 'string' || !fields.title.trim())) {
      throw new Error('title is required');
    }
    if ('priority' in fields && fields.priority !== null && !PRIORITIES.includes(fields.priority)) {
      throw new Error(`invalid priority: ${fields.priority}`);
    }
    if ('status' in fields && !STATUSES.includes(fields.status)) {
      throw new Error(`invalid status: ${fields.status}`);
    }
    if ('progress_percentage' in fields) {
      const n = fields.progress_percentage;
      if (typeof n !== 'number' || !(n >= 0 && n <= 100)) throw new Error('progress_percentage must be 0-100');
    }
    if ('due_date' in fields && fields.due_date !== null && Number.isNaN(new Date(fields.due_date).getTime())) {
      throw new Error('due_date must be ISO 8601');
    }
  }

  function invoke(channel, payload) {
    try {
      switch (channel) {
        case 'tasks:list':
          return Promise.resolve(store.filter((t) => !t.deleted_at).map(view));
        case 'tasks:get': {
          const t = store.find((x) => x.id === payload.id && !x.deleted_at);
          return Promise.resolve(t ? view(t) : null);
        }
        case 'tasks:create': {
          const allowed = ['title', 'notes', 'due_date', 'progress_percentage', 'course_name', 'priority'];
          for (const key of Object.keys(payload || {})) {
            if (!allowed.includes(key)) throw new Error(`field not allowed on create: ${key}`);
          }
          validate({ title: payload && payload.title, ...payload });
          return Promise.resolve(view(insert({ ...payload, title: payload.title.trim() })));
        }
        case 'tasks:update': {
          const task = findLive(payload.id);
          const changes = payload.changes || {};
          for (const key of Object.keys(changes)) {
            if (!UPDATABLE.includes(key)) throw new Error(`field not allowed on update: ${key}`);
          }
          validate(changes);
          // กติกาเดียวกับ task.service.js (§12 v0.20): งาน Completed แก้ progress ไม่ได้ เว้นแต่ย้าย status ออกพร้อมกัน
          const stillCompleted = task.status === 'completed' && (changes.status === undefined || changes.status === 'completed');
          if (stillCompleted && 'progress_percentage' in changes && changes.progress_percentage !== task.progress_percentage) {
            throw new Error('progress_percentage cannot be changed while the task is Completed; move it back to Not Started or In Progress first');
          }
          const becomingCompleted = changes.status === 'completed' && task.status !== 'completed';
          Object.assign(task, changes);
          if ('title' in changes) task.title = task.title.trim();
          if ('status' in changes) task.completed_at = changes.status === 'completed' ? new Date().toISOString() : null;
          // §12: กด Mark as Completed = 100% (เหมือน task.service.js) ย้อนกลับไม่แตะ progress
          if (becomingCompleted) task.progress_percentage = 100;
          task.updated_at = new Date().toISOString();
          return Promise.resolve(view(task));
        }
        case 'tasks:delete': {
          const task = findLive(payload.id);
          task.deleted_at = new Date().toISOString();
          return Promise.resolve({ id: task.id });
        }
        default:
          throw new Error(`mock does not handle ${channel}`);
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }

  window.__devMockTasks = { invoke, handles: (channel) => CHANNELS.includes(channel) };
})();
