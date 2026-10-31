// Owner: Backend
// หน้าที่: Edge Function ที่ pg_cron เรียกทุก 15 นาที เพื่อ push แจ้งเตือน deadline ไป LINE (ข้อ 8.6)
// อ้างอิง: PROJECT_v0.15 §14.4 (กฎเดียวกับ §9.2/§11.1), §11.3 (กันซ้ำ), §19.4 (line_notification_log), §20 (secrets)
// deploy ด้วย: supabase functions deploy notify-check --no-verify-jwt
//   (pg_cron ไม่มี JWT ของ Supabase ความปลอดภัยอยู่ที่ header x-cron-secret เทียบกับ secret CRON_SECRET)
// secrets: CRON_SECRET, LINE_CHANNEL_ACCESS_TOKEN (supabase secrets set) ส่วน SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY Supabase ใส่ให้เอง
// logic ที่เทสได้อยู่ใน _shared/ ไฟล์นี้ทำแค่: ตรวจ secret -> อ่าน/เขียน DB -> push LINE

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildDigest, pickPending } from '../_shared/notify-digest.ts';
import type { TaskRow } from '../_shared/notify-digest.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
if (!CRON_SECRET || !ACCESS_TOKEN) console.error('ยังไม่ได้ตั้ง CRON_SECRET / LINE_CHANNEL_ACCESS_TOKEN (supabase secrets set)');

// D6: cloud ไม่รู้ค่า reminder_window_days ของแอป (settings ไม่ sync §18.2) จึงใช้ค่า default ของ spec §11.1 ตายตัว
// ผลที่ตามมา: ถ้าผู้ใช้ปรับในแอปเป็น 3 วัน desktop เตือนก่อน 3 วัน แต่ LINE ยังเตือนก่อน 1 วัน
const REMINDER_WINDOW_DAYS = 1;

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

// แจ้ง 1 คน คืนจำนวนงานที่แจ้งรอบนี้
// push สำเร็จแล้วค่อยจด log: push พลาด = ไม่จด รอบหน้าลองใหม่ (ถ้า push ผ่านแต่จด log พลาด รอบหน้าอาจแจ้งซ้ำ 1 ครั้ง ยอมรับได้)
async function notifyUser(link: { app_user_id: string; line_user_id: string }, now: Date): Promise<number> {
  // ดึงทีละคน (PostgREST คืนสูงสุดประมาณ 1000 แถวต่อ request ดึงรวมทุกคนอาจถูกตัดเงียบ ๆ)
  const { data: tasks, error } = await db
    .from('tasks').select('id, title, status, due_date')
    .eq('user_id', link.app_user_id).is('deleted_at', null).not('due_date', 'is', null);
  if (error) throw error;

  const { data: logs, error: logError } = await db
    .from('line_notification_log').select('task_id, last_notified_state').eq('line_user_id', link.line_user_id);
  if (logError) throw logError;

  const lastNotified = new Map<string, string>((logs ?? []).map((row) => [row.task_id, row.last_notified_state]));
  const pending = pickPending((tasks ?? []) as TaskRow[], lastNotified, REMINDER_WINDOW_DAYS, now);
  if (pending.length === 0) return 0;

  const { text, shown } = buildDigest(pending);
  await pushToLine(link.line_user_id, text);

  const rows = shown.map((p) => ({
    task_id: p.task_id, line_user_id: link.line_user_id, last_notified_state: p.state, notified_at: now.toISOString(),
  }));
  const { error: saveError } = await db.from('line_notification_log').upsert(rows, { onConflict: 'task_id,line_user_id' });
  if (saveError) throw saveError;
  return shown.length;
}

Deno.serve(async (req) => {
  // ไม่ได้ตั้ง CRON_SECRET = ปิดทั้งหมด (ห้ามให้ header ว่างผ่าน)
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const { data: links, error } = await db.from('line_account_links').select('app_user_id, line_user_id');
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
