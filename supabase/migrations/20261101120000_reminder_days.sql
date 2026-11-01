-- Owner: Backend
-- หน้าที่: รองรับ Upcoming reminder เลือกวันได้ 7/3/2/1 (spec v0.16 §11.4, §14.4, §19.4)
--   line_account_links.reminder_days   วันที่ผู้ใช้ติ๊ก แอปเขียนมาทางเดียว (list ว่าง = ปิดการเตือนล่วงหน้า) notify-check อ่านต่อ user
--   line_notification_log.reminders_sent  reminder ที่จัดการแล้ว เช่น '7,3' (ความหมายเหมือน notification_log ในเครื่อง)
-- วิธีรัน: Supabase Dashboard -> SQL Editor -> New query -> วางทั้งไฟล์ -> Run (รันซ้ำได้ ไม่พัง) แล้วค่อย deploy notify-check ใหม่
--   ต้องรัน 20261031140000_line_tables.sql ก่อน (ไฟล์นั้นสร้างสองตารางนี้)
-- ไม่แก้ไฟล์ migration เดิมที่ apply แล้ว: เพิ่มคอลัมน์ด้วยไฟล์ใหม่นี้แทน

-- ผู้ใช้ที่ผูก LINE อยู่แล้วได้ {1} เท่ากับพฤติกรรมเดิม (เตือนก่อน 1 วัน) จนกว่าแอปจะเขียนค่าจริงมาทับ
-- check: ต้องเป็นสับเซตของ 7,3,2,1 ('{}' ผ่าน เพราะหมายถึงปิด) ตัวอย่าง '{7,1}' ผ่าน / '{5}' ไม่ผ่าน
alter table public.line_account_links
  add column if not exists reminder_days integer[] not null default '{1}'
    check (reminder_days <@ array[7, 3, 2, 1]);

alter table public.line_notification_log
  add column if not exists reminders_sent text not null default '';

-- แอปเขียนได้เฉพาะคอลัมน์นี้ (ไม่ให้แก้ line_user_id ฯลฯ) ส่วน RLS "line_account_links: own rows" (for all) เดิมจำกัดให้แก้ได้เฉพาะแถวของตัวเองอยู่แล้ว
grant update (reminder_days) on public.line_account_links to authenticated;

-- เช็คหลังรัน (PGlite ในเทสจำลอง RLS/สิทธิ์ได้ไม่เหมือนของจริง 100% ให้เช็คบน Supabase จริงด้วย):
--   select app_user_id, reminder_days from public.line_account_links;                 -- ทุกแถวต้องเป็น {1} (หรือค่าที่แอปเขียนแล้ว)
--   select column_name, data_type, column_default from information_schema.columns
--     where table_name = 'line_notification_log' and column_name = 'reminders_sent';  -- text, default ''
--   select grantee, privilege_type from information_schema.column_privileges
--     where table_name = 'line_account_links' and column_name = 'reminder_days';      -- ต้องมี authenticated / UPDATE
--   select policyname, cmd from pg_policies where tablename = 'line_account_links';  -- ต้องมี "line_account_links: own rows" (ALL)
