-- Owner: Backend
-- หน้าที่: ตั้ง pg_cron เรียก Edge Function notify-check ทุก 15 นาที (ข้อ 8.7)
-- อ้างอิง: PROJECT_v0.15 section 14.4 (ทุก 15-30 นาที), 20 (secrets ห้ามอยู่ใน repo)
-- วิธีรัน: Supabase Dashboard -> SQL Editor -> New query -> วางทั้งไฟล์ -> Run (รันซ้ำได้ ไม่พัง)
--
-- ไฟล์นี้ไม่มี secret เลย: URL กับรหัสลับอ่านจาก Supabase Vault ตอน cron ทำงาน
-- ก่อนรันไฟล์นี้ ต้องเพิ่ม 2 ค่าใน Vault (Dashboard -> Integrations -> Vault -> Add new secret):
--   notify_check_url   = https://<project-ref>.supabase.co/functions/v1/notify-check
--   notify_cron_secret = ค่าเดียวกับ CRON_SECRET ที่ตั้งด้วย `supabase secrets set CRON_SECRET=...`
-- ถ้า Extension ถูกเปิดไม่ได้จากไฟล์นี้ ให้เปิด pg_cron กับ pg_net ที่ Dashboard -> Database -> Extensions แล้วรันใหม่

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- เวลา cron เป็น UTC: '*/15 * * * *' = นาที 0, 15, 30, 45 ของทุกชั่วโมง (ไทย +7 ชั่วโมงเต็ม จึงตรงกับ :00 :15 :30 :45 ของเวลาไทยด้วย)
-- ชื่อ job ซ้ำ = ทับของเดิม จึงรันไฟล์นี้ซ้ำได้
-- timeout 30 วินาที (ค่าเริ่มต้นของ pg_net คือ 5 วินาที สั้นไปถ้ามีหลายคน)
select cron.schedule(
  'notify-check',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_check_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- เช็คหลังรัน:
--   select jobname, schedule, active from cron.job;                                  -- ต้องเห็น notify-check
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
--   select status_code, content from net._http_response order by created desc limit 5;  -- ผลที่ function ตอบ (200 = ผ่าน, 401 = secret ไม่ตรง)
-- ยกเลิก: select cron.unschedule('notify-check');
