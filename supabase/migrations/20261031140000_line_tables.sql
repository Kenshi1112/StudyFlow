-- Owner: Backend
-- หน้าที่: 4 ตารางของ LINE (§19.4) + RLS + สิทธิ์ + ฟังก์ชันผูกบัญชี line_link_account (ข้อ 8.2, 8.3)
-- อ้างอิง: PROJECT_v0.15 section 14.2-14.4, 19.4, 20
-- วิธีรัน: Supabase Dashboard -> SQL Editor -> New query -> วางทั้งไฟล์ -> Run (รันซ้ำได้ ไม่พัง)
--   ต้องรัน 20261031130000_init_tasks_sessions.sql ก่อน (ตารางนี้อ้าง tasks และใช้ trigger/สิทธิ์ชุดเดียวกัน)
--
-- ใครแตะตารางไหน (ข้อตัดสินใจ D1: spec §14.2 กับ §19.4 ขัดกันเอง เลือกให้ตรงกับ §14.2)
--   line_link_codes         แอปเพิ่ม/อ่าน/ลบรหัสของตัวเอง (RLS) Edge Function ใช้ผ่านฟังก์ชัน line_link_account
--   line_account_links      แอปอ่าน/ลบ (ปุ่ม Disconnect) ของตัวเอง ส่วนการเพิ่มทำโดย line_link_account เท่านั้น
--   line_conversation_state, line_notification_log   แอปเข้าไม่ได้เลย (service_role อย่างเดียว)

-- ---------------------------------------------------------------------------
-- line_link_codes: รหัสผูกบัญชีอายุ 10 นาที (§14.2)
-- ---------------------------------------------------------------------------
create table if not exists public.line_link_codes (
  code        text primary key check (code ~ '^[0-9]{6}$'),  -- เลข 6 หลักที่แอปสร้าง
  app_user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '10 minutes'  -- ไม่ลบทิ้งเอง รหัสหมดอายุแค่ตรวจไม่ผ่าน
);

-- ---------------------------------------------------------------------------
-- line_account_links: 1 บัญชีแอป ต่อ 1 LINE (D3: ผูกใหม่ทับของเดิม / LINE เดียวกันผูกสองบัญชีไม่ได้)
-- ---------------------------------------------------------------------------
create table if not exists public.line_account_links (
  app_user_id  uuid primary key references auth.users (id) on delete cascade,
  line_user_id text not null unique,
  linked_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- line_conversation_state: ขั้นของ flow สร้างงาน (§14.3) updated_at ใช้ตัดสินว่าค้างเกิน 10 นาทีไหม
-- ---------------------------------------------------------------------------
create table if not exists public.line_conversation_state (
  line_user_id      text primary key,
  current_step      text not null
                      check (current_step in ('waiting_course', 'waiting_title', 'waiting_date')),
  partial_task_data jsonb not null default '{}'::jsonb,  -- เช่น {"course_name":"OS","title":"Lab 3"}
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- line_notification_log: กันแจ้ง LINE ซ้ำ (§14.4) 6 ค่าเหมือน notification_log ในเครื่อง (§11.3)
-- ---------------------------------------------------------------------------
create table if not exists public.line_notification_log (
  task_id             text not null references public.tasks (id) on delete cascade,
  line_user_id        text not null,
  last_notified_state text not null
                        check (last_notified_state in
                          ('no_deadline', 'upcoming', 'upcoming_within_window', 'due_today', 'overdue', 'completed')),
  notified_at         timestamptz not null default now(),
  primary key (task_id, line_user_id)
);

-- ---------------------------------------------------------------------------
-- RLS (§20) เปิดทั้ง 4 ตาราง สองตารางหลังไม่มี policy = authenticated เห็นไม่ได้เลย (service_role ข้าม RLS)
-- ---------------------------------------------------------------------------
alter table public.line_link_codes enable row level security;
alter table public.line_account_links enable row level security;
alter table public.line_conversation_state enable row level security;
alter table public.line_notification_log enable row level security;

drop policy if exists "line_link_codes: own rows" on public.line_link_codes;
create policy "line_link_codes: own rows" on public.line_link_codes
  for all to authenticated
  using (app_user_id = (select auth.uid()))
  with check (app_user_id = (select auth.uid()));

drop policy if exists "line_account_links: own rows" on public.line_account_links;
create policy "line_account_links: own rows" on public.line_account_links
  for all to authenticated
  using (app_user_id = (select auth.uid()))
  with check (app_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- สิทธิ์ (Supabase ไม่ให้สิทธิ์ตารางใหม่อัตโนมัติ ต้อง grant เอง) anon ไม่ให้เลย
-- ---------------------------------------------------------------------------
-- แอป: เพิ่มรหัสได้เฉพาะ 2 คอลัมน์ (expires_at ใช้ค่า default 10 นาที ใส่เองไม่ได้ กันตั้งรหัสให้ไม่หมดอายุ)
grant select, delete on public.line_link_codes to authenticated;
grant insert (code, app_user_id) on public.line_link_codes to authenticated;
-- แอป: อ่านสถานะ + Disconnect เท่านั้น ไม่มี insert/update
grant select, delete on public.line_account_links to authenticated;

grant select, insert, update, delete on public.line_link_codes to service_role;
grant select, insert, update, delete on public.line_account_links to service_role;
grant select, insert, update, delete on public.line_conversation_state to service_role;
grant select, insert, update, delete on public.line_notification_log to service_role;

-- ---------------------------------------------------------------------------
-- line_link_account: ตรวจรหัส + ผูกบัญชี + ใช้รหัสแล้วลบ ใน transaction เดียว (Edge Function เรียกตอนผู้ใช้ส่งรหัสมา)
-- คืน 'linked' | 'invalid' (ไม่มีรหัส/หมดอายุ) | 'taken' (LINE นี้ผูกกับบัญชีอื่นอยู่ รหัสยังไม่ถูกใช้)
-- ตัวอย่าง: user A ขอรหัส 123456 ตอน 10:00 ส่งมาตอน 10:05 -> linked / ส่งมาตอน 10:11 -> invalid
-- ---------------------------------------------------------------------------
create or replace function public.line_link_account(p_code text, p_line_user_id text)
returns text
language plpgsql
as $$
declare
  v_user uuid;
begin
  -- for update = ล็อกแถวรหัส กันสองข้อความใช้รหัสเดียวกันพร้อมกัน
  select app_user_id into v_user
    from public.line_link_codes
   where code = p_code and expires_at > now()
   for update;
  if v_user is null then
    return 'invalid';
  end if;

  if exists (select 1 from public.line_account_links
              where line_user_id = p_line_user_id and app_user_id <> v_user) then
    return 'taken';
  end if;

  -- ผูกใหม่ทับของเดิมของบัญชีแอปนี้ได้ (D3)
  insert into public.line_account_links (app_user_id, line_user_id)
  values (v_user, p_line_user_id)
  on conflict (app_user_id) do update
    set line_user_id = excluded.line_user_id, linked_at = now();

  -- ใช้แล้วลบ รหัสอื่นของ user นี้ที่ค้างอยู่ก็ลบด้วย (D2)
  delete from public.line_link_codes where app_user_id = v_user;
  return 'linked';
end;
$$;

-- ฟังก์ชันใน schema public ใครก็เรียกได้เป็นค่าเริ่มต้น ต้องปิดเอง ให้เฉพาะ Edge Function (service_role)
revoke execute on function public.line_link_account(text, text) from public, anon, authenticated;
grant execute on function public.line_link_account(text, text) to service_role;
