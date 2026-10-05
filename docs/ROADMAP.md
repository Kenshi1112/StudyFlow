# StudyFlow Roadmap และบันทึกความคืบหน้า

ไฟล์นี้คือแผนทำงานทีละขั้นและบันทึกว่าทำอะไรไปแล้ว ใช้เป็นจุดต่อเวลาเปลี่ยน session
Spec หลักคือ `docs/PROJECT_v0.13.md` ถ้าไฟล์นี้ขัดกับ spec ให้ยึด spec

อัปเดตล่าสุด: 2026-10-05

---

## วิธีเริ่ม session ใหม่ (ทำทีละข้อใหญ่ ข้อละ 1 session)

1. เปิด session ใหม่ในโฟลเดอร์ `Final_Project_FR`
2. พิมพ์ประมาณนี้:
   > อ่าน docs/ROADMAP.md แล้วทำต่อที่ "ข้อ X" ฉันทำ Backend (src/main, supabase) เพื่อนทำ Frontend (src/renderer) ห้ามเพิ่มอะไรนอก PROJECT_v0.13.md
3. จบ session ให้ทำตามนี้ก่อนปิด:
   - รัน test / เช็คตามช่อง "เช็ค" ของข้อนั้นให้ผ่าน
   - `git commit` ผลงาน
   - ให้ Claude อัปเดตไฟล์นี้: ติ๊กข้อที่เสร็จ, เพิ่มแถวใน "บันทึกการทำงาน", เขียนเรื่องที่ค้างไว้
4. ข้อที่ยาว (ข้อ 6 Classroom, ข้อ 8 LINE) แบ่งเป็น 2-3 session ตามข้อย่อยได้

## กติกาของทีม (สรุปจาก README)

- `src/main/`, `supabase/` = Backend (เบล) / `src/renderer/` = Frontend (เพื่อน)
- `src/preload/`, `src/shared/` = ต้องคุยกันก่อนแก้ ทั้ง `ipc-channels.js` และ `constants.js`
- renderer ห้ามเข้า DB ตรง ต้องผ่าน IPC (`window.api.invoke`) เท่านั้น
- ห้ามเพิ่ม field/feature/requirement ที่ไม่มีใน `PROJECT_v0.13.md` ถ้าต้องเปลี่ยนให้ขึ้นเวอร์ชัน spec ก่อน แล้วค่อยแก้โค้ด
- เรื่องที่ยังรอคุยกับอาจารย์ให้เป็น TBD/Open Questions ใน spec และอย่าเพิ่งเขียนโค้ด
- Secrets (LINE token ฯลฯ) ห้ามอยู่ใน repo ให้ใช้ `supabase secrets set`

---

## สถานะปัจจุบัน

ทำแล้ว:
- สร้างโครงโฟลเดอร์และไฟล์ stub ทั้งหมด (header 3 บรรทัดทุกไฟล์) + `package.json`, `.gitignore`, `.env.example`, `.prettierrc`, `main.js`, `preload.js`, `ipc-channels.js`, `constants.js`, `README.md`
- วาง `docs/PROJECT_v0.13.md` แล้ว (แทน v0.12 ซึ่งลบออกแล้ว และประวัติ git ถูกรวมเป็น commit เดียว จึงไม่มี v0.12 ใน repo อีก) ต้องอัปโหลดฉบับ v0.13 ขึ้น Claude Project ให้ตรงกับในโฟลเดอร์
- `npm install` และ `npm run dev` ผ่าน: หน้าต่างเปล่าขึ้น, `window.api` มี `channels/invoke/on`, `invoke('foo:bar')` ถูกปฏิเสธตาม whitelist

ยังไม่ได้ทำ / ยังไม่ยืนยัน:
- git: init + commit แรก + branch `backend`/`frontend` เสร็จในเครื่อง แต่ยังไม่ push (ข้อ 0.1)
- คุย IPC contract กับเพื่อน (ข้อ 0.4)
- SQLite binding: เลือก `better-sqlite3` แล้ว แต่ยังไม่ได้ติดตั้ง
- ยังไม่มีโค้ด feature จริงเลย ทุก service/ipc เป็น stub ว่าง

### ข้อสังเกตเรื่องโครงที่สร้างไว้ (ควรรู้ก่อนทำต่อ)

- `constants.js` มีค่า enum จริงจาก spec, ไฟล์ HTML มีโครงเต็ม, Edge Function ทั้งสองมี `Deno.serve` คืน 501, `package.json` มี config ของ electron-builder, และมี `ipc/index.js` เพิ่มเอง ซึ่งเกินคำว่า "ไฟล์เปล่า" เล็กน้อย ตัดทิ้งได้ถ้าไม่ต้องการ
- `main.js` ตั้ง `sandbox: false` เพราะ `preload.js` ต้อง `require('../shared/ipc-channels')`
- channel ที่เป็นการตีความของเรา ไม่ได้เขียนตรง ๆ ใน spec ให้ตกลงกับเพื่อนว่าจะเอาไหม: `classroom:get-status`, `settings:get`, `settings:set`, `line:get-status`
- การสร้างรหัสผูก LINE ฝั่งแอป (`createLineLinkCode`, `disconnectLine`) วางไว้ใน `cloud-sync.service.js`
- หน้า `pages/pomodoro/` มีอยู่ แต่ spec §15 บอกว่าเข้าจาก task เท่านั้น ไม่มี session แบบไม่ผูก task
- header ของไฟล์อ้างเลข section ของ spec (v0.13 ไม่ได้เลื่อนเลข section จาก v0.12) ถ้าขึ้นเวอร์ชันแล้วเลขเลื่อน ต้อง grep แก้
- Electron ที่ใช้ `^44.5.1`, electron-builder `^26.15.3`

---

## ข้อ 0: เตรียมก่อนเริ่ม (ทำกับเพื่อน)

- [ ] 0.1 `git init`, push ขึ้น GitHub, แยก branch `backend` / `frontend`, merge เข้า `main` ผ่าน PR
  - ทำแล้วในเครื่อง: `git init -b main`, รวมประวัติเป็น commit เดียว (เบลตั้งชื่อเอง), สร้าง branch `backend` / `frontend`, ตั้ง `origin` = `https://github.com/Kenshi1112/StudyFlow.git`
  - เหลือ: เบล push เอง (`main`, `backend`, `frontend`) และเปิด PR แรกเพื่อลองวิธี merge
- [x] 0.2 วาง `PROJECT_v0.12.md` ลง `docs/` (ตอนนี้ใช้ `PROJECT_v0.13.md` แทนแล้ว)
- [x] 0.3 `npm install` + `npm run dev` ขึ้นหน้าต่างเปล่า, preload ทำงาน
- [x] 0.4 นั่งดู `ipc-channels.js` กับเพื่อน ตัด/แก้ channel แล้วเขียน payload shape ของ `tasks:*` ลง `docs/ipc-contract.md` (field ต้องตรง §19)
  - เสร็จ: `docs/ipc-contract.md` ตัดสินครบแล้ว (เบลตัดสิน 2026-10-05) เก็บ channel ตีความทั้ง 4 ตัว ถ้าเพื่อนค้านให้แก้ไฟล์นั้นแล้วบอกกัน
  - spec v0.13 ยืนยันแล้ว (เบล 2026-10-05): Priority ผู้ใช้ใส่เองเข้าสูตร Urgency Score (0.4/0.24/0.16/0.2), `classroom_course_name` เปลี่ยนเป็น `course_name` และ `ipc-contract.md` อัปเดตตามแล้ว ข้อ 1.2 และ 1.6 เริ่มได้
  - เพิ่ม `TASK_PRIORITY` ใน `src/shared/constants.js` แล้ว (เบลตัดสินเพิ่มเลย เพราะอาจารย์สั่ง และเป็นการเพิ่มค่าใหม่ ไม่ได้แก้ของเดิม)
  - เหลือ: เพื่อนต้องเพิ่มช่อง Priority กับ Course (ไม่บังคับ) ในฟอร์ม task
- [ ] 0.5 ตัดสินใจ: SQLite binding (Backend), วิธีสลับหน้า (Frontend)
  - Backend ตัดสินแล้ว: ใช้ `better-sqlite3` (ติดตั้งจริงในข้อ 1.1)
  - เหลือ: วิธีสลับหน้า (Frontend) รอเพื่อน
- [x] 0.6 commit `package-lock.json` (อยู่ใน commit แรก)

## ข้อ 1: ฐานข้อมูลและ Task

- [ ] 1.1 เลือกและติดตั้ง SQLite binding (โมดูล native ต้อง rebuild ให้ตรงกับ Electron) เช็ค: require ได้ใน main process
- [ ] 1.2 เขียน `schema.sql` ตาม §19 (v0.13: `tasks` มี `course_name` และ `priority`): `tasks`, `classroom_sync_state`, `pomodoro_sessions`, `notification_log`, `settings`
- [ ] 1.3 เขียน `database.js`: `initDatabase` (ไฟล์ใน `app.getPath('userData')`), `runMigrations` เช็ค: เปิดแอป 2 ครั้ง ตารางไม่ถูกสร้างซ้ำ
- [ ] 1.4 `task.service.js` ส่วน CRUD + soft delete (`deleted_at`) + ตั้ง `completed_at` ตอนเป็น Completed
- [ ] 1.5 `computeDeadlineState` ตามตาราง §9.2 + unit test ใน `tests/`
- [ ] 1.6 `computeUrgencyScore` ตามสูตร §9.5 (v0.13 มี 4 เทอม รวม Priority Factor) + unit test
- [ ] 1.7 `tasks.ipc.js`, `ipc/index.js`, เรียก `initDatabase()` + `registerAllIpc()` ใน `main.js` เช็ค: `window.api.invoke('tasks:list')` ใน DevTools ได้ข้อมูล

จุดนัดกับเพื่อน: เสร็จข้อ 1.7 เพื่อนต่อ Task Board กับข้อมูลจริงได้

## ข้อ 2: Settings

- [ ] 2.1 `settings.ipc.js` เป็น key-value get/set บน table `settings`
- [ ] 2.2 เก็บค่าตาม spec: `has_seen_first_run_prompt` (§19), cutoff date (§13.1), reminder window (§11.1 เริ่มต้น 1 วัน)

## ข้อ 3: Pomodoro (§15)

- [ ] 3.1 `startBatch`: ตั้ง `last_focus_started_at` ทุกครั้ง, Not Started เป็น In Progress ครั้งแรกเท่านั้น
- [ ] 3.2 timer ใน main process: focus, break, focus ต่อเนื่องจนครบ batch, มี pause/resume/stop
- [ ] 3.3 บันทึก `pomodoro_sessions` ทีละ focus period (break ไม่บันทึก) พร้อม `batch_id`, `session_index`, `session_total`
- [ ] 3.4 ปิดแอปกลางคัน บันทึกเวลาที่ผ่านไปด้วย `completed = false` (§15.1)
- [ ] 3.5 ส่ง event `pomodoro:state-changed`
- [ ] 3.6 `floating-widget.js` หน้าต่างที่ 2 always-on-top รับ state ผ่าน IPC
- [ ] 3.7 OS notification ทุกครั้งที่เปลี่ยน phase เช็ค: รัน 1 batch จนจบแล้วตรวจแถวใน `pomodoro_sessions`

## ข้อ 4: Dashboard (§10)

- [ ] 4.1 7 metrics ใน `dashboard.service.js` ตามตาราง §10.2 (Overdue กับ Longest Inactive ไม่ขึ้นกับช่วงเวลา)
- [ ] 4.2 Average Time-to-Start Lag ตามสูตร §10.3
- [ ] 4.3 unit test โดยเฉพาะ Time-to-Start Lag
- [ ] 4.4 `dashboard.ipc.js`

## ข้อ 5: Notification บนเดสก์ท็อป (§11)

- [ ] 5.1 `startScheduler`: เช็คตอนเปิดแอปและทุก 15 นาที
- [ ] 5.2 ส่ง notification ตาม 3 กฎ (Due Today, Overdue, อยู่ในหน้าต่าง reminder)
- [ ] 5.3 กันซ้ำด้วย `notification_log` โดยใช้ state 6 ค่ารวม `upcoming_within_window` (§11.3) เช็ค: เปลี่ยน due date ทดสอบทีละ state แล้วแจ้งเตือนครั้งเดียวต่อ state

## ข้อ 6: Google Classroom (§13) แนะนำให้เริ่มข้อ 6.1 ตั้งแต่ช่วงข้อ 1 เพราะรอฝั่ง Google นาน

- [ ] 6.1 สร้าง Google Cloud project, เปิด Classroom API, ตั้ง OAuth consent screen, เพิ่มอีเมลทดสอบ
- [ ] 6.2 OAuth flow แบบ desktop, เก็บ refresh token ด้วย `safeStorage` (ห้ามเก็บใน DB หรือไฟล์ที่ sync)
- [ ] 6.3 ให้ผู้ใช้เลือก cutoff date ตอนเชื่อมต่อครั้งแรก
- [ ] 6.4 fetch เฉพาะ `workType = ASSIGNMENT`, กรองด้วย cutoff, ข้ามรายการที่อยู่ใน `classroom_sync_state`, บันทึกรายการใหม่เป็น `pending`
- [ ] 6.5 `decideItem`: Create Task (status จาก `StudentSubmission.state`) หรือ Ignore (ถาวรทั้งคู่)
- [ ] 6.6 fetch อัตโนมัติ 1 ครั้งตอนเปิดแอป + `syncNow` (ไม่มีของใหม่ต้องมี toast)
- [ ] 6.7 ถ้า Pomodoro กำลังวิ่ง ห้ามเด้ง popup ส่ง event `classroom:pending-changed` ให้ UI แสดงตัวบอกเงียบ ๆ

## ข้อ 7: Supabase และ Cloud Sync (§18)

- [ ] 7.1 สร้าง Supabase project, migration `tasks` + `pomodoro_sessions` ใน `supabase/migrations/` พร้อม RLS
- [ ] 7.2 ตั้ง `updated_at` ฝั่ง server (trigger) สำหรับ LWW
- [ ] 7.3 Supabase Auth ด้วย Google provider
- [ ] 7.4 `pushLocalChanges` / `pullRemoteChanges` ด้วย sync cursor
- [ ] 7.5 sync ทุก 5-10 นาที + debounce หลังเขียน local
- [ ] 7.6 unit test ของ LWW เช็ค: แก้ task จากสองฝั่ง ฝั่งที่เขียนหลังชนะ

## ข้อ 8: LINE (§14) ใช้เวลาราว 2.5-3 สัปดาห์ตามที่ spec ประเมิน

- [ ] 8.1 สมัคร LINE Official Account + Messaging API, เก็บ token/secret ด้วย `supabase secrets set`
- [ ] 8.2 migration 4 ตารางของ §19.4: `line_link_codes`, `line_account_links`, `line_conversation_state`, `line_notification_log`
- [ ] 8.3 `line-webhook` ส่วนแรก: ตรวจ signature, ผูกบัญชีด้วยรหัส 10 นาที, ตอบกลับ
- [ ] 8.4 `line-webhook` flow สร้าง task: course (Quick Reply), title, due date (Datetime Picker), state ใน `line_conversation_state` (ล้างเมื่อเกิน 10 นาที), insert `source = 'line'`
- [ ] 8.5 ฝั่งแอป: Connect/Disconnect LINE ผ่าน `line.ipc.js` และ `cloud-sync.service.js`
- [ ] 8.6 `notify-check`: คำนวณ deadline state ตาม §9.2 (เขียนซ้ำใน Deno), เทียบ `line_notification_log`, push
- [ ] 8.7 ตั้ง `pg_cron` เรียก `notify-check` ทุก 15-30 นาที
- [ ] 8.8 `supabase functions deploy`, ใส่ URL ใน LINE webhook เช็ค: ลองกับ LINE จริงทั้งผูกบัญชี สร้าง task และรอ push

## ข้อ 9: ปิดงาน

- [ ] 9.1 ทดสอบวนทั้งระบบ (Classroom, task, Pomodoro, Dashboard, แจ้งเตือน, sync, LINE)
- [ ] 9.2 `npm run build` แล้วลองติดตั้ง installer บนเครื่องที่ไม่ใช่เครื่อง dev
- [ ] 9.3 เตรียม user test กับรุ่นน้อง

## แทร็กของเพื่อน (Frontend) ทำขนานกัน

ลำดับแนะนำ: Room, Task Board (หลังข้อ 1.7), Settings, Pomodoro + widget (หลังข้อ 3), Dashboard (หลังข้อ 4), Calendar
ระหว่างรอ backend ใช้ข้อมูลจำลองใน renderer ได้ แต่ต้องเรียกผ่าน `window.api.invoke` ตาม contract

## ส่วนที่ควรเขียนเองและอธิบายได้ตอนสอบ

Deadline State, Urgency Score, Time-to-Start Lag, LWW เป็นแกนของโปรเจกต์ (spec §29)
ส่วน boilerplate (OAuth flow, SQL migration, โครง Edge Function) ใช้ AI ช่วยได้แต่ต้องอ่านและเข้าใจก่อน commit

---

## บันทึกการทำงาน (เพิ่มแถวใหม่ทุกครั้งที่จบ session)

| วันที่ | ข้อที่ทำ | สรุปสิ่งที่ทำ | เรื่องค้าง / สิ่งที่ต้องรู้ก่อนทำต่อ |
|---|---|---|---|
| 2026-10-05 | 0.2, 0.3 | สร้างโครง skeleton ทั้งหมด, `npm install`, `npm run dev` ผ่าน, ตรวจ preload ใน DevTools ผ่าน | ยังไม่ได้ทำ 0.1 (git), 0.4 (คุย IPC กับเพื่อน), 0.5 (เลือก SQLite binding) |
| 2026-10-05 | 0.1, 0.4, 0.5, 0.6 | `git init`/commit แรก/branch `backend`+`frontend`/ตั้ง remote, ร่าง `docs/ipc-contract.md` (tasks:*), เลือก `better-sqlite3`, `package-lock.json` เข้า commit แรก | (1) ต้อง push เอง (2) ipc-contract ตัดสินครบแล้ว (เพื่อนค้านได้ ให้แก้ไฟล์) (3) **spec gap**: §14.3 อ้าง `course_name` ใน `tasks` แต่ §19 ไม่มี field นี้ (มีแค่ `classroom_course_name`) ต้องแก้ spec ก่อนทำ course ของ manual/LINE task (4) ข้อ 1.1: ติดตั้ง `better-sqlite3` ต้องรันบน Windows เอง (`node_modules` เป็นของ Windows) และเช็คว่ามี prebuilt สำหรับ Electron 44.5.1 ถ้าไม่มีต้องมี build tools |
| 2026-10-05 | spec | เปลี่ยนมาใช้ `PROJECT_v0.13.md` (Priority เข้าสูตร Urgency Score, `course_name` ใช้กับทุก source), ลบ `PROJECT_v0.12.md`, เปลี่ยนการอ้างอิงใน 21 ไฟล์ (README, comment โค้ด, ROADMAP), อัปเดต `ipc-contract.md` | (1) อัปโหลด v0.13 ขึ้น Claude Project (2) เพิ่ม `TASK_PRIORITY` ใน `constants.js` แล้ว แจ้งเพื่อนตอน PR (3) UX-UI-Design-Review ต้องเพิ่ม Priority ในฟอร์ม/การ์ด และช่อง Course ในฟอร์ม manual |
