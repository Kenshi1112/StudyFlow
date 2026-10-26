// Owner: Backend
// หน้าที่: เทสข้อ 1.2 — เช็คว่า src/main/db/schema.sql ตรง PROJECT_v0.14 section 19
// รัน: node --test tests/schema.test.js   (ต้อง Node 22+ และ npm install แล้ว)
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'main', 'db', 'schema.sql');

// field ตาม §19 เป๊ะ ๆ — ห้ามขาด ห้ามเกิน
const EXPECTED_COLUMNS = {
  tasks: [
    'id', 'title', 'notes', 'status', 'due_date', 'progress_percentage', 'priority',
    'source', 'classroom_assignment_id', 'course_name', 'classroom_last_updated',
    'completed_at', 'deleted_at', 'first_started_at', 'last_focus_started_at', 'created_at', 'updated_at',
  ],
  classroom_sync_state: [
    'classroom_assignment_id', 'course_name', 'last_seen_updated', 'state', 'linked_task_id',
  ],
  pomodoro_sessions: [
    'id', 'task_id', 'started_at', 'planned_duration_seconds', 'actual_duration_seconds',
    'completed', 'batch_id', 'session_index', 'session_total', 'created_at', 'updated_at',
  ],
  notification_log: ['task_id', 'last_notified_state', 'notified_at'],
};

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}

function columns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all();
}

function insertTask(db, overrides = {}) {
  const t = {
    id: 'task-1',
    title: 'ส่งรายงาน',
    status: 'not_started',
    source: 'manual',
    created_at: '2026-10-06T00:00:00.000Z',
    updated_at: '2026-10-06T00:00:00.000Z',
    ...overrides,
  };
  const keys = Object.keys(t);
  db.prepare(
    `INSERT INTO tasks (${keys.join(',')}) VALUES (${keys.map((k) => '@' + k).join(',')})`
  ).run(t);
  return t;
}

test('schema.sql รันได้ และสร้างครบ 5 ตาราง', () => {
  const db = freshDb();
  const names = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);
  for (const t of ['tasks', 'classroom_sync_state', 'pomodoro_sessions', 'notification_log', 'settings']) {
    assert.ok(names.includes(t), `ไม่เจอตาราง ${t}`);
  }
});

for (const [table, expected] of Object.entries(EXPECTED_COLUMNS)) {
  test(`${table}: คอลัมน์ตรง §19 ไม่ขาดไม่เกิน`, () => {
    const actual = columns(freshDb(), table).map((c) => c.name).sort();
    assert.deepEqual(actual, [...expected].sort());
  });
}

test('tasks: ไม่มี classroom_course_name (v0.13 เปลี่ยนเป็น course_name)', () => {
  const names = columns(freshDb(), 'tasks').map((c) => c.name);
  assert.ok(!names.includes('classroom_course_name'));
  assert.ok(names.includes('course_name'));
});

test('tasks: id เป็น primary key', () => {
  const pk = columns(freshDb(), 'tasks').filter((c) => c.pk > 0).map((c) => c.name);
  assert.deepEqual(pk, ['id']);
});

test('tasks: field ที่ spec ว่า nullable ต้องเว้นว่างได้', () => {
  const db = freshDb();
  insertTask(db); // ใส่แค่ field บังคับ ที่เหลือเป็น NULL
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get('task-1');
  for (const f of [
    'due_date', 'priority', 'classroom_assignment_id', 'course_name',
    'classroom_last_updated', 'completed_at', 'deleted_at', 'first_started_at', 'last_focus_started_at',
  ]) {
    assert.equal(row[f], null, `${f} ควรเป็น NULL ได้`);
  }
});

test('tasks: title กับ status กับ source ห้ามเป็น NULL', () => {
  const db = freshDb();
  assert.throws(() => insertTask(db, { title: null }));
  assert.throws(() => insertTask(db, { status: null }));
  assert.throws(() => insertTask(db, { source: null }));
});

test('tasks: status / source / priority รับเฉพาะค่าตาม spec', () => {
  const db = freshDb();
  assert.throws(() => insertTask(db, { id: 'a', status: 'done' }));
  assert.throws(() => insertTask(db, { id: 'b', source: 'email' }));
  assert.throws(() => insertTask(db, { id: 'c', priority: 'urgent' }));
  // ค่าถูกต้องต้องผ่าน (ครบทุกค่า)
  let n = 0;
  for (const status of ['not_started', 'in_progress', 'completed']) insertTask(db, { id: `s${n++}`, status });
  for (const source of ['manual', 'google_classroom', 'line']) insertTask(db, { id: `o${n++}`, source });
  for (const priority of ['low', 'medium', 'high', null]) insertTask(db, { id: `p${n++}`, priority });
});

test('tasks: progress_percentage ต้องอยู่ 0-100', () => {
  const db = freshDb();
  assert.throws(() => insertTask(db, { id: 'x1', progress_percentage: -1 }));
  assert.throws(() => insertTask(db, { id: 'x2', progress_percentage: 101 }));
  insertTask(db, { id: 'x3', progress_percentage: 0 });
  insertTask(db, { id: 'x4', progress_percentage: 100 });
});

test('tasks: classroom_assignment_id ซ้ำไม่ได้ แต่ NULL หลายแถวได้', () => {
  const db = freshDb();
  insertTask(db, { id: 't1', classroom_assignment_id: 'A1' });
  assert.throws(() => insertTask(db, { id: 't2', classroom_assignment_id: 'A1' }));
  insertTask(db, { id: 't3' }); // NULL
  insertTask(db, { id: 't4' }); // NULL อีกแถว ต้องไม่ชน
});

test('classroom_sync_state: PK คือ classroom_assignment_id และ state รับ 4 ค่า', () => {
  const db = freshDb();
  const pk = columns(db, 'classroom_sync_state').filter((c) => c.pk > 0).map((c) => c.name);
  assert.deepEqual(pk, ['classroom_assignment_id']);

  const ins = db.prepare(
    'INSERT INTO classroom_sync_state (classroom_assignment_id, course_name, last_seen_updated, state) VALUES (?,?,?,?)'
  );
  let n = 0;
  for (const state of ['pending', 'imported', 'ignored', 'excluded']) ins.run(`C${n++}`, 'Math', '2026-10-01T00:00:00Z', state);
  assert.throws(() => ins.run('C9', 'Math', '2026-10-01T00:00:00Z', 'deleted'));
  assert.throws(() => ins.run('C0', 'Math', '2026-10-01T00:00:00Z', 'pending')); // PK ซ้ำ
});

test('classroom_sync_state: linked_task_id เป็น FK ไป tasks.id (nullable)', () => {
  const db = freshDb();
  const ins = db.prepare(
    'INSERT INTO classroom_sync_state (classroom_assignment_id, course_name, last_seen_updated, state, linked_task_id) VALUES (?,?,?,?,?)'
  );
  ins.run('C1', 'Math', '2026-10-01T00:00:00Z', 'pending', null); // NULL ได้
  assert.throws(() => ins.run('C2', 'Math', '2026-10-01T00:00:00Z', 'imported', 'ไม่มีtaskนี้'));
  insertTask(db, { id: 'real' });
  ins.run('C3', 'Math', '2026-10-01T00:00:00Z', 'imported', 'real');
});

test('pomodoro_sessions: task_id ห้าม NULL และต้องชี้ task ที่มีจริง', () => {
  const db = freshDb();
  const ins = db.prepare(
    `INSERT INTO pomodoro_sessions
     (id, task_id, started_at, planned_duration_seconds, actual_duration_seconds, completed, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  const args = ['2026-10-06T08:00:00Z', 1500, 1500, 1, '2026-10-06T08:25:00Z', '2026-10-06T08:25:00Z'];
  assert.throws(() => ins.run('p1', null, ...args), 'task_id ต้อง NOT NULL');
  assert.throws(() => ins.run('p2', 'ไม่มีtaskนี้', ...args), 'ต้องมี FK ไป tasks');
  insertTask(db, { id: 'real' });
  ins.run('p3', 'real', ...args);
});

test('pomodoro_sessions: batch_id / session_index / session_total เว้นว่างได้', () => {
  const db = freshDb();
  insertTask(db, { id: 'real' });
  db.prepare(
    `INSERT INTO pomodoro_sessions
     (id, task_id, started_at, planned_duration_seconds, actual_duration_seconds, completed, created_at, updated_at)
     VALUES ('p1','real','2026-10-06T08:00:00Z',1500,600,0,'2026-10-06T08:10:00Z','2026-10-06T08:10:00Z')`
  ).run();
  const row = db.prepare("SELECT * FROM pomodoro_sessions WHERE id='p1'").get();
  assert.equal(row.batch_id, null);
  assert.equal(row.session_index, null);
  assert.equal(row.session_total, null);
  assert.equal(row.completed, 0);
});

test('settings: เป็น key-value (key ซ้ำไม่ได้ ใช้ upsert ได้)', () => {
  const db = freshDb();
  const cols = columns(db, 'settings');
  assert.ok(cols.length >= 2, 'ต้องมีอย่างน้อย key กับ value');
  const pk = cols.filter((c) => c.pk > 0);
  assert.equal(pk.length, 1, 'ต้องมี primary key 1 คอลัมน์ (ตัว key)');
  const [k, v] = [pk[0].name, cols.find((c) => c.pk === 0).name];
  db.prepare(`INSERT INTO settings (${k}, ${v}) VALUES ('has_seen_first_run_prompt','false')`).run();
  assert.throws(() => db.prepare(`INSERT INTO settings (${k}, ${v}) VALUES ('has_seen_first_run_prompt','true')`).run());
  db.prepare(
    `INSERT INTO settings (${k}, ${v}) VALUES ('has_seen_first_run_prompt','true')
     ON CONFLICT(${k}) DO UPDATE SET ${v} = excluded.${v}`
  ).run();
  assert.equal(db.prepare(`SELECT ${v} AS v FROM settings WHERE ${k}='has_seen_first_run_prompt'`).get().v, 'true');
});

test('รัน schema.sql ซ้ำได้ไม่ error (IF NOT EXISTS) — เตรียมไว้ให้ข้อ 1.3', () => {
  const db = freshDb();
  assert.doesNotThrow(() => db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8')));
});
