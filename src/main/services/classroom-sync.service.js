// Owner: Backend
// หน้าที่: เชื่อมต่อ Google Classroom, fetch ตอนเปิดแอป + Sync now, คิว review (pending/imported/ignored) (ข้อ 6.3-6.7)
// อ้างอิง: PROJECT_v0.15 section 9.1, 13, 19 และ docs/ipc-contract.md — login/token อยู่ใน google-auth.service.js

'use strict';

const crypto = require('crypto');
const { BrowserWindow } = require('electron');
const { classroom } = require('@googleapis/classroom');
const { getDb } = require('../db/database');
const { EVENTS } = require('../../shared/ipc-channels');
const { TASK_STATUS, TASK_SOURCE } = require('../../shared/constants');
const { getSettings, setSetting } = require('./settings.service');
const googleAuth = require('./google-auth.service');

// ---------------------------------------------------------------------------
// ตัวช่วยเล็ก ๆ
// ---------------------------------------------------------------------------

function countPending() {
  return getDb().prepare("SELECT COUNT(*) AS n FROM classroom_sync_state WHERE state = 'pending'").get().n;
}

// บอกทุกหน้าต่างว่ามีงาน pending ใหม่ (ข้อ 6.7) main ไม่เปิด popup เอง หน้าจอเป็นคนตัดสินว่าจะเด้งหรือแสดงตัวบอกเงียบ ๆ
function sendPendingChanged() {
  const data = { pending_count: countPending() };
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(EVENTS.CLASSROOM_PENDING_CHANGED, data);
  }
}

// แปลง error จาก Google เป็นข้อความที่อ่านรู้เรื่อง
// invalid_grant = refresh token หมดอายุ/ถูกถอนสิทธิ์ (ถ้า consent screen ยังเป็น Testing จะหมดใน 7 วัน) -> ลบ token ให้เชื่อมใหม่
function explainGoogleError(err) {
  const text = `${err?.message ?? ''} ${err?.response?.data?.error ?? ''}`;
  if (text.includes('invalid_grant')) {
    googleAuth.signOut();
    return new Error('การเชื่อมต่อ Google หมดอายุหรือถูกยกเลิก กรุณากด Connect ใหม่ใน Settings');
  }
  if (['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(err?.code)) {
    return new Error('ต่อ Google ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  }
  return err;
}

// ดึงรายการทุกหน้า (Google ส่งมาทีละหน้า พร้อม nextPageToken ถ้ายังมีต่อ) key = ชื่อ field ที่เก็บรายการ เช่น 'courses'
async function listAll(call, params, key) {
  const items = [];
  let pageToken;
  do {
    const res = await call({ ...params, pageToken });
    items.push(...(res.data[key] ?? []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return items;
}

// due ของ Classroom แยกวัน/เวลาเป็น UTC -> ISO เช่น วัน 2026-11-02 เวลา 16:59 -> '2026-11-02T16:59:00.000Z' (= 23:59 เวลาไทย)
// มีวันแต่ไม่มีเวลา = 23:59 เวลาเครื่องของวันนั้น  ไม่มีวัน = null
// (Google ละ field ที่เป็น 0 ไว้ จึงใช้ ?? 0 ถ้า dueTime มาแค่บางส่วน)
function toDueDate(work) {
  const day = work.dueDate;
  if (!day?.year) return null;
  if (work.dueTime) {
    return new Date(Date.UTC(day.year, day.month - 1, day.day, work.dueTime.hours ?? 0, work.dueTime.minutes ?? 0)).toISOString();
  }
  return new Date(day.year, day.month - 1, day.day, 23, 59).toISOString();
}

// notes = คำอธิบายงาน + ลิงก์ไปหน้างานใน Classroom (ลิงก์อยู่บรรทัดของตัวเองให้ copy ง่าย) ไม่มีทั้งคู่ = null
function toNotes(work) {
  const parts = [];
  if (work.description?.trim()) parts.push(work.description.trim());
  if (work.alternateLink) parts.push(`ลิงก์งานใน Classroom:\n${work.alternateLink}`);
  return parts.length > 0 ? parts.join('\n\n') : null;
}

// ---------------------------------------------------------------------------
// เชื่อมต่อ / สถานะ (ข้อ 6.2, 6.3)
// ---------------------------------------------------------------------------

// สถานะที่หน้าจอใช้ เช่น { connected: true, account_email: 'a@gmail.com', last_synced_at: '2026-10-29T...', cutoff_date: '2026-08-01T...' }
function getStatus() {
  const account = googleAuth.getAccount();
  const settings = getSettings();
  return {
    connected: account !== null,
    account_email: account ? account.account_email : null,
    last_synced_at: settings.classroom_last_synced_at,
    cutoff_date: settings.classroom_cutoff_date,
  };
}

// เชื่อมอยู่แล้วคืนสถานะเดิม (รองรับบัญชีเดียว §13.1) ยังไม่เชื่อมให้ login แล้วคืนสถานะใหม่
// ไม่บังคับ cutoff ตรงนี้ แต่ fetch จะไม่ทำงานจนกว่าจะตั้ง (§13.1)
async function connect() {
  if (!googleAuth.getAccount()) await googleAuth.signIn();
  return getStatus();
}

// ลบ token กับล้าง cutoff ไม่ลบ task ที่ import แล้ว (§13.4) ไม่แตะ classroom_sync_state
// ล้าง cutoff เพื่อให้ connect ครั้งหน้าต้องเลือกวันใหม่ (แก้กรณีเลือกวันผิด) งานที่เคย import/ignore แล้วยังไม่กลับมาให้เลือกอีก
function disconnect() {
  googleAuth.signOut();
  setSetting('classroom_cutoff_date', null);
  return getStatus();
}

// ---------------------------------------------------------------------------
// fetch (ข้อ 6.4, 6.6)
// ---------------------------------------------------------------------------

// ขั้นตอน §13.5 ข้อ 1-4: ดึงงานทุกวิชา -> เอาเฉพาะ ASSIGNMENT -> ตัดที่สร้างก่อน cutoff -> ข้ามที่เคยเห็น -> บันทึกใหม่เป็น pending
async function fetchNew() {
  const cutoff = getSettings().classroom_cutoff_date;
  if (!cutoff) throw new Error('ตั้งวัน cutoff ก่อน (import งานที่สร้างตั้งแต่วันไหน) ใน Settings');

  const api = classroom({ version: 'v1', auth: googleAuth.getAuthClient() });
  // OR IGNORE: assignment ที่มีแถวอยู่แล้ว (pending/imported/ignored/excluded) ถูกข้ามเอง ไม่แตะแถวเดิมเลย (§13.5 ข้อ 3)
  const insert = getDb().prepare(
    `INSERT OR IGNORE INTO classroom_sync_state
       (classroom_assignment_id, course_name, last_seen_updated, state, title, due_date, notes)
     VALUES (@id, @course_name, @last_seen_updated, 'pending', @title, @due_date, @notes)`
  );

  let newItems = 0;
  try {
    const courses = await listAll((p) => api.courses.list(p), { studentId: 'me', courseStates: ['ACTIVE'] }, 'courses');
    for (const course of courses) {
      const works = await listAll((p) => api.courses.courseWork.list(p), { courseId: course.id, courseWorkStates: ['PUBLISHED'] }, 'courseWork');
      for (const work of works) {
        if (work.workType !== 'ASSIGNMENT') continue;
        if (new Date(work.creationTime) < new Date(cutoff)) continue; // สร้างก่อนวัน cutoff

        const result = insert.run({
          id: `${course.id}:${work.id}`, // เช่น '1111:9001'
          course_name: course.name,
          last_seen_updated: work.updateTime ?? work.creationTime,
          title: work.title,
          due_date: toDueDate(work),
          notes: toNotes(work),
        });
        newItems += result.changes; // 1 = แถวใหม่, 0 = มีอยู่แล้วถูกข้าม
      }
    }
  } catch (err) {
    throw explainGoogleError(err);
  }

  setSetting('classroom_last_synced_at', new Date().toISOString());
  if (newItems > 0) sendPendingChanged();
  return { new_items: newItems, pending: countPending() };
}

// fetch ที่กำลังวิ่งอยู่ (ถ้ามี) เปิดแอปแล้วกด Sync ทันทีจะใช้ผลเดียวกัน ไม่ยิง Google ซ้อน
let running = null;
function runFetch() {
  if (!running) {
    running = fetchNew().finally(() => {
      running = null;
    });
  }
  return running;
}

// เรียกครั้งเดียวตอนเปิดแอป: ยังไม่เชื่อมหรือยังไม่ตั้ง cutoff ข้ามเงียบ ๆ, error แค่ log (ไม่ให้แอปล้ม)
async function fetchOnLaunch() {
  try {
    if (!googleAuth.getAccount() || !getSettings().classroom_cutoff_date) return;
    await runFetch();
  } catch (err) {
    console.error('[classroom] fetch ตอนเปิดแอปไม่สำเร็จ:', err.message);
  }
}

// ปุ่ม Sync now: error ส่งกลับให้หน้าจอแสดง
async function syncNow() {
  if (!googleAuth.getAccount()) throw new Error('ยังไม่ได้เชื่อม Google Classroom');
  return runFetch();
}

// ---------------------------------------------------------------------------
// review (ข้อ 6.5)
// ---------------------------------------------------------------------------

// รายการที่รอตัดสินใจ (§13.5 ข้อ 6) เรียงตามกำหนดส่ง งานไม่มี due ไว้ท้าย ยังไม่เชื่อมบัญชี = ไม่แสดง
function getPendingItems() {
  if (!googleAuth.getAccount()) return [];
  return getDb()
    .prepare(
      `SELECT classroom_assignment_id AS id, title, course_name, due_date
       FROM classroom_sync_state
       WHERE state = 'pending'
       ORDER BY due_date IS NULL, due_date, title`
    )
    .all();
}

// ตัดสินใจ 1 รายการ payload = { id, decision: 'import' | 'ignore' } ทั้งคู่ถาวร (§13.5)
async function decideItem(payload) {
  if (!payload || typeof payload !== 'object' || Object.keys(payload).some((k) => k !== 'id' && k !== 'decision')) {
    throw new Error('payload ต้องเป็น { id, decision }');
  }
  const { id, decision } = payload;
  if (typeof id !== 'string' || id === '') throw new Error('id ต้องเป็น string');
  if (decision !== 'import' && decision !== 'ignore') throw new Error(`decision ต้องเป็น 'import' หรือ 'ignore': ${decision}`);

  const db = getDb();
  const item = db.prepare("SELECT * FROM classroom_sync_state WHERE classroom_assignment_id = ? AND state = 'pending'").get(id);
  if (!item) throw new Error(`ไม่พบรายการที่รอตัดสินใจ: ${id}`);

  if (decision === 'ignore') {
    db.prepare("UPDATE classroom_sync_state SET state = 'ignored' WHERE classroom_assignment_id = ?").run(id);
    return { id, decision };
  }

  // import: ถามสถานะการส่งงานจาก Google ตอนนี้ (§9.1) id เป็นรูป 'courseId:courseWorkId'
  const [courseId, courseWorkId] = id.split(':');
  let submissions;
  try {
    const api = classroom({ version: 'v1', auth: googleAuth.getAuthClient() });
    const res = await api.courses.courseWork.studentSubmissions.list({ courseId, courseWorkId, userId: 'me' });
    submissions = res.data.studentSubmissions ?? [];
  } catch (err) {
    if ((err?.status ?? err?.response?.status) === 404) {
      throw new Error('ไม่พบงานนี้ใน Classroom แล้ว (อาจถูกลบ) กด Ignore ได้');
    }
    throw explainGoogleError(err);
  }

  // ส่งแล้ว (TURNED_IN) หรืออาจารย์คืนแล้ว (RETURNED) = Completed ที่เหลือ (NEW, CREATED ฯลฯ) = Not Started
  // เช่น state 'TURNED_IN' -> status completed, progress 100, completed_at = ตอนนี้
  const submitted = ['TURNED_IN', 'RETURNED'].includes(submissions[0]?.state);
  const now = new Date().toISOString();
  const taskId = crypto.randomUUID();

  // สร้าง task กับเปลี่ยน state เป็น imported ใน transaction เดียว พังอย่างใดอย่างหนึ่ง = ไม่เปลี่ยนอะไรเลย
  db.transaction(() => {
    db.prepare(
      `INSERT INTO tasks
         (id, title, notes, status, due_date, progress_percentage, source, classroom_assignment_id,
          course_name, classroom_last_updated, completed_at, created_at, updated_at)
       VALUES
         (@id, @title, @notes, @status, @due_date, @progress, @source, @assignment_id,
          @course_name, @last_updated, @completed_at, @now, @now)`
    ).run({
      id: taskId,
      title: item.title,
      notes: item.notes,
      status: submitted ? TASK_STATUS.COMPLETED : TASK_STATUS.NOT_STARTED,
      due_date: item.due_date,
      progress: submitted ? 100 : 0,
      source: TASK_SOURCE.GOOGLE_CLASSROOM,
      assignment_id: id,
      course_name: item.course_name,
      last_updated: item.last_seen_updated,
      completed_at: submitted ? now : null,
      now,
    });
    db.prepare("UPDATE classroom_sync_state SET state = 'imported', linked_task_id = ? WHERE classroom_assignment_id = ?").run(taskId, id);
  })();

  return { id, decision };
}

module.exports = {
  connect,
  disconnect,
  getStatus,
  fetchOnLaunch,
  syncNow,
  getPendingItems,
  decideItem,
};
