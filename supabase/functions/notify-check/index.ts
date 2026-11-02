// Owner: Backend
// หน้าที่: Edge Function ที่ pg_cron เรียกวันละครั้ง 08:00 เวลาไทย เพื่อ push ข้อความสรุปงาน (เลยกำหนด / ถึงกำหนดวันนี้ / Upcoming reminder) ไป LINE คนละ 1 ข้อความ
// อ้างอิง: PROJECT_v0.20 §14.4 (สรุปวันละครั้ง ทุกกลุ่มขึ้นทุกวัน ไม่จดอะไรว่าแจ้งแล้ว), §11.4 (Upcoming เป็นช่วง), §19.4 (line_account_links.reminder_days เป็นเลขเดียว / NULL = ปิด), §20 (secrets)
// ต้องรัน migration 20261102003000_reminder_days_single.sql ก่อน deploy ไฟล์นี้ (reminder_days เปลี่ยนจากลิสต์เป็นเลขเดียว)
// ตารางเวลาเปลี่ยนจากทุก 15 นาทีเป็นวันละครั้งด้วย migration 20261101210000_notify_daily_cron.sql
// deploy ด้วย: supabase functions deploy notify-check --no-verify-jwt
//   (pg_cron ไม่มี JWT ของ Supabase ความปลอดภัยอยู่ที่ header x-cron-secret เทียบกับ secret CRON_SECRET)
// secrets: CRON_SECRET, LINE_CHANNEL_ACCESS_TOKEN (supabase secrets set) ส่วน SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY Supabase ใส่ให้เอง
// logic ที่เทสได้อยู่ใน _shared/ ไฟล์นี้ทำแค่: ตรวจ secret -> อ่าน/เขียน DB -> push LINE

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildDigest, pickPending } from '../_shared/notify-digest.ts';
import type { TaskRow } from '../_shared/notify-digest.ts';
import { sanitizeDays } from '../_shared/reminders.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
if (!CRON_SECRET || !ACCESS_TOKEN) console.error('ยังไม่ได้ตั้ง CRON_SECRET / LINE_CHANNEL_ACCESS_TOKEN (supabase secrets set)');

// ใช้ service_role (ข้าม RLS) เพราะต้องอ่าน tasks ของทุกคนที่ผูก LINE key นี้อยู่ฝั่ง Supabase เท่านั้น ไม่เข้าแอป
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function pushToLine(to: string, text: string) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
  if (!response.ok) throw new Error(`LINE push ไม่สำเร็จ (${response.status}): ${await response.text()}`);
}

// แจ้ง 1 คน คืนจำนวนงานในข้อความรอบนี้ reminder_days คือค่าที่แอปเขียนมา (§14.4) เลข 7/3/2/1 หรือ null = ผู้ใช้ปิดการเตือนล่วงหน้า
// v0.20: ไม่อ่าน/ไม่เขียน line_notification_log เลย ทุกกลุ่มขึ้นสรุปทุกวัน push พลาด = ไม่มีอะไรเสีย พรุ่งนี้ 08:00 ขึ้นให้ใหม่ (ไม่มี retry ในวัน §20)
async function notifyUser(link: { app_user_id: string; line_user_id: string; reminder_days: number | null }, now: Date): Promise<number> {
  // ดึงทีละคน (PostgREST คืนสูงสุดประมาณ 1000 แถวต่อ request ดึงรวมทุกคนอาจถูกตัดเงียบ ๆ)
  const { data: tasks, error } = await db
    .from('tasks').select('id, title, status, due_date')
    .eq('user_id', link.app_user_id).is('deleted_at', null).not('due_date', 'is', null);
  if (error) throw error;

  const pending = pickPending((tasks ?? []) as TaskRow[], sanitizeDays(link.reminder_days), now);
  if (pending.length === 0) return 0;

  const digest = buildDigest(pending);
  await pushToLine(link.line_user_id, digest.text);
  return digest.shown.length;
}

Deno.serve(async (req) => {
  // ไม่ได้ตั้ง CRON_SECRET = ปิดทั้งหมด (ห้ามให้ header ว่างผ่าน)
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const { data: links, error } = await db.from('line_account_links').select('app_user_id, line_user_id, reminder_days');
  if (error) {
    console.error(`อ่าน line_account_links ไม่สำเร็จ: ${error.message}`);
    return new Response('db error', { status: 500 });
  }

  const now = new Date();
  let notified = 0;
  let failed = 0;
  // ทีละคน คนเดียวพัง (เช่น บล็อกบอท) ไม่ให้คนอื่นพัง
  for (const link of links ?? []) {
    try {
      notified += await notifyUser(link, now);
    } catch (error) {
      failed += 1;
      console.error(`notify-check: user ${link.app_user_id} ไม่สำเร็จ: ${(error as Error).message}`);
    }
  }
  return Response.json({ users: (links ?? []).length, notified, failed });
});
