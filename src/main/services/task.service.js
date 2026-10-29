// Owner: Backend
// หน้าที่: จัดการ task (CRUD, soft delete) และคำนวณ Deadline State / Urgency Score ตอน read
// อ้างอิง: PROJECT_v0.15 section 9.1, 9.2, 9.5 และ docs/ipc-contract.md

'use strict';

const crypto = require('crypto');
const { getDb } = require('../db/database');
const { TASK_STATUS, TASK_SOURCE, TASK_PRIORITY, DEADLINE_STATE } = require('../../shared/constants');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// น้ำหนักของ Urgency Score (§9.5) รวมกันได้ 1.0
const WEIGHT_DEADLINE = 0.4;
const WEIGHT_PROGRESS_GAP = 0.24;
const WEIGHT_NEGLECT = 0.16;
const WEIGHT_PRIORITY = 0.2;

// Neglect Factor เต็ม 1.0 เมื่อไม่ได้โฟกัส task นี้มานาน 14 วันขึ้นไป (§9.5)
const NEGLECT_FULL_DAYS = 14;

// Priority Factor (§9.5): high = 1, medium = 0.5, low หรือไม่ได้ตั้ง = 0
const PRIORITY_FACTOR = { high: 1, medium: 0.5, low: 0 };

// แปลง ISO string เป็น Date ถ้าอ่านไม่ได้ให้ throw (ข้อมูลใน DB ผ่านการตรวจก่อนเขียนแล้ว ถ้าหลุดมาแปลว่าข้อมูลเสีย)
function parseDate(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
  return date;
}

// ---------------------------------------------------------------------------
// Deadline State (ข้อ 1.5) และ Urgency Score (ข้อ 1.6)
// ---------------------------------------------------------------------------

// Deadline State ตามตาราง §9.2 คำนวณตอนอ่านทุกครั้ง ไม่เก็บลง DB
// เช็คตามลำดับ ข้อบนชนะข้อล่าง:
//   1. ไม่มี due_date       -> no_deadline
//   2. status = completed   -> completed  (เสร็จแล้วไม่เป็น overdue/due_today เด็ดขาด — ข้อตัดสินของเบล 2026-10-06)
//   3. due_date ก่อนวันนี้   -> overdue
//   4. due_date อยู่ในวันนี้ -> due_today
//   5. นอกนั้น              -> upcoming
// "วันนี้" = วันตามนาฬิกาเครื่อง เทียบระดับวัน เช่น due 09:00 ตอนนี้ 15:00 ยังเป็น due_today จนกว่าจะข้ามเที่ยงคืน
// ตัวอย่าง (ตอนนี้ = 6 ต.ค. 15:00): due 5 ต.ค. -> overdue / due 6 ต.ค. 09:00 -> due_today / due 7 ต.ค. -> upcoming
// now ส่งเองได้เพื่อใช้ทดสอบ
function computeDeadlineState(task, now = new Date()) {
  if (!task.due_date) return DEADLINE_STATE.NO_DEADLINE;
  if (task.status === TASK_STATUS.COMPLETED) return DEADLINE_STATE.COMPLETED;

  const due = parseDate(task.due_date, 'due_date');
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (due < startOfToday) return DEADLINE_STATE.OVERDUE;
  if (due < startOfTomorrow) return DEADLINE_STATE.DUE_TODAY;
  return DEADLINE_STATE.UPCOMING;
}

// Urgency Score ตามสูตร §9.5 ใช้เรียงลำดับ Task Board คำนวณตอนอ่านทุกครั้ง ไม่เก็บลง DB
//   score = (0.4 x deadline_urgency + 0.24 x progress_gap + 0.16 x neglect_factor + 0.2 x priority_factor) x 100
// ทั้ง 4 เทอมมีค่า 0..1 จึงได้คะแนน 0..100
// ตัวอย่าง: สร้าง 1 ต.ค. กำหนดส่ง 11 ต.ค. ตอนนี้ 6 ต.ค. (ผ่านไปครึ่งทาง = elapsed_fraction 0.5)
//   ทำไปแล้ว 20% (ควรถึง 50% -> progress_gap = 0.3), In Progress โฟกัสล่าสุด 7 วันก่อน (neglect = 7/14 = 0.5), priority high (= 1)
//   score = (0.4 x 0.5 + 0.24 x 0.3 + 0.16 x 0.5 + 0.2 x 1) x 100 = (0.2 + 0.072 + 0.08 + 0.2) x 100 = 55.2
//   deadline_urgency : Overdue = 1 ไม่งั้นเท่ากับ elapsed_fraction (เวลาผ่านไปกี่ส่วนของช่วง created_at -> due_date)
//   progress_gap     : ความคืบหน้าที่ "ควรถึง" ตามเวลา ลบความคืบหน้าจริงที่ผู้ใช้กรอก (ไม่ติดลบ)
//   neglect_factor   : เฉพาะ in_progress ที่เคยเริ่ม Pomodoro — ห่างจากครั้งล่าสุดกี่วัน / 14 (เต็มที่ 1)
//   priority_factor  : high 1 / medium 0.5 / low หรือไม่ตั้ง 0
// กฎยกเว้น: completed -> คืน null (ไม่เข้าการจัดอันดับ), ไม่มี due_date -> deadline_urgency และ progress_gap เป็น 0
// จุดที่ spec ไม่ได้ระบุ: ถ้า due_date ไม่หลัง created_at ให้ elapsed_fraction = 1 (กันหารด้วย 0),
//   last_focus_started_at อยู่ในอนาคตให้ neglect = 0, คืนค่าดิบไม่ปัดเศษ (หน้าจอปัดเอง)
function computeUrgencyScore(task, now = new Date()) {
  if (task.status === TASK_STATUS.COMPLETED) return null;

  let deadlineUrgency = 0;
  let progressGap = 0;

  if (task.due_date) {
    const created = parseDate(task.created_at, 'created_at');
    const due = parseDate(task.due_date, 'due_date');

    // elapsed_fraction = (now - created) / (due - created) ตัดให้อยู่ใน 0..1
    let elapsedFraction = 1;
    if (due > created) {
      elapsedFraction = Math.min(Math.max((now - created) / (due - created), 0), 1);
    }

    if (computeDeadlineState(task, now) === DEADLINE_STATE.OVERDUE) {
      deadlineUrgency = 1;
    } else {
      deadlineUrgency = elapsedFraction;
    }

    // ความคืบหน้าที่ควรถึง = elapsed_fraction x 100 (%) ลบของจริง แล้วหาร 100 กลับเป็น 0..1
    progressGap = Math.max(0, elapsedFraction * 100 - (task.progress_percentage ?? 0)) / 100;
  }

  let neglectFactor = 0;
  if (task.status === TASK_STATUS.IN_PROGRESS && task.last_focus_started_at) {
    const lastFocus = parseDate(task.last_focus_started_at, 'last_focus_started_at');
    const daysSinceFocus = (now - lastFocus) / MS_PER_DAY;
    neglectFactor = Math.min(Math.max(daysSinceFocus / NEGLECT_FULL_DAYS, 0), 1);
  }

  const priorityFactor = PRIORITY_FACTOR[task.priority] ?? 0;

  return (
    (WEIGHT_DEADLINE * deadlineUrgency +
      WEIGHT_PROGRESS_GAP * progressGap +
      WEIGHT_NEGLECT * neglectFactor +
      WEIGHT_PRIORITY * priorityFactor) *
    100
  );
}

// ---------------------------------------------------------------------------
// ตรวจข้อมูลที่รับมาจากหน้าจอ (ข้อ 1.4) — รูปแบบ payload ตาม docs/ipc-contract.md
// ---------------------------------------------------------------------------

// field ที่ผู้ใช้ส่งมาได้ตอนสร้าง / แก้ (นอกนี้ = reject) status ตอนสร้าง, source, completed_at ฯลฯ main ตั้งเอง
const CREATE_FIELDS = ['title', 'notes', 'due_date', 'progress_percentage', 'course_name', 'priority'];
const UPDATE_FIELDS = ['title', 'notes', 'status', 'due_date', 'progress_percentage', 'course_name', 'priority'];

// field ที่ส่ง null ได้ (ล้างค่า) ส่วน title / status / progress_percentage ห้าม null
const NULLABLE_FIELDS = ['notes', 'due_date', 'course_name', 'priority'];

// due_date ต้องเป็นวัน+เวลา ปฏิเสธวันที่ล้วนเช่น "2026-10-10" เพราะ JS ตีความเป็นเที่ยงคืน UTC
// ซึ่งอาจกลายเป็นคนละวันตามโซนเวลาของเครื่อง
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// ตรวจ object ที่ส่งมาทีละ field คืนเฉพาะ field ที่ส่งมา (ค่าที่ทำความสะอาดแล้ว) หรือ throw ถ้าไม่ถูกต้อง
// ค่า undefined ถือว่าไม่ได้ส่ง
function checkFields(input, allowedFields, label) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${label} must be an object`);
  }

  const clean = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowedFields.includes(key)) {
      throw new Error(`${label}: field not allowed: ${key}`);
    }
    if (value === undefined) continue;

    if (value === null && NULLABLE_FIELDS.includes(key)) {
      clean[key] = null;
    } else if (key === 'title') {
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error('title must be a non-empty string');
      }
      clean.title = value.trim();
    } else if (key === 'notes') {
      if (typeof value !== 'string') throw new Error('notes must be a string or null');
      clean.notes = value;
    } else if (key === 'status') {
      if (!Object.values(TASK_STATUS).includes(value)) {
        throw new Error(`status must be one of: ${Object.values(TASK_STATUS).join(', ')}`);
      }
      clean.status = value;
    } else if (key === 'due_date') {
      if (typeof value !== 'string' || !ISO_DATE_TIME.test(value) || Number.isNaN(new Date(value).getTime())) {
        throw new Error('due_date must be an ISO 8601 date-time string (e.g. 2026-10-10T17:00:00.000Z) or null');
      }
      clean.due_date = new Date(value).toISOString(); // เก็บรูปแบบเดียวกันทุกแถว
    } else if (key === 'progress_percentage') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error('progress_percentage must be a number between 0 and 100');
      }
      clean.progress_percentage = value;
    } else if (key === 'course_name') {
      if (typeof value !== 'string') throw new Error('course_name must be a string or null');
      clean.course_name = value.trim() === '' ? null : value.trim();
    } else if (key === 'priority') {
      if (!Object.values(TASK_PRIORITY).includes(value)) {
        throw new Error(`priority must be one of: ${Object.values(TASK_PRIORITY).join(', ')} or null`);
      }
      clean.priority = value;
    }
  }
  return clean;
}

function checkId(id) {
  if (typeof id !== 'string' || id === '') {
    throw new Error('id must be a non-empty string');
  }
}

// เพิ่ม deadline_state และ urgency_score (คำนวณตอนอ่าน ไม่เก็บใน DB) ให้แถวจากตาราง tasks
function toTask(row, now = new Date()) {
  return {
    ...row,
    deadline_state: computeDeadlineState(row, now),
    urgency_score: computeUrgencyScore(row, now),
  };
}

// ---------------------------------------------------------------------------
// CRUD (ข้อ 1.4)
// ---------------------------------------------------------------------------

// task ทั้งหมดที่ยังไม่ถูกลบ (หน้าจอเรียงเองด้วย urgency_score)
function listTasks() {
  const now = new Date();
  const rows = getDb().prepare('SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at, id').all();
  return rows.map((row) => toTask(row, now));
}

// task ตาม id หรือ null ถ้าไม่พบ/ถูกลบแล้ว
function getTask(id) {
  checkId(id);
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  return row ? toTask(row) : null;
}

// สร้าง task ด้วยมือ (source = manual) title จำเป็น ส่วนที่เหลือไม่บังคับ
// main ตั้ง id, status = not_started, source = manual, created_at / updated_at ให้เอง
// task จาก Classroom (ข้อ 6) และ LINE (ข้อ 8) ไม่ผ่านฟังก์ชันนี้
function createTask(input) {
  const fields = checkFields(input, CREATE_FIELDS, 'task');
  if (fields.title === undefined) {
    throw new Error('title is required');
  }

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    title: fields.title,
    notes: fields.notes ?? null,
    status: TASK_STATUS.NOT_STARTED,
    due_date: fields.due_date ?? null,
    progress_percentage: fields.progress_percentage ?? 0,
    priority: fields.priority ?? null,
    source: TASK_SOURCE.MANUAL,
    course_name: fields.course_name ?? null,
    created_at: now,
    updated_at: now,
  };

  getDb()
    .prepare(
      `INSERT INTO tasks
         (id, title, notes, status, due_date, progress_percentage, priority, source, course_name, created_at, updated_at)
       VALUES
         (@id, @title, @notes, @status, @due_date, @progress_percentage, @priority, @source, @course_name, @created_at, @updated_at)`
    )
    .run(row);

  return getTask(row.id);
}

// แก้ task เฉพาะ field ใน UPDATE_FIELDS (ผิดข้อเดียว reject ทั้งคำขอ ไม่แก้บางส่วน)
//   - เปลี่ยน status เป็น completed -> ตั้ง completed_at (ถ้าเสร็จอยู่แล้วคงค่าเดิม)
//   - ย้อน status จาก completed -> ล้าง completed_at เป็น null
//   - Not Started -> In Progress อัตโนมัติเป็นหน้าที่ของ Pomodoro เท่านั้น (§9.1) ผู้ใช้แก้ status เองได้ทุกเมื่อ
//   - updated_at อัปเดตทุกครั้ง (ใช้กับ LWW sync เท่านั้น ไม่ใช่สัญญาณ activity §19)
function updateTask(id, changes) {
  checkId(id);
  const clean = checkFields(changes, UPDATE_FIELDS, 'changes');
  if (Object.keys(clean).length === 0) {
    throw new Error('changes must contain at least one field');
  }

  const db = getDb();
  const existing = db.prepare('SELECT status FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) {
    throw new Error(`Task not found: ${id}`);
  }

  const now = new Date().toISOString();
  const updates = { ...clean, updated_at: now };

  if (clean.status === TASK_STATUS.COMPLETED && existing.status !== TASK_STATUS.COMPLETED) {
    updates.completed_at = now;
  } else if (clean.status !== undefined && clean.status !== TASK_STATUS.COMPLETED) {
    updates.completed_at = null;
  }

  // ชื่อคอลัมน์มาจาก key ที่ผ่าน checkFields แล้วเท่านั้น จึงต่อเป็น SQL ได้ปลอดภัย (ค่าใช้ parameter เสมอ)
  const assignments = Object.keys(updates).map((column) => `${column} = @${column}`);
  db.prepare(`UPDATE tasks SET ${assignments.join(', ')} WHERE id = @id`).run({ ...updates, id });

  return getTask(id);
}

// Soft delete: ตั้ง deleted_at (§18.2) แถวยังอยู่ใน DB เพื่อให้ sync ส่งสถานะลบไป Supabase ได้
// ไม่แตะ classroom_sync_state — การลบ task ไม่ทำให้ item Classroom เดิมถูกดึงกลับมา (§13.5)
function deleteTask(id) {
  checkId(id);
  const now = new Date().toISOString();
  const result = getDb()
    .prepare('UPDATE tasks SET deleted_at = @now, updated_at = @now WHERE id = @id AND deleted_at IS NULL')
    .run({ now, id });
  if (result.changes === 0) {
    throw new Error(`Task not found: ${id}`);
  }
  return { id };
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  computeDeadlineState,
  computeUrgencyScore,
};
