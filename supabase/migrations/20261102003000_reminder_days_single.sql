-- Owner: Backend
-- หน้าที่: เปลี่ยน line_account_links.reminder_days จากลิสต์ตัวเลข เป็นเลขเดียว (spec v0.20 §11.4, §14.4, §19.4)
--   เดิม (v0.16-v0.19) integer[] เช่น {7,3,1} / {} = ปิด    ใหม่ smallint เช่น 7 / NULL = ปิด (default 1)
--   แถวเดิมแปลงเป็นค่ามากสุดของลิสต์ ({7,3,1} -> 7) ลิสต์ว่าง -> NULL
-- วิธีรัน: Supabase Dashboard -> SQL Editor -> New query -> วางทั้งไฟล์ -> Run (รันซ้ำได้ ไม่พัง: รอบสอง คอลัมน์เป็น smallint แล้วจึงไม่ทำอะไร)
--   แล้วค่อย deploy notify-check ใหม่: supabase functions deploy notify-check --no-verify-jwt
--   ต้องรัน 20261101120000_reminder_days.sql ก่อน (ไฟล์นั้นสร้างคอลัมน์นี้)
-- ตาราง line_notification_log ไม่แตะ: v0.20 เลิกเขียนแต่ยังอยู่ใน schema เพื่อไม่ต้อง drop (ไม่มีการเปลี่ยนโครงสร้าง)
-- สิทธิ์ "grant update (reminder_days)" ที่ให้ไว้เดิมยังอยู่หลังเปลี่ยนชนิดคอลัมน์

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'line_account_links'
      and column_name = 'reminder_days' and data_type = 'ARRAY'
  ) then
    -- ทิ้ง check เดิม (reminder_days <@ array[7,3,2,1]) และ default '{1}' / not null ก่อน เพราะใช้กับชนิดใหม่ไม่ได้
    alter table public.line_account_links drop constraint if exists line_account_links_reminder_days_check;
    alter table public.line_account_links alter column reminder_days drop default;
    alter table public.line_account_links alter column reminder_days drop not null;

    -- ลิสต์เดิมมีไม่เกิน 4 ตัว (check เดิมบังคับเป็นสับเซตของ 7,3,2,1) จึงใช้ greatest ของตำแหน่ง 1-4 ได้
    -- greatest ข้าม NULL (ตำแหน่งที่ไม่มี) และถ้าลิสต์ว่างได้ NULL เอง ตัวอย่าง {3,1} -> 3 / {7,3,1} -> 7 / {} -> NULL
    alter table public.line_account_links
      alter column reminder_days type smallint
      using greatest(reminder_days[1], reminder_days[2], reminder_days[3], reminder_days[4]);

    -- default 1 = เตือนก่อน due 1 วัน (พฤติกรรมเดิมของคนที่เพิ่งผูก LINE) NULL = ผู้ใช้ปิดการเตือนล่วงหน้า (แอปเขียนมา)
    alter table public.line_account_links alter column reminder_days set default 1;
    alter table public.line_account_links
      add constraint line_account_links_reminder_days_check check (reminder_days is null or reminder_days in (7, 3, 2, 1));
  end if;
end $$;

-- เช็คหลังรัน (PGlite ในเทสจำลอง RLS/สิทธิ์ได้ไม่เหมือนของจริง 100% ให้เช็คบน Supabase จริงด้วย):
--   select app_user_id, reminder_days from public.line_account_links;                 -- ทุกแถวเป็น 7/3/2/1 หรือ NULL
--   select column_name, data_type, column_default, is_nullable from information_schema.columns
--     where table_name = 'line_account_links' and column_name = 'reminder_days';      -- smallint, default 1, YES
--   select grantee, privilege_type from information_schema.column_privileges
--     where table_name = 'line_account_links' and column_name = 'reminder_days';      -- ต้องมี authenticated / UPDATE
