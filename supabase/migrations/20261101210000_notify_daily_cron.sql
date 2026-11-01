-- Owner: Backend
-- หน้าที่: เปลี่ยนตารางเวลา pg_cron ของ notify-check จากทุก 15 นาทีเป็นวันละครั้ง 08:00 เวลาไทย (v0.19 §14.4)
-- อ้างอิง: PROJECT_v0.19 section 14.4 (สรุปวันละครั้ง), 20 (secrets ห้ามอยู่ใน repo)
-- วิธีรัน: Supabase Dashboard -> SQL Editor -> New query -> วางทั้งไฟล์ -> Run (รันซ้ำได้ ไม่พัง)
--
-- ต้องรัน 20261031180000_notify_cron.sql มาก่อน (สร้าง extension, Vault secret notify_check_url / notify_cron_secret)
-- ไฟล์นี้ไม่มี secret เลย: URL กับรหัสลับอ่านจาก Supabase Vault ตอน cron ทำงานเหมือนเดิม
-- ลำดับ deploy: รันไฟล์นี้ แล้ว deploy notify-check เวอร์ชัน v0.19 (ข้อความสรุป) ถ้าสลับลำดับ ช่วงสั้น ๆ จะได้ข้อความสรุปแบบใหม่ทุก 15 นาที

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- เวลา cron เป็น UTC: '0 1 * * *' = 01:00 UTC = 08:00 เวลาไทย (+7) ทุกวัน (ไทยไม่มีเวลาออมแสง จึงตรงทุกวันตลอดปี)
-- ชื่อ job ซ้ำ = ทับของเดิม ได้ job เดียวที่ชื่อ notify-check ไม่ใช่สอง job
-- timeout 30 วินาที เหมือนเดิม (ค่าเริ่มต้นของ pg_net คือ 5 วินาที สั้นไปถ้ามีหลายคน)
select cron.schedule(
  'notify-check',
  '0 1 * * *',
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
--   select jobname, schedule, active from cron.job;                                  -- notify-check ต้องมีแถวเดียว schedule = '0 1 * * *'
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
--   select status_code, content from net._http_response order by created desc limit 5;  -- 200 = ผ่าน, 401 = secret ไม่ตรง
-- ทดลองส่งเลยโดยไม่รอ 08:00: เรียก net.http_post แบบเดียวกับใน job ด้วยมือ (จะได้ข้อความสรุปจริงไป LINE)
-- กลับไปทุก 15 นาที: รัน 20261031180000_notify_cron.sql ซ้ำ (แต่ข้อความจะเป็นแบบสรุปทุกครั้ง ไม่ใช่เฉพาะที่เปลี่ยน)
-- ยกเลิก: select cron.unschedule('notify-check');
