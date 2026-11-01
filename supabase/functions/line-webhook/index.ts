// Owner: Backend
// หน้าที่: Edge Function รับ webhook จาก LINE: ผูกบัญชีด้วยรหัส, flow สร้าง task แบบ structured (ข้อ 8.3, 8.4) และคำสั่ง "งานค้าง" (ดูรายการ อ่านอย่างเดียว)
// อ้างอิง: PROJECT_v0.17 section 14.2, 14.3, 14.7 (ห้ามใช้ NLP/AI §14.6), 18.2 และ 20 (secrets อยู่ที่ Supabase เท่านั้น)
// deploy ด้วย: supabase functions deploy line-webhook --no-verify-jwt
//   (LINE ไม่ส่ง JWT ของ Supabase มาให้ ความปลอดภัยจึงอยู่ที่การตรวจ x-line-signature ด้วย Channel Secret)
// secrets: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN (supabase secrets set) ส่วน SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY Supabase ใส่ให้เอง
// logic ที่เทสได้อยู่ใน _shared/ ไฟล์นี้ทำแค่: รับ HTTP -> อ่าน/เขียน DB -> ตอบ LINE

import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifySignature } from '../_shared/line-signature.ts';
import {
  DATE_POSTBACK_DATA, LINK_REPLIES, MESSAGES, isTrigger, nextStep, parseLinkCode, textMessage,
} from '../_shared/line-flow.ts';
import type { Input, Message } from '../_shared/line-flow.ts';
import { buildOpenTaskList, isOpenTasksTrigger } from '../_shared/task-list.ts';

const CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') ?? '';
const ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
if (!CHANNEL_SECRET || !ACCESS_TOKEN) console.error('ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN (supabase secrets set)');

// ใช้ service_role (ข้าม RLS) เพราะ function นี้ต้องเขียน tasks แทนผู้ใช้ key นี้อยู่ฝั่ง Supabase เท่านั้น ไม่เข้าแอป
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function replyToLine(replyToken: string, messages: Message[]) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!response.ok) console.error(`LINE reply ไม่สำเร็จ (${response.status}): ${await response.text()}`);
}

// deno-lint-ignore no-explicit-any
async function handleEvent(event: any) {
  // รับเฉพาะแชท 1:1 (§14.6) กลุ่ม/ห้องแชทข้ามไป
  if (event.source?.type !== 'user' || !event.source.userId) return;
  const lineUserId: string = event.source.userId;

  // แปลง event ของ LINE เป็น input ที่ nextStep เข้าใจ: ข้อความ / ค่าจาก Datetime Picker / อย่างอื่น (สติกเกอร์ ฯลฯ) = input ว่าง
  let input: Input;
  if (event.type === 'message') {
    input = event.message?.type === 'text' ? { text: event.message.text } : {};
  } else if (event.type === 'postback' && event.postback?.data === DATE_POSTBACK_DATA) {
    input = { datetime: event.postback.params?.datetime };
  } else {
    return; // follow, unfollow ฯลฯ ไม่ต้องทำอะไร
  }
  const reply = (messages: Message[]) => (event.replyToken ? replyToLine(event.replyToken, messages) : Promise.resolve());

  const { data: link, error: linkError } = await db
    .from('line_account_links').select('app_user_id').eq('line_user_id', lineUserId).maybeSingle();
  if (linkError) throw linkError;

  // ยังไม่ผูกบัญชี: ถ้าส่งรหัส 6 หลักมา = ลองผูก นอกนั้นบอกให้ไปผูกก่อน (§14.2, 14.3)
  if (!link) {
    const code = parseLinkCode(input.text);
    if (!code) return reply([textMessage(MESSAGES.NOT_LINKED)]);
    const { data: result, error } = await db.rpc('line_link_account', { p_code: code, p_line_user_id: lineUserId });
    if (error) throw error;
    return reply([textMessage(LINK_REPLIES[result] ?? MESSAGES.CODE_INVALID)]);
  }

  // "งานค้าง" (§14.7): อ่านอย่างเดียว ตอบรายการแล้วจบ ไม่แตะ line_conversation_state
  //   flow เพิ่มงานที่ค้างอยู่จึงทำต่อได้ (ตัวจับเวลา 10 นาทีเดิมยังเดินต่อ ไม่ถูกต่อเวลา)
  //   limit 500 กัน query ใหญ่เกินจำเป็น (ข้อความแสดงจริงแค่ 15 งาน แต่หัวข้อบอกจำนวนทั้งหมด)
  if (isOpenTasksTrigger(input.text)) {
    const { data: openTasks, error } = await db
      .from('tasks').select('title, course_name, due_date, status').eq('user_id', link.app_user_id)
      .is('deleted_at', null).neq('status', 'completed').order('updated_at', { ascending: false }).limit(500);
    if (error) throw error;
    return reply([buildOpenTaskList(openTasks ?? [])]);
  }

  // ผูกแล้ว: เดินต่อใน flow สร้างงาน
  const { data: saved, error: stateError } = await db
    .from('line_conversation_state').select('current_step, partial_task_data, updated_at').eq('line_user_id', lineUserId).maybeSingle();
  if (stateError) throw stateError;

  // ดึงรายชื่อวิชาเฉพาะตอนเริ่ม flow (ล่าสุดก่อน) จาก task ที่ยังไม่ถูกลบ
  let courses: string[] = [];
  if (isTrigger(input.text)) {
    const { data: rows, error } = await db
      .from('tasks').select('course_name').eq('user_id', link.app_user_id)
      .is('deleted_at', null).not('course_name', 'is', null).order('updated_at', { ascending: false }).limit(100);
    if (error) throw error;
    courses = (rows ?? []).map((row: { course_name: string }) => row.course_name);
  }

  const now = new Date();
  const result = nextStep(saved, input, courses, now);

  // ครบ 3 ช่อง: insert ลง tasks (status/progress/id เป็น default ของ DB, priority/notes ว่าง)
  // ถ้า insert พลาด ไม่แตะ state ผู้ใช้กดเลือกวัน-เวลาซ้ำได้
  if (result.task) {
    const { error } = await db.from('tasks').insert({ user_id: link.app_user_id, ...result.task, source: 'line' });
    if (error) {
      console.error(`insert task ไม่สำเร็จ: ${error.message}`);
      return reply([textMessage(MESSAGES.SAVE_ERROR)]);
    }
  }

  // เขียน DB ให้เสร็จก่อนค่อยตอบ LINE (replyToken ใช้ได้ครั้งเดียว)
  const { error: saveError } = result.state
    ? await db.from('line_conversation_state').upsert({ line_user_id: lineUserId, ...result.state, updated_at: now.toISOString() })
    : await db.from('line_conversation_state').delete().eq('line_user_id', lineUserId);
  if (saveError) throw saveError;

  await reply(result.reply);
}

Deno.serve(async (req) => {
  // ต้องใช้ body ดิบตรวจ signature ก่อน parse (ปุ่ม Verify ของ LINE ส่ง events: [] มา ต้องตอบ 200)
  const rawBody = await req.text();
  if (!(await verifySignature(rawBody, req.headers.get('x-line-signature'), CHANNEL_SECRET))) {
    return new Response('invalid signature', { status: 401 });
  }

  let events: unknown[];
  try {
    events = JSON.parse(rawBody).events ?? [];
  } catch {
    return new Response('bad request', { status: 400 });
  }

  // ทีละ event event เดียวพังไม่ให้ event อื่นพัง และตอบ 200 เสมอ (ไม่งั้น LINE จะส่ง event เดิมซ้ำ)
  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (error) {
      console.error(`handle event ไม่สำเร็จ: ${(error as Error).message}`);
      // deno-lint-ignore no-explicit-any
      const replyToken = (event as any).replyToken;
      if (replyToken) await replyToLine(replyToken, [textMessage(MESSAGES.ERROR)]).catch(() => {});
    }
  }
  return new Response('ok');
});
