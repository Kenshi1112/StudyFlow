-- Owner: Backend
-- หน้าที่: schema SQLite ฝั่ง local (ตาม PROJECT_v0.15 section 19)
-- หมายเหตุ: วัน-เวลาเก็บเป็น TEXT ISO 8601 (ตัดสินใน ROADMAP ข้อ 0.4), boolean เก็บเป็น INTEGER 0/1
--          ทุกตารางใช้ IF NOT EXISTS เพราะ database.js จะรันไฟล์นี้ทุกครั้งที่เปิดแอป
--          ถ้าแก้ไฟล์นี้ระหว่างพัฒนา ตารางที่มีอยู่แล้วไม่เปลี่ยนตาม ให้ลบไฟล์ studyflow.sqlite ใน userData ทิ้ง

CREATE TABLE IF NOT EXISTS tasks (
  id                      TEXT PRIMARY KEY,
  title                   TEXT NOT NULL,
  notes                   TEXT,
  status                  TEXT NOT NULL DEFAULT 'not_started'
                            CHECK (status IN ('not_started', 'in_progress', 'completed')),
  due_date                TEXT,
  progress_percentage     INTEGER NOT NULL DEFAULT 0
                            CHECK (progress_percentage BETWEEN 0 AND 100),
  priority                TEXT
                            CHECK (priority IN ('low', 'medium', 'high')),  -- NULL = ไม่ได้ตั้ง (CHECK ปล่อย NULL ผ่าน)
  source                  TEXT NOT NULL
                            CHECK (source IN ('manual', 'google_classroom', 'line')),
  classroom_assignment_id TEXT UNIQUE,   -- UNIQUE ใน SQLite ยอมให้ NULL ซ้ำได้ = "unique when present"
  course_name             TEXT,
  classroom_last_updated  TEXT,
  completed_at            TEXT,
  deleted_at              TEXT,          -- soft delete (§18.2)
  first_started_at        TEXT,          -- (v0.14) กด Start Working ครั้งแรก ตั้งครั้งเดียว ห้ามเขียนทับ ใช้คำนวณ Time-to-Start Lag (§10.3)
  last_focus_started_at   TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL  -- ใช้กับ LWW เท่านั้น ห้ามใช้เป็นสัญญาณ neglect
);

CREATE TABLE IF NOT EXISTS classroom_sync_state (
  classroom_assignment_id TEXT PRIMARY KEY,
  course_name             TEXT NOT NULL,
  last_seen_updated       TEXT NOT NULL,
  state                   TEXT NOT NULL
                            CHECK (state IN ('pending', 'imported', 'ignored', 'excluded')),
  linked_task_id          TEXT REFERENCES tasks(id), -- ไม่ล้างตอน task ถูก soft delete
  -- (v0.15) เก็บข้อมูลที่ popup review ต้องแสดง ไม่ต้องยิง Google ซ้ำ และ import ลง tasks ได้ตรง ๆ
  -- classroom_assignment_id เป็นรูป 'courseId:courseWorkId' เช่น '1111:9001' (courseWork id ไม่ซ้ำเฉพาะในวิชาเดียวกัน)
  title                   TEXT NOT NULL,
  due_date                TEXT,  -- ISO 8601 เหมือน tasks.due_date
  notes                   TEXT   -- คำอธิบายงาน + ลิงก์ไปงานใน Classroom
);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id                       TEXT PRIMARY KEY,
  task_id                  TEXT NOT NULL REFERENCES tasks(id),
  started_at               TEXT NOT NULL,
  planned_duration_seconds INTEGER NOT NULL,
  actual_duration_seconds  INTEGER NOT NULL,
  completed                INTEGER NOT NULL CHECK (completed IN (0, 1)),  -- 0 = partial session (§15.1)
  batch_id                 TEXT,
  session_index            INTEGER,  -- ลำดับในชุด เริ่มที่ 1
  session_total            INTEGER,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);

-- local only ไม่ sync: 1 แถวต่อ task จด state ล่าสุดที่แจ้งเตือนไป (§11.3)
CREATE TABLE IF NOT EXISTS notification_log (
  task_id             TEXT PRIMARY KEY REFERENCES tasks(id),
  last_notified_state TEXT NOT NULL
                        CHECK (last_notified_state IN
                          ('no_deadline', 'upcoming', 'upcoming_within_window', 'due_today', 'overdue', 'completed')),
  notified_at         TEXT NOT NULL
);

-- local only ไม่ sync: key-value (เช่น has_seen_first_run_prompt, cutoff date, reminder window)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- (ข้อ 7) Cloud Sync: จดแถวที่แก้ในเครื่องแล้วยังไม่ได้ส่งขึ้น Supabase
-- เป็นของใหม่ทั้งหมด (IF NOT EXISTS) ไม่แตะตารางเดิม จึงไม่ต้องลบ studyflow.sqlite
-- local only ไม่ sync: 1 แถว = 1 แถวของ tasks / pomodoro_sessions ที่รอส่ง เช่น ('tasks', 'a1b2c3...')
CREATE TABLE IF NOT EXISTS sync_dirty (
  table_name TEXT NOT NULL,   -- 'tasks' หรือ 'pomodoro_sessions'
  row_id     TEXT NOT NULL,
  PRIMARY KEY (table_name, row_id)
);

-- ใครเขียนตารางพวกนี้ก็ตาม (task.service, pomodoro.service, classroom-sync หรือ SQL ตรง) trigger จะใส่ id ลง sync_dirty ให้เอง
-- แก้แถวเดิมหลายรอบก็มีแถวเดียวใน sync_dirty (ใช้ WHERE NOT EXISTS แทน OR IGNORE เพราะ SQLite ให้คำสั่งที่ทำให้ trigger ทำงาน
-- เป็นคนกำหนดวิธีจัดการข้อมูลซ้ำ ถ้าคำสั่งนั้นเป็น INSERT ... ON CONFLICT DO UPDATE (เช่นตอน pull) OR IGNORE ในนี้จะไม่ทำงานแล้ว error)
CREATE TRIGGER IF NOT EXISTS tasks_mark_dirty_on_insert AFTER INSERT ON tasks
BEGIN
  INSERT INTO sync_dirty (table_name, row_id)
  SELECT 'tasks', NEW.id
  WHERE NOT EXISTS (SELECT 1 FROM sync_dirty WHERE table_name = 'tasks' AND row_id = NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS tasks_mark_dirty_on_update AFTER UPDATE ON tasks
BEGIN
  INSERT INTO sync_dirty (table_name, row_id)
  SELECT 'tasks', NEW.id
  WHERE NOT EXISTS (SELECT 1 FROM sync_dirty WHERE table_name = 'tasks' AND row_id = NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS pomodoro_sessions_mark_dirty_on_insert AFTER INSERT ON pomodoro_sessions
BEGIN
  INSERT INTO sync_dirty (table_name, row_id)
  SELECT 'pomodoro_sessions', NEW.id
  WHERE NOT EXISTS (SELECT 1 FROM sync_dirty WHERE table_name = 'pomodoro_sessions' AND row_id = NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS pomodoro_sessions_mark_dirty_on_update AFTER UPDATE ON pomodoro_sessions
BEGIN
  INSERT INTO sync_dirty (table_name, row_id)
  SELECT 'pomodoro_sessions', NEW.id
  WHERE NOT EXISTS (SELECT 1 FROM sync_dirty WHERE table_name = 'pomodoro_sessions' AND row_id = NEW.id);
END;
