// Owner: Backend
// หน้าที่: คำนวณ metrics ของ Dashboard ตามช่วงเวลา This Week / This Month / All Time
// อ้างอิง: PROJECT_v0.14 section 10 (ตาราง 10.2 และสูตร Time-to-Start Lag 10.3)

'use strict';

const { getDb } = require('../db/database');
const { computeDeadlineState } = require('./task.service');
const { TASK_STATUS, DEADLINE_STATE, DASHBOARD_RANGE } = require('../../shared/constants');

// ปัดเป็นทศนิยม 1 ตำแหน่ง เช่น 33.3333 -> 33.3
function round1(value) {
  return Math.round(value * 10) / 10;
}

// ช่วงเวลา [start, end) ตามเวลาเครื่อง: เริ่มนับ inclusive จบ exclusive
// all_time -> start/end เป็น null (ไม่จำกัด)
// สัปดาห์เริ่มวันจันทร์ เช่น ศุกร์ 16 ต.ค. 2026 -> [จ. 12 ต.ค. 00:00, จ. 19 ต.ค. 00:00)
// เดือน เช่น 16 ต.ค. -> [1 ต.ค. 00:00, 1 พ.ย. 00:00)
function getRangeBounds(range, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  if (range === DASHBOARD_RANGE.ALL_TIME) {
    return { start: null, end: null };
  }
  if (range === DASHBOARD_RANGE.THIS_WEEK) {
    const daysSinceMonday = (now.getDay() + 6) % 7; // อาทิตย์(0)->6, จันทร์(1)->0, ศุกร์(5)->4
    return {
      start: new Date(year, month, day - daysSinceMonday),
      end: new Date(year, month, day - daysSinceMonday + 7),
    };
  }
  if (range === DASHBOARD_RANGE.THIS_MONTH) {
    return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
  }
  throw new Error(`range must be one of: ${Object.values(DASHBOARD_RANGE).join(', ')}`);
}

// Time-to-Start Lag ของ task 1 ตัว (§10.3) คืนเปอร์เซ็นต์ หรือ null ถ้า task นี้ไม่เข้าเงื่อนไข
//   window_total     = due_date - created_at
//   elapsed_to_start = first_started_at - created_at   (ติดลบให้เป็น 0, ไม่ตัดขอบบน)
//   start_percentage = elapsed_to_start / window_total x 100
// ตัวอย่าง: สร้าง 4 ต.ค. 00:00, due 14 ต.ค. 00:00 (window 10 วัน), กด Start Working 8 ต.ค. 12:00 (ผ่านไป 4.5 วัน)
//   -> 4.5 / 10 x 100 = 45
// null (ตัดออก ไม่นับเป็น 0): ไม่มี due_date / ไม่เคยกด Start Working / due_date ไม่หลัง created_at
function computeStartPercentage(task) {
  if (!task.due_date || !task.first_started_at) return null;

  const created = new Date(task.created_at).getTime();
  const due = new Date(task.due_date).getTime();
  const started = new Date(task.first_started_at).getTime();

  const windowTotal = due - created;
  if (windowTotal <= 0) return null;

  const elapsed = Math.max(0, started - created);
  return (elapsed / windowTotal) * 100;
}

// metrics ทั้ง 6 ตัวของช่วงที่เลือก (§10.2) ดึง task ที่ยังไม่ถูกลบมาครั้งเดียวแล้วนับด้วย JS
// now ส่งเองได้เพื่อใช้ทดสอบ
function getMetrics(range, now = new Date()) {
  const { start, end } = getRangeBounds(range, now);
  const isAllTime = start === null;

  // เวลา value อยู่ในช่วงไหม (value = ISO string หรือ null)
  const inRange = (value) => {
    if (!value) return false;
    const time = new Date(value);
    return isAllTime || (time >= start && time < end);
  };
  // due_date อยู่ในช่วง: task ที่ไม่มี due_date นับเฉพาะ All Time (§10.2)
  const dueInRange = (task) => (task.due_date ? inRange(task.due_date) : isAllTime);

  const tasks = getDb().prepare('SELECT * FROM tasks WHERE deleted_at IS NULL').all();

  let total = 0;
  let completed = 0;
  let remaining = 0;
  let overdue = 0;
  let completedWithDue = 0; // completed + due ในช่วง (ตัวหารของ % Before Deadline)
  let onTime = 0; //            ในกลุ่มนั้นที่ completed_at <= due_date
  const lags = []; //           start_percentage ของ task ที่เข้าเงื่อนไข

  for (const task of tasks) {
    const isCompleted = task.status === TASK_STATUS.COMPLETED;

    if (dueInRange(task)) {
      total += 1;
      if (!isCompleted) remaining += 1;
    }
    if (isCompleted && inRange(task.completed_at)) completed += 1;

    // Overdue ไม่สนช่วงเวลา (real-time) ใช้กฎเดียวกับข้อ 1.5
    if (computeDeadlineState(task, now) === DEADLINE_STATE.OVERDUE) overdue += 1;

    // % Completed Before Deadline: เฉพาะ task ที่ completed, มี due_date และ due อยู่ในช่วง
    // ตัวอย่าง: 4 task เสร็จ, 3 ตัวเสร็จก่อน/ตรง due -> 3 / 4 x 100 = 75
    if (isCompleted && task.due_date && task.completed_at && dueInRange(task)) {
      completedWithDue += 1;
      if (new Date(task.completed_at) <= new Date(task.due_date)) onTime += 1;
    }

    // Lag: task ต้องมี due_date อยู่ในช่วง (computeStartPercentage ตัดเคสอื่นให้แล้ว)
    if (task.due_date && dueInRange(task)) {
      const percentage = computeStartPercentage(task);
      if (percentage !== null) lags.push(percentage);
    }
  }

  return {
    range,
    total_assignments: total,
    completed_assignments: completed,
    remaining_assignments: remaining,
    overdue_assignments: overdue,
    // ตัวหารเป็น 0 -> null ให้หน้าจอโชว์ empty state
    percent_completed_before_deadline: completedWithDue === 0 ? null : round1((onTime / completedWithDue) * 100),
    average_time_to_start_lag: lags.length === 0 ? null : round1(lags.reduce((sum, x) => sum + x, 0) / lags.length),
  };
}

module.exports = {
  getRangeBounds,
  computeStartPercentage,
  getMetrics,
};
