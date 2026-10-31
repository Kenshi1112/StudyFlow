-- Owner: Backend
-- หน้าที่: ตาราง tasks + pomodoro_sessions ฝั่ง Supabase พร้อม trigger updated_at และ RLS (ข้อ 7.1, 7.2)
-- อ้างอิง: PROJECT_v0.15 section 18.2 (LWW ใช้เวลาที่ server ประทับ), 19 (field), 20 (RLS)
-- วิธีรัน: Supabase Dashboard -> SQL Editor -> New query -> วางทั้งไฟล์ -> Run (รันซ้ำได้ ไม่พัง)
--
-- ต่างจาก schema.sql ในเครื่อง 3 จุด:
--   1) มี user_id ทุกตาราง (RLS ใช้แยกข้อมูลของแต่ละคน) ฝั่งเครื่องไม่มีเพราะเป็นบัญชีเดียว
--   2) วัน-เวลาเป็น timestamptz (ในเครื่องเป็น TEXT ISO 8601) completed เป็น boolean (ในเครื่องเป็น 0/1)
--   3) updated_at ถูก trigger ตั้งเองทุกครั้ง ไม่เชื่อค่าที่เครื่องส่งมา

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id                      text primary key default gen_random_uuid()::text,  -- เครื่องส่ง id (UUID) มาเอง ส่วนงานที่ LINE สร้างให้ใช้ default
  user_id                 uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title                   text not null,
  notes                   text,
  status                  text not null default 'not_started'
                            check (status in ('not_started', 'in_progress', 'completed')),
  due_date                timestamptz,
  progress_percentage     integer not null default 0
                            check (progress_percentage between 0 and 100),
  priority                text
                            check (priority in ('low', 'medium', 'high')),
  source                  text not null
                            check (source in ('manual', 'google_classroom', 'line')),
  classroom_assignment_id text,
  course_name             text,
  classroom_last_updated  timestamptz,
  completed_at            timestamptz,
  deleted_at              timestamptz,  -- soft delete (§18.2)
  first_started_at        timestamptz,  -- (v0.14) กด Start Working ครั้งแรก
  last_focus_started_at   timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()  -- ใช้กับ LWW เท่านั้น trigger ตั้งให้
);

-- "unique when present" (§19): ซ้ำไม่ได้เฉพาะในบัญชีเดียวกัน และ NULL ซ้ำได้
create unique index if not exists tasks_user_classroom_assignment_key
  on public.tasks (user_id, classroom_assignment_id)
  where classroom_assignment_id is not null;

-- ใช้กับ query ตอน pull: where updated_at >= cursor order by updated_at
create index if not exists tasks_user_updated_at_idx on public.tasks (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- pomodoro_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.pomodoro_sessions (
  id                       text primary key default gen_random_uuid()::text,
  user_id                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id                  text not null references public.tasks (id),
  started_at               timestamptz not null,
  planned_duration_seconds integer not null,
  actual_duration_seconds  integer not null,
  completed                boolean not null,  -- false = partial session (§15.1)
  batch_id                 text,
  session_index            integer,
  session_total            integer,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists pomodoro_sessions_user_updated_at_idx on public.pomodoro_sessions (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- 7.2 trigger: ตั้ง updated_at ฝั่ง server ทุกครั้งที่ insert/update (ข้อมูลจากเครื่องไหนก็ได้ค่าจากนาฬิกา server)
-- ทับค่า updated_at ที่เครื่องส่งมาทิ้ง จึงไม่โดนนาฬิกาเครื่องที่ตั้งผิดมากวน (LWW ตาม §18.2)
-- clock_timestamp() = เวลาจริงตอนเขียน (now() คือเวลาที่ transaction เริ่ม)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before insert or update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists pomodoro_sessions_set_updated_at on public.pomodoro_sessions;
create trigger pomodoro_sessions_set_updated_at
  before insert or update on public.pomodoro_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (§20): แต่ละคนเห็นและแก้ได้เฉพาะแถวที่ user_id เป็นของตัวเอง
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.pomodoro_sessions enable row level security;

drop policy if exists "tasks: own rows" on public.tasks;
create policy "tasks: own rows" on public.tasks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "pomodoro_sessions: own rows" on public.pomodoro_sessions;
create policy "pomodoro_sessions: own rows" on public.pomodoro_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- สิทธิ์เข้าถึงผ่าน Data API (supabase-js)
-- Supabase เปลี่ยนเป็นไม่ให้สิทธิ์ตารางใหม่อัตโนมัติ (30 ต.ค. 2026) จึงต้อง grant เอง
--   authenticated = ผู้ใช้ที่ login แล้ว: อ่าน/เพิ่ม/แก้ (ไม่ให้ delete เพราะลบแบบ soft delete)
--   service_role  = Edge Function ของ LINE (ข้อ 8) ที่เขียน tasks ตรง ๆ โดยข้าม RLS
--   anon ไม่ให้เลย: ไม่ login = เข้าไม่ได้
-- ---------------------------------------------------------------------------
grant select, insert, update on public.tasks to authenticated;
grant select, insert, update on public.pomodoro_sessions to authenticated;
grant select, insert, update, delete on public.tasks to service_role;
grant select, insert, update, delete on public.pomodoro_sessions to service_role;
