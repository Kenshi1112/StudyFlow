// Owner: Backend
// หน้าที่: sync tasks และ pomodoro_sessions กับ Supabase (push/pull, LWW) และจัดการการเชื่อมต่อ LINE ฝั่งแอป
// อ้างอิง: PROJECT_v0.15 section 14.2, 18 — ส่วน LINE (ข้อ 8) ยังเป็น stub

'use strict';

const path = require('path');
const { app } = require('electron');
const { createClient } = require('@supabase/supabase-js');
const { getDb } = require('../db/database');
const googleAuth = require('./google-auth.service');

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // sync เต็มรอบ (push + pull) ทุก 5 นาที (§18.2: 5-10 นาที)
const DIRTY_CHECK_MS = 10 * 1000; // ทุก 10 วิดูว่ามีแถวที่แก้แล้วยังไม่ส่งไหม ถ้ามีส่งเลย = debounce (แก้รัว ๆ ใน 10 วิ ส่งรอบเดียว)
const PAGE_SIZE = 500; // pull ทีละกี่แถว (Supabase ตอบได้ไม่เกิน 1000 แถวต่อครั้ง)

// ตารางที่ sync (§18.2) tasks ต้องมาก่อน เพราะ pomodoro_sessions อ้าง tasks.id (มี FK ทั้งสองฝั่ง)
// columns = คอลัมน์ที่ส่ง/รับ (ไม่รวม updated_at: server ตั้งให้เอง ส่งไปก็ถูกทับ)
// dates = ฝั่ง server เป็น timestamptz, booleans = ในเครื่องเก็บ 0/1 แต่ฝั่ง server เป็น true/false
const TABLES = [
  {
    name: 'tasks',
    columns: [
      'id', 'title', 'notes', 'status', 'due_date', 'progress_percentage', 'priority', 'source',
      'classroom_assignment_id', 'course_name', 'classroom_last_updated', 'completed_at', 'deleted_at',
      'first_started_at', 'last_focus_started_at', 'created_at',
    ],
    dates: ['due_date', 'classroom_last_updated', 'completed_at', 'deleted_at', 'first_started_at', 'last_focus_started_at', 'created_at'],
    booleans: [],
  },
  {
    name: 'pomodoro_sessions',
    columns: [
      'id', 'task_id', 'started_at', 'planned_duration_seconds', 'actual_duration_seconds', 'completed',
      'batch_id', 'session_index', 'session_total', 'created_at',
    ],
    dates: ['started_at', 'created_at'],
    booleans: ['completed'],
  },
];

let client = null; // Supabase client ที่ login แล้ว เก็บในหน่วยความจำอย่างเดียว (เปิดแอปใหม่ก็ขอใหม่จาก refresh token ของ Google)
let clientEmail = null; // บัญชี Google ที่ client ตัวนี้ login ไว้ (เปลี่ยนบัญชี = login ใหม่)
let isSyncing = false; // กันสองรอบทับกัน
let lastSyncFailed = false; // รอบล่าสุดพลาดไหม: ถ้าพลาด timer 10 วิ จะไม่ลองซ้ำ รอ timer 5 นาที (§18.2 retry รอบถัดไป)
let intervalTimer = null;
let dirtyTimer = null;

// อ่าน/เขียน key-value ใน table settings (เก็บเป็น JSON เหมือน settings.service)
// เขียนตรงที่นี่เพราะ settings.service รับเฉพาะ key ที่ลงทะเบียนไว้ และเราไม่อยากให้ cursor โผล่ใน settings:get
function readSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

function writeSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

// sync ครั้งแรกสุด: ข้อมูลที่มีอยู่ก่อนมีระบบ sync ไม่อยู่ใน sync_dirty จึงใส่ให้ทุกแถวหนึ่งครั้ง (ทำครั้งเดียว จด flag ไว้)
function queueExistingRowsOnce() {
  if (readSetting('sync_existing_rows_queued')) return;
  const db = getDb();
  db.transaction(() => {
    for (const table of TABLES) {
      db.prepare(`INSERT OR IGNORE INTO sync_dirty (table_name, row_id) SELECT '${table.name}', id FROM ${table.name}`).run();
    }
    writeSetting('sync_existing_rows_queued', true);
  })();
}

// คืน Supabase client ที่ login แล้ว (null = ยังไม่ได้เชื่อม Google ก็ไม่ sync ตาม §20 known limitation)
// login = เอา id token จาก Google ไปแลกเป็น session ของ Supabase (ใช้บัญชี Google เดียวกับ Classroom)
async function getClient() {
  const account = googleAuth.getAccount();
  if (!account) {
    client = null;
    return null;
  }
  if (client && clientEmail === account.account_email) return client;

  try {
    process.loadEnvFile(path.join(app.getAppPath(), '.env')); // เหมือน google-auth (ไม่มีไฟล์ก็ไม่เป็นไร)
  } catch {
    // ใช้ environment variable ที่ตั้งไว้แล้วแทน
  }
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error('ไม่พบ SUPABASE_URL / SUPABASE_ANON_KEY (ใส่ในไฟล์ .env ที่รากโปรเจกต์)');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: await googleAuth.getIdToken() });
  if (error) throw new Error(`login Supabase ไม่สำเร็จ: ${error.message}`);

  client = supabase;
  clientEmail = account.account_email;
  return client;
}

// local -> Supabase: ส่งแถวที่อยู่ใน sync_dirty ทีละแถว คืนจำนวนแถวที่ส่งไม่สำเร็จ
// server ตั้ง updated_at ให้เองด้วย trigger (7.2) ตอนนี้แถวนี้จึงเป็น "เขียนล่าสุด" บน server
async function pushLocalChanges(supabase) {
  const db = getDb();
  let failed = 0;

  for (const table of TABLES) {
    const ids = db.prepare('SELECT row_id FROM sync_dirty WHERE table_name = ?').all(table.name).map((r) => r.row_id);

    for (const id of ids) {
      // เอาออกจาก sync_dirty "ก่อน" ส่ง: ถ้าระหว่างรอ server ตอบผู้ใช้แก้แถวนี้อีก trigger จะใส่กลับให้เอง การแก้นั้นจะไม่หาย
      db.prepare('DELETE FROM sync_dirty WHERE table_name = ? AND row_id = ?').run(table.name, id);

      const row = db.prepare(`SELECT ${table.columns.join(', ')} FROM ${table.name} WHERE id = ?`).get(id);
      if (!row) continue;
      for (const column of table.booleans) row[column] = row[column] === 1; // 1 -> true

      const { error } = await supabase.from(table.name).upsert(row); // ไม่มี id นี้ = เพิ่ม มีแล้ว = แก้
      if (error) {
        // ส่งไม่สำเร็จ (ออฟไลน์ ฯลฯ): ใส่กลับไว้ส่งรอบหน้า แถวอื่นยังส่งต่อ ไม่ให้แถวเดียวที่เสียมาขวางทั้งหมด
        db.prepare('INSERT OR IGNORE INTO sync_dirty (table_name, row_id) VALUES (?, ?)').run(table.name, id);
        failed++;
        console.warn(`[cloud-sync] ส่ง ${table.name} ${id} ไม่สำเร็จ: ${error.message}`);
      }
    }
  }
  return failed;
}

// เขียนแถวที่ดึงมาลง SQLite ทั้งหน้าใน transaction เดียว พร้อมเลื่อน cursor คืนค่า updated_at ล่าสุด (ใช้เป็น cursor ต่อ)
function applyRemoteRows(table, rows, cursorKey, cursor) {
  const db = getDb();
  const columns = [...table.columns, 'updated_at'];
  const upsert = db.prepare(
    `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${columns.map((c) => '@' + c).join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${columns.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}`
  );
  let newest = cursor;

  db.transaction(() => {
    for (const remote of rows) {
      // แปลงเป็นรูปแบบในเครื่อง: เวลา '2026-10-30T10:00:03.412345+00:00' -> '2026-10-30T10:00:03.412Z', true -> 1
      const row = {};
      for (const column of columns) row[column] = remote[column] ?? null;
      for (const column of [...table.dates, 'updated_at']) {
        if (row[column]) row[column] = new Date(row[column]).toISOString();
      }
      for (const column of table.booleans) row[column] = row[column] ? 1 : 0;

      if (newest === null || row.updated_at > newest) newest = row.updated_at;

      // แถวที่แก้ในเครื่องแล้วยังไม่ได้ส่ง = เครื่องนี้เขียนล่าสุด ข้ามไป เดี๋ยวจะถูกส่งทับ server ทีหลัง (เขียนทีหลังชนะ)
      const dirty = db.prepare('SELECT 1 FROM sync_dirty WHERE table_name = ? AND row_id = ?').get(table.name, row.id);
      if (dirty) continue;

      // updated_at ตรงกัน = มีข้อมูลชุดนี้อยู่แล้ว (เช่น แถวที่ขอบ cursor ถูกดึงซ้ำ) ไม่ต้องเขียน
      const local = db.prepare(`SELECT updated_at FROM ${table.name} WHERE id = ?`).get(row.id);
      if (local && local.updated_at === row.updated_at) continue;

      try {
        upsert.run(row);
      } catch (error) {
        // เช่น งาน Classroom เดียวกันที่สองเครื่อง import เป็นคนละ id จะชน UNIQUE ของ classroom_assignment_id ข้ามแถวนี้ ไม่ให้ทั้งรอบพัง
        console.warn(`[cloud-sync] ข้าม ${table.name} ${row.id}: ${error.message}`);
        continue;
      }
      // trigger เพิ่งใส่แถวนี้ลง sync_dirty แต่ข้อมูลมาจาก server อยู่แล้ว ไม่ต้องส่งกลับ
      db.prepare('DELETE FROM sync_dirty WHERE table_name = ? AND row_id = ?').run(table.name, row.id);
    }
    writeSetting(cursorKey, newest);
  })();

  return newest;
}

// Supabase -> local: ดึงแถวที่ server แก้ตั้งแต่ cursor (updated_at ล่าสุดที่เคยดึง) เช่น cursor = '2026-10-30T10:00:03.412Z'
// ใช้ >= (ไม่ใช่ >) เพื่อไม่ให้แถวที่เวลาเท่ากับ cursor หลุด ส่วนที่ได้ซ้ำถูกข้ามใน applyRemoteRows
async function pullRemoteChanges(supabase) {
  for (const table of TABLES) {
    const cursorKey = `sync_cursor_${table.name}`;
    let cursor = readSetting(cursorKey); // null = ยังไม่เคยดึง ดึงทั้งหมด

    for (;;) {
      let query = supabase.from(table.name).select('*').order('updated_at', { ascending: true }).limit(PAGE_SIZE);
      if (cursor) query = query.gte('updated_at', cursor);
      const { data, error } = await query;
      if (error) throw new Error(`ดึง ${table.name} ไม่สำเร็จ: ${error.message}`);
      if (data.length === 0) break;

      const newest = applyRemoteRows(table, data, cursorKey, cursor);
      if (data.length < PAGE_SIZE || newest === cursor) break; // หมดแล้ว (หรือ cursor ไม่ขยับ กันวนไม่รู้จบ)
      cursor = newest;
    }
  }
}

// sync 1 รอบ: ส่งก่อนแล้วค่อยดึง (ของที่ส่งทีหลังชนะ) ไม่ throw: พลาดแค่ log แล้วรอรอบหน้า
async function syncOnce() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const supabase = await getClient();
    if (!supabase) return; // ยังไม่ได้เชื่อม Google

    queueExistingRowsOnce();
    const failed = await pushLocalChanges(supabase);
    await pullRemoteChanges(supabase);
    lastSyncFailed = failed > 0;
  } catch (error) {
    lastSyncFailed = true;
    console.warn(`[cloud-sync] sync ไม่สำเร็จ จะลองใหม่รอบหน้า: ${error.message}`);
  } finally {
    isSyncing = false;
  }
}

// เริ่ม sync ตอนเปิดแอป: รอบแรกทันที แล้วทุก 5 นาที + ทุก 10 วิเช็คว่ามีของที่แก้ในเครื่องรอส่งไหม
function startSync() {
  if (intervalTimer) return;
  intervalTimer = setInterval(syncOnce, SYNC_INTERVAL_MS);
  dirtyTimer = setInterval(() => {
    const dirty = getDb().prepare('SELECT 1 FROM sync_dirty LIMIT 1').get();
    if (dirty && !lastSyncFailed) syncOnce();
  }, DIRTY_CHECK_MS);
  syncOnce();
}

function stopSync() {
  clearInterval(intervalTimer);
  clearInterval(dirtyTimer);
  intervalTimer = null;
  dirtyTimer = null;
}

// ---- ส่วน LINE (ข้อ 8) ยังไม่ทำ ----

function createLineLinkCode() {}

function disconnectLine() {}

function getLineStatus() {}

module.exports = {
  startSync,
  stopSync,
  syncOnce,
  pushLocalChanges,
  pullRemoteChanges,
  createLineLinkCode,
  disconnectLine,
  getLineStatus,
};
