-- Owner: Backend
-- หน้าที่: เพิ่มค่า 'waiting_notes' (ขั้น description ของ flow เพิ่มงาน) ให้ line_conversation_state.current_step (ข้อ 8, spec v0.18)
-- อ้างอิง: PROJECT_v0.19 section 14.3, 19.4
-- วิธีรัน: Supabase Dashboard -> SQL Editor -> New query -> วางทั้งไฟล์ -> Run (รันซ้ำได้ ไม่พัง) ต้องรันก่อน deploy line-webhook ตัวใหม่
-- ไม่แตะข้อมูลเดิม: แถว state ที่ค้างอยู่ (waiting_course/title/date) ยังผ่าน CHECK ตัวใหม่

alter table public.line_conversation_state
  drop constraint if exists line_conversation_state_current_step_check;

alter table public.line_conversation_state
  add constraint line_conversation_state_current_step_check
  check (current_step in ('waiting_course', 'waiting_title', 'waiting_notes', 'waiting_date'));
