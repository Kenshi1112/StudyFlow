# StudyFlow Roadmap และบันทึกความคืบหน้า

ไฟล์นี้คือแผนทำงานทีละขั้นและบันทึกว่าทำอะไรไปแล้ว ใช้เป็นจุดต่อเวลาเปลี่ยน session
Spec หลักคือ `docs/PROJECT_v0.14.md` ถ้าไฟล์นี้ขัดกับ spec ให้ยึด spec

อัปเดตล่าสุด: 2026-10-16

---

## วิธีเริ่ม session ใหม่ (ทำทีละข้อใหญ่ ข้อละ 1 session)

1. เปิด session ใหม่ในโฟลเดอร์ `Final_Project_FR`
2. พิมพ์ประมาณนี้:
   > อ่าน docs/ROADMAP.md แล้วทำต่อที่ "ข้อ X" ฉันทำ Backend (src/main, supabase) เพื่อนทำ Frontend (src/renderer) ห้ามเพิ่มอะไรนอก PROJECT_v0.14.md
3. จบ session ให้ทำตามนี้ก่อนปิด:
   - รัน test / เช็คตามช่อง "เช็ค" ของข้อนั้นให้ผ่าน
   - `git commit` ผลงาน
   - ให้ Claude อัปเดตไฟล์นี้: ติ๊กข้อที่เสร็จ, เพิ่มแถวใน "บันทึกการทำงาน", เขียนเรื่องที่ค้างไว้
4. ข้อที่ยาว (ข้อ 6 Classroom, ข้อ 8 LINE) แบ่งเป็น 2-3 session ตามข้อย่อยได้

## กติกาของทีม (สรุปจาก README)

- `src/main/`, `supabase/` = Backend (เบล) / `src/renderer/` = Frontend (เพื่อน)
- `src/preload/`, `src/shared/` = ต้องคุยกันก่อนแก้ ทั้ง `ipc-channels.js` และ `constants.js`
- renderer ห้ามเข้า DB ตรง ต้องผ่าน IPC (`window.api.invoke`) เท่านั้น
- ห้ามเพิ่ม field/feature/requirement ที่ไม่มีใน `PROJECT_v0.14.md` ถ้าต้องเปลี่ยนให้ขึ้นเวอร์ชัน spec ก่อน แล้วค่อยแก้โค้ด
- เรื่องที่ยังรอคุยกับอาจารย์ให้เป็น TBD/Open Questions ใน spec และอย่าเพิ่งเขียนโค้ด
- Secrets (LINE token ฯลฯ) ห้ามอยู่ใน repo ให้ใช้ `supabase secrets set`

---

## สถานะปัจจุบัน

ทำแล้ว:
- สร้างโครงโฟลเดอร์และไฟล์ stub ทั้งหมด (header 3 บรรทัดทุกไฟล์) + `package.json`, `.gitignore`, `.env.example`, `.prettierrc`, `main.js`, `preload.js`, `ipc-channels.js`, `constants.js`, `README.md`
- วาง `docs/PROJECT_v0.13.md` แล้ว (แทน v0.12 ซึ่งลบออกแล้ว และประวัติ git ถูกรวมเป็น commit เดียว จึงไม่มี v0.12 ใน repo อีก) และ Claude Project ใช้ v0.13 ตรงกับในโฟลเดอร์แล้ว
- `docs/ipc-contract.md` ตัดสินครบ, `TASK_PRIORITY` อยู่ใน `constants.js`, `docs/UX-UI-Design-Review_v0.13.md` อัปเดตเรื่อง Priority/Course แล้ว
- สเปกขึ้น `docs/PROJECT_v0.14.md` และ `docs/UX-UI-Design-Review_v0.14.md` แล้ว (2026-10-11, แทน v0.13 ซึ่งลบแล้ว): เพิ่ม `tasks.first_started_at`, ตัดเมตริก Longest Inactive Assignment เหลือ 6 metrics, สูตร Urgency Score ไม่เปลี่ยน โค้ดข้อ 1 ตามแก้แล้ว (ข้อ 1.2b) ส่วนที่เหลือคือข้อ 3.1, 4.1-4.3, 7.1
- push `main`, `backend`, `frontend` ขึ้น GitHub แล้ว (commit เดียว `initial commit`, เบล force push เอง)
- `npm install` และ `npm run dev` ผ่าน: หน้าต่างเปล่าขึ้น, `window.api` มี `channels/invoke/on`, `invoke('foo:bar')` ถูกปฏิเสธตาม whitelist
- ข้อ 1 ครบ (1.1-1.7): SQLite (`schema.sql`, `database.js`), `task.service.js` (CRUD, Deadline State, Urgency Score), `tasks:*` IPC ต่อใน `main.js` เช็คใน Electron แล้ว และ commit แล้ว (PR #1 merge เข้า `main`) เทสของข้อ 1.5/1.6 ยังอยู่แค่ใน `_claude-draft/tests/` ใน `tests/` มีแต่ `schema.test.js` (ยังไม่ track)

- ข้อ 2 ครบ (Settings) และข้อ 3 ครบ (3.1-3.7 Pomodoro, 2026-10-16): timer ใน main process, บันทึก `pomodoro_sessions`, event `pomodoro:state-changed`, floating widget, OS notification, `settings` เพิ่ม key ความยาว focus/break

ยังไม่ได้ทำ / ยังไม่ยืนยัน:
- เพื่อนเพิ่มช่อง Priority/Course ในฟอร์ม task (เหลือของข้อ 0.4) และทำ `index.html` ตามวิธีสลับหน้าที่ตัดสินแล้ว (ข้อ 0.5)
- ที่เหลือ (ข้อ 4 เป็นต้นไป) ทุก service/ipc ยังเป็น stub ว่าง

### ข้อสังเกตเรื่องโครงที่สร้างไว้ (ควรรู้ก่อนทำต่อ)

- `constants.js` มีค่า enum จริงจาก spec, ไฟล์ HTML มีโครงเต็ม, Edge Function ทั้งสองมี `Deno.serve` คืน 501, `package.json` มี config ของ electron-builder, และมี `ipc/index.js` เพิ่มเอง ซึ่งเกินคำว่า "ไฟล์เปล่า" เล็กน้อย ตัดทิ้งได้ถ้าไม่ต้องการ
- `main.js` ตั้ง `sandbox: false` เพราะ `preload.js` ต้อง `require('../shared/ipc-channels')`
- channel ที่เป็นการตีความของเรา ไม่ได้เขียนตรง ๆ ใน spec ให้ตกลงกับเพื่อนว่าจะเอาไหม: `classroom:get-status`, `settings:get`, `settings:set`, `line:get-status`
- การสร้างรหัสผูก LINE ฝั่งแอป (`createLineLinkCode`, `disconnectLine`) วางไว้ใน `cloud-sync.service.js`
- หน้า `pages/pomodoro/` มีอยู่ แต่ spec §15 บอกว่าเข้าจาก task เท่านั้น ไม่มี session แบบไม่ผูก task
- header ของไฟล์อ้างเลข section ของ spec (v0.13 ไม่ได้เลื่อนเลข section จาก v0.12) ถ้าขึ้นเวอร์ชันแล้วเลขเลื่อน ต้อง grep แก้
- Electron ที่ใช้ `^44.5.1`, electron-builder `^26.15.3`
- `better-sqlite3` ที่ใช้คือ `^13.0.3` (N-API) มีไบนารีสำเร็จรูปในแพ็กเกจ **ไม่ต้อง rebuild และไม่ต้องลง Visual Studio** ห้ามรัน `electron-builder install-app-deps` หรือเพิ่มเป็น `postinstall` (มันพยายาม compile เองแล้วพังด้วย error `Could not find any Visual Studio installation`)
- ข้อ 9.2: `npm run build` อาจเจอ error เดียวกันเพราะ electron-builder ลอง rebuild native module ให้ตั้ง `"npmRebuild": false` ใน `build` ของ `package.json`
- `better-sqlite3` 13 ต้องใช้ Node 22 ขึ้นไป

---

## ข้อ 0: เตรียมก่อนเริ่ม (ทำกับเพื่อน)

- [x] 0.1 `git init`, push ขึ้น GitHub, แยก branch `backend` / `frontend`, merge เข้า `main` ผ่าน PR
  - เสร็จแล้ว: `git init -b main`, รวมประวัติเป็น commit เดียว (`initial commit`), branch `backend` / `frontend`, ตั้ง `origin` = `https://github.com/Kenshi1112/StudyFlow.git`, force push ทั้งสาม branch แล้ว (2026-10-06)
  - ทำงานบน branch `backend` (เบล) / `frontend` (เพื่อน) แล้วเปิด PR ไปที่ `main` ตอนจบแต่ละข้อ PR แรกจะเกิดตอนจบข้อ 1.1 เพราะตอนนี้ทุก branch เหมือน `main` เปิด PR ไม่ได้
- [x] 0.2 วาง `PROJECT_v0.12.md` ลง `docs/` (ตอนนี้ใช้ `PROJECT_v0.13.md` แทนแล้ว)
- [x] 0.3 `npm install` + `npm run dev` ขึ้นหน้าต่างเปล่า, preload ทำงาน
- [x] 0.4 นั่งดู `ipc-channels.js` กับเพื่อน ตัด/แก้ channel แล้วเขียน payload shape ของ `tasks:*` ลง `docs/ipc-contract.md` (field ต้องตรง §19)
  - เสร็จ: `docs/ipc-contract.md` ตัดสินครบแล้ว (เบลตัดสิน 2026-10-05) เก็บ channel ตีความทั้ง 4 ตัว ถ้าเพื่อนค้านให้แก้ไฟล์นั้นแล้วบอกกัน
  - spec v0.13 ยืนยันแล้ว (เบล 2026-10-05): Priority ผู้ใช้ใส่เองเข้าสูตร Urgency Score (0.4/0.24/0.16/0.2), `classroom_course_name` เปลี่ยนเป็น `course_name` และ `ipc-contract.md` อัปเดตตามแล้ว ข้อ 1.2 และ 1.6 เริ่มได้
  - เพิ่ม `TASK_PRIORITY` ใน `src/shared/constants.js` แล้ว (เบลตัดสินเพิ่มเลย เพราะอาจารย์สั่ง และเป็นการเพิ่มค่าใหม่ ไม่ได้แก้ของเดิม)
  - ตัดสินแล้ว: `due_date` เก็บเป็น ISO 8601 วัน+เวลา (เพราะ LINE เก็บเวลาด้วย) spec §26 ปล่อยให้ตอน implement จึงไม่ต้องขึ้นเวอร์ชัน spec
  - Frontend ทำแล้ว (2026-10-07): ฟอร์ม task ที่ใช้ร่วมกัน `src/renderer/components/task-form.js` + `.css` มีช่อง Priority (segmented control ไม่มีค่าเริ่มต้น กดซ้ำเพื่อล้าง) และ Course (ไม่บังคับ) ใช้ทั้งโมดัลสร้าง (create) และแผงข้าง (edit) ในหน้า Task Board
- [x] 0.5 ตัดสินใจ: SQLite binding (Backend), วิธีสลับหน้า (Frontend)
  - Backend ตัดสินแล้ว: ใช้ `better-sqlite3` (ติดตั้งจริงในข้อ 1.1)
  - Frontend ตัดสินแล้ว (2026-10-07, เบลยืนยันตามที่เพื่อนทำ): หน้าเดียว + hash router (`src/renderer/router.js`, route `#/room`, `#/task-board`, `#/dashboard`, `#/calendar`, `#/settings`, `#/pomodoro?task=<id>`) แต่ละหน้าเป็น fragment + ลงทะเบียน `window.pages[name] = { mount(root, params), unmount() }` (เปลี่ยนจากแยกหน้า multi-page ที่ตัดสินไว้ 2026-10-06 ข้อควรระวังเรื่องตัวแปรหายตอนเปลี่ยนหน้าจึงไม่ใช้แล้ว)
- [x] 0.6 commit `package-lock.json` (อยู่ใน commit แรก)

## ข้อ 1: ฐานข้อมูลและ Task

- [x] 1.1 เลือกและติดตั้ง SQLite binding เช็ค: require ได้ใน main process
  - เสร็จ: ติดตั้ง `better-sqlite3@^13.0.3` (ไม่ต้อง rebuild ดูหมายเหตุด้านบน) และเช็คใน Electron แล้ว (2026-10-06): `npm run dev` main ไม่ error, `window.api.invoke('tasks:list')` ตอบ `[]`, `tasks:create` แล้ว `tasks:list` เห็น task
- [x] 1.2 เขียน `schema.sql` ตาม §19 (v0.13: `tasks` มี `course_name` และ `priority`): `tasks`, `classroom_sync_state`, `pomodoro_sessions`, `notification_log`, `settings`
- [x] 1.2b (v0.14) เพิ่ม `first_started_at TEXT` ในตาราง `tasks` ของ `schema.sql` และใน `tests/schema.test.js` (รายชื่อคอลัมน์กับเช็คว่าเป็น NULL ได้) แล้วลบไฟล์ `studyflow.sqlite` ใน userData เพราะไม่มีระบบ migration
  - เสร็จ (2026-10-11): แก้ `schema.sql` กับ `tests/schema.test.js` แล้ว `node --test tests/schema.test.js` ผ่าน 18/18 **เหลือเบลลบ `studyflow.sqlite` ใน userData เอง** (ไม่งั้น DB เก่าไม่มีคอลัมน์ใหม่)
- [x] 1.3 เขียน `database.js`: `initDatabase` (ไฟล์ใน `app.getPath('userData')`), `runMigrations` เช็ค: เปิดแอป 2 ครั้ง ตารางไม่ถูกสร้างซ้ำ
- [x] 1.4 `task.service.js` ส่วน CRUD + soft delete (`deleted_at`) + ตั้ง `completed_at` ตอนเป็น Completed
- [x] 1.5 `computeDeadlineState` ตามตาราง §9.2 + unit test ใน `tests/`
- [x] 1.6 `computeUrgencyScore` ตามสูตร §9.5 (v0.13 มี 4 เทอม รวม Priority Factor) + unit test
- [x] 1.7 `tasks.ipc.js`, `ipc/index.js`, เรียก `initDatabase()` + `registerAllIpc()` ใน `main.js` เช็ค: `window.api.invoke('tasks:list')` ใน DevTools ได้ข้อมูล

ข้อตัดสินใจของเบลที่ spec ไม่ได้ระบุ (ตัดสินแล้ว 2026-10-06):
  - Deadline State: task ที่ `completed` ให้เป็น `completed` ทุกกรณีที่มี due_date (§9.2 ระบุแค่กรณี completed + due_date ผ่านไปแล้ว) ไม่มี due_date ยังเป็น `no_deadline`

## ข้อ 2: Settings

- [x] 2.1 `settings.ipc.js` เป็น key-value get/set บน table `settings`
- [x] 2.2 เก็บค่าตาม spec: `has_seen_first_run_prompt` (§19), cutoff date (§13.1), reminder window (§11.1 เริ่มต้น 1 วัน)
  - เสร็จ (2026-10-08): โค้ดอยู่ใน `src/` (`settings.service.js`, `settings.ipc.js`, `ipc/index.js`) เทสและ smoke test ผ่าน และเบลเช็คใน DevTools แล้ว: get/set ได้, payload ผิด reject, ปิด-เปิดแอปใหม่ค่ายังอยู่

## ข้อ 3: Pomodoro (§15)

- [x] 3.1 `startBatch`: ตั้ง `last_focus_started_at` ทุกครั้ง, Not Started เป็น In Progress ครั้งแรกเท่านั้น, และ (v0.14) ตั้ง `first_started_at` เฉพาะตอนที่ยังเป็น null ห้ามเขียนทับ + เทส
- [x] 3.2 timer ใน main process: focus, break, focus ต่อเนื่องจนครบ batch, มี pause/resume/stop
- [x] 3.3 บันทึก `pomodoro_sessions` ทีละ focus period (break ไม่บันทึก) พร้อม `batch_id`, `session_index`, `session_total`
- [x] 3.4 ปิดแอปกลางคัน บันทึกเวลาที่ผ่านไปด้วย `completed = false` (§15.1)
- [x] 3.5 ส่ง event `pomodoro:state-changed`
- [x] 3.6 `floating-widget.js` หน้าต่างที่ 2 always-on-top รับ state ผ่าน IPC
- [x] 3.7 OS notification ทุกครั้งที่เปลี่ยน phase เช็ค: รัน 1 batch จนจบแล้วตรวจแถวใน `pomodoro_sessions`
  - เสร็จ (2026-10-16): โค้ดอยู่ใน `src/` (`pomodoro.service.js`, `pomodoro.ipc.js`, `floating-widget.js`, `ipc/index.js`, `settings.service.js`, `main.js`) เทสและ smoke test ผ่าน และเบลเช็คใน Electron แล้วผ่านหมด
  - ข้อตัดสินใจของเบลที่ spec ไม่ได้ระบุ (2026-10-16): ความยาว focus/break อยู่ใน `settings` (`pomodoro_focus_minutes` 25 / `pomodoro_break_minutes` 5, จำนวนเต็ม ≥ 1) payload ของ `start-batch` จึงมีแค่ `{ task_id, session_total }` / ไม่มี break หลังรอบสุดท้าย / เด้งเป็น In Progress เฉพาะ batch แรก (ตอน `first_started_at` ยังว่าง) / task `completed` กด Start ไม่ได้ / กด Start ตอนมี batch วิ่ง = reject / Stop ที่ 0 วินาทีไม่บันทึกแถว / notification ตอนเปลี่ยน phase และตอนจบ ไม่ส่งตอนกด Start / ส่ง event `pomodoro:state-changed` ทุก 1 วินาที / ปิดหน้าต่างหลัก = ปิดทั้งแอป (บันทึก partial ตาม §15.1)

## ข้อ 4: Dashboard (§10)

- [ ] 4.1 6 metrics ใน `dashboard.service.js` ตามตาราง §10.2 (v0.14: ตัด Longest Inactive Assignment แล้ว, มีแค่ Overdue ที่ไม่ขึ้นกับช่วงเวลา)
- [ ] 4.2 Average Time-to-Start Lag ตามสูตร §10.3 (v0.14: ใช้ `tasks.first_started_at` แทน session แรกใน `pomodoro_sessions`)
- [ ] 4.3 unit test โดยเฉพาะ Time-to-Start Lag (v0.14: รวมเคส `first_started_at` เป็น null ต้องถูกตัดออก)
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

- [ ] 7.1 สร้าง Supabase project, migration `tasks` + `pomodoro_sessions` ใน `supabase/migrations/` พร้อม RLS (v0.14: ตาราง `tasks` มีคอลัมน์ `first_started_at`)
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

ความคืบหน้า (2026-10-07): Room ทำแล้วตาม Figma (`pages/room/`, ฉาก 1920x1080 ย่อตามหน้าต่าง, จุดคลิกไป Task Board/Dashboard/Calendar/Settings, รูปหน้าต่างเปลี่ยนตามเวลาเครื่อง); Task Board ทำแค่ฟอร์ม + รายการแบบบาง ๆ ยังต้องทำต่อหลังข้อ 1.7

ลำดับแนะนำ: Room, Task Board (หลังข้อ 1.7), Settings, Pomodoro + widget (หลังข้อ 3), Dashboard (หลังข้อ 4), Calendar
(v0.14) Dashboard: แถบ Needs Attention มี Overdue ตัวเดียว (ไม่มี Longest Inactive แล้ว)
ระหว่างรอ backend ใช้ข้อมูลจำลองใน renderer ได้ แต่ต้องเรียกผ่าน `window.api.invoke` ตาม contract

## ส่วนที่ควรเขียนเองและอธิบายได้ตอนสอบ

Deadline State, Urgency Score, Time-to-Start Lag, LWW ต้องเขียนเองและอธิบายได้ตอนสอบ (spec §29: Urgency Score ใช้แค่เป็นลำดับเริ่มต้นของ Task Board ไม่ใช่จุดเด่น)
ส่วน boilerplate (OAuth flow, SQL migration, โครง Edge Function) ใช้ AI ช่วยได้แต่ต้องอ่านและเข้าใจก่อน commit

---

## บันทึกการทำงาน (เพิ่มแถวใหม่ทุกครั้งที่จบ session)

| วันที่ | ข้อที่ทำ | สรุปสิ่งที่ทำ | เรื่องค้าง / สิ่งที่ต้องรู้ก่อนทำต่อ |
|---|---|---|---|
| 2026-10-05 | 0.2, 0.3 | สร้างโครง skeleton ทั้งหมด, `npm install`, `npm run dev` ผ่าน, ตรวจ preload ใน DevTools ผ่าน | ยังไม่ได้ทำ 0.1 (git), 0.4 (คุย IPC กับเพื่อน), 0.5 (เลือก SQLite binding) |
| 2026-10-05 | 0.1, 0.4, 0.5, 0.6 | `git init`/commit แรก/branch `backend`+`frontend`/ตั้ง remote, ร่าง `docs/ipc-contract.md` (tasks:*), เลือก `better-sqlite3`, `package-lock.json` เข้า commit แรก | (1) ต้อง push เอง (2) ipc-contract ตัดสินครบแล้ว (เพื่อนค้านได้ ให้แก้ไฟล์) (3) **spec gap**: §14.3 อ้าง `course_name` ใน `tasks` แต่ §19 ไม่มี field นี้ (มีแค่ `classroom_course_name`) ต้องแก้ spec ก่อนทำ course ของ manual/LINE task (4) ข้อ 1.1: ติดตั้ง `better-sqlite3` ต้องรันบน Windows เอง (`node_modules` เป็นของ Windows) และเช็คว่ามี prebuilt สำหรับ Electron 44.5.1 ถ้าไม่มีต้องมี build tools |
| 2026-10-05 | spec | เปลี่ยนมาใช้ `PROJECT_v0.13.md` (Priority เข้าสูตร Urgency Score, `course_name` ใช้กับทุก source), ลบ `PROJECT_v0.12.md`, เปลี่ยนการอ้างอิงใน 21 ไฟล์ (README, comment โค้ด, ROADMAP), อัปเดต `ipc-contract.md` | (1) อัปโหลด v0.13 ขึ้น Claude Project (2) เพิ่ม `TASK_PRIORITY` ใน `constants.js` แล้ว แจ้งเพื่อนตอน PR (3) UX-UI-Design-Review ต้องเพิ่ม Priority ในฟอร์ม/การ์ด และช่อง Course ในฟอร์ม manual |
| 2026-10-06 | 0.1, 0.4, 0.5, spec, UX | เพิ่ม `TASK_PRIORITY` ใน `constants.js`, อัปเดต `docs/UX-UI-Design-Review_v0.13.md` (Priority/Course และส่วน LINE ของ v0.12: การ์ด LINE ใน Settings, source icon ตัวที่ 3, filter Source), ซิงก์เอกสารใน Claude Project เป็น v0.13, ล้างประวัติ git เหลือ commit เดียวแล้ว force push (`main`/`backend`/`frontend`), ตัดสินวิธีสลับหน้า (multi-page) และ `due_date` = วัน+เวลา | (1) ข้อ 1.1: รัน `npm install better-sqlite3` ใน PowerShell บน Windows เอง แล้วทำต่อ 1.2 (2) เพื่อนยังต้องเพิ่มช่อง Priority/Course ในฟอร์ม และทำ `index.html` ตามวิธีสลับหน้า (3) PR แรกเปิดตอนจบข้อ 1.1 |
| 2026-10-06 | 1.1 | `npm install better-sqlite3` ได้เวอร์ชัน 13.0.3 (N-API มีไบนารีสำเร็จรูปในแพ็กเกจ ไม่ต้อง rebuild) ถอยโค้ด 1.2-1.7 ที่ Claude เขียนล่วงหน้าไปเก็บใน `_claude-draft/` (ไม่ commit) เพราะเบลจะเขียนเอง | (1) ห้ามรัน `electron-builder install-app-deps` (2) เช็ค `require('better-sqlite3')` ใน main ตอนทำ 1.3 (3) ข้อ 9.2 ตั้ง `npmRebuild: false` |
| 2026-10-06 | 1.2-1.7 (ติ๊กแล้ว) | เขียนโค้ดข้อ 1 ทั้งชุดแบบเรียบง่าย: `schema.sql` (5 ตาราง), `database.js` (เปิด DB ใน userData แล้วรัน schema.sql, ไม่มีระบบ migration แบบมีเลข version), `task.service.js` (CRUD + soft delete + `computeDeadlineState` + `computeUrgencyScore`), `tasks.ipc.js`, `ipc/index.js`, ต่อ `initDatabase()` + `registerAllIpc()` + `closeDatabase()` ใน `main.js` ทดสอบใน `_claude-draft` ก่อน (66 เทสผ่าน รวมตัวอย่าง Urgency Score = 55.2) แล้วย้ายลง `src/` และ smoke test กับไฟล์จริง จากนั้นเบลเช็คใน Electron เอง: `tasks:list` ได้ `[]`, `tasks:create` แล้ว `tasks:list` เห็น task | (1) ยังไม่ commit/PR: ทำบน branch `backend` แล้วเปิด PR ไป `main` (2) เทสของ draft อยู่ที่ `_claude-draft/tests/` (ไม่ commit) ยังไม่ copy ลง `tests/` ตามที่ข้อ 1.5/1.6 เขียนไว้ มีแต่ `tests/schema.test.js` ที่ยังไม่ track ต้องตัดสินใจว่าจะเอาลงไหม (3) เช็ค 'เปิดแอป 2 ครั้งแล้วตารางไม่ซ้ำ' ของ 1.3 ผมทดสอบด้วย smoke test แล้ว ส่วนใน Electron เบลยังไม่ได้ยืนยันหลังปิด-เปิดแอปใหม่ (4) ถ้าแก้ `schema.sql` ต้องลบไฟล์ `studyflow.sqlite` ใน userData ก่อน เพราะไม่มีระบบ migration (5) เบลต้องอ่านและอธิบายโค้ดได้ โดยเฉพาะ Deadline State กับ Urgency Score (6) เพื่อนต้อง `npm install` ใหม่หลัง merge (มี `better-sqlite3` เพิ่ม ต้อง Node 22+) และห้ามรัน `electron-builder install-app-deps` (7) ข้อถัดไป: ข้อ 2 Settings |
| 2026-10-06 | 2.1, 2.2 (ยังไม่ติ๊ก รอเบลยืนยันใน DevTools) | เขียนข้อ 2 แบบเรียบง่าย: `settings.service.js` (ใหม่ 2 ฟังก์ชัน `getSettings`/`setSetting`, key ที่รับมี 3 ตัวพร้อม default + ตัวเช็คค่า, เก็บ value เป็น JSON ใน table `settings`), `settings.ipc.js` ผูก `settings:get` / `settings:set { key, value }` และต่อใน `ipc/index.js` ทดสอบใน `_claude-draft` ก่อน (11 เทสใหม่ผ่าน, ของข้อ 1 ยังผ่านครบ) แล้วย้ายลง `src/` + เช็คแบบหลอก electron กับไฟล์จริง (ตั้งค่า -> ปิด -> เปิดใหม่ ค่ายังอยู่) เพิ่ม payload `settings:*` ใน `docs/ipc-contract.md` | (1) ยังไม่ commit: ทำบน branch `backend` แล้วเปิด PR (2) ชื่อ key `classroom_cutoff_date` / `reminder_window_days` และ reminder window ขั้นต่ำ 1 วัน เป็นการตัดสินของเรา spec ไม่ได้ระบุ แจ้งเพื่อนตอน PR เพราะแก้ `ipc-contract.md` (3) เทสอยู่ที่ `_claude-draft/tests/settings.test.js` (ไม่ลง `src/` และ `tests/`) (4) การบังคับตั้ง cutoff ก่อน fetch แรก (§13.1) เป็นของข้อ 6.3 ไม่ได้ทำในข้อนี้ (5) ข้อ 5 อ่าน `reminder_window_days` ผ่าน `getSettings()` ได้ตรง ๆ จาก main process (6) ข้อถัดไป: ข้อ 3 Pomodoro |
| 2026-10-07 | 0.5 (Frontend) | เขียน `router.js` แบบ hash router, เปลี่ยน `index.html` เป็นหน้าเดียว, แปลง stub 6 หน้าเป็น fragment + `mount/unmount`, ทดสอบด้วยเบราว์เซอร์จำลอง (สลับหน้า, back, route ผิด, สลับรัว ๆ) ผ่าน (เพื่อนเป็นคนเขียนแถวนี้ รวมจาก ROADMAP ฉบับของเพื่อน) | (1) ยังไม่ได้ลองใน Electron จริง: ต้องรัน `npm run dev` เช็คว่า `fetch` ไฟล์ `file://` โหลด fragment ได้ (2) ปุ่ม/ลิงก์ใน room.html และปุ่มกลับห้องในหน้าอื่นเป็นของชั่วคราวไว้ทดสอบ router (3) งานต่อ: หน้า Room ตามดีไซน์ Figma, ฟอร์ม Priority/Course (0.4) (4) ตอนนี้ working tree อยู่บน `main` ยังไม่ได้ย้ายไป branch `frontend` และไฟล์ทั้ง repo โชว์ว่าแก้เพราะ line ending (CRLF) ไม่ใช่เนื้อหา |
| 2026-10-07 | 0.5 | เบลยืนยันใช้ hash router ของเพื่อน (ไม่ใช้ multi-page แล้ว) แก้ข้อ 0.5 ให้ตรง รวมแถวบันทึกของเพื่อนเข้าไฟล์นี้ ไม่ได้ทับด้วยฉบับของเพื่อน (ฉบับเพื่อนเป็นของก่อนข้อ 1) | (1) backend ไม่ต้องแก้โค้ดอะไร (2) ตรวจ `StudyFlow-frontend.zip` ของเพื่อนแล้ว: เพื่อนแก้เฉพาะ `src/renderer/` (`index.html`, `router.js` ใหม่, `.html`/`.js` ของ 6 หน้า) โครง `pages/<name>/` (.html fragment, .css, .js) ไม่เปลี่ยน `src/shared`, `src/preload`, `widget/` เหมือนของเรา 100% ใน `README.md` มีแค่ยังไม่ได้เขียนถึง `router.js` (ไม่บังคับ) (3) ข้อ 2 (Settings) ยังไม่ติ๊ก รอเบลเช็คใน DevTools |
| 2026-10-07 | 0.4 (Frontend), Room | ทำฟอร์ม Priority/Course ที่ใช้ร่วม (`task-form.js`), หน้า Task Board แบบบาง (สร้างในโมดัล/แก้ในแผงข้าง), `api-client.js` + `dev-mock-tasks.js` (mock เฉพาะเมื่อ main ยังไม่มี handler), ย้ายไป branch `frontend`, ทำหน้า Room ตาม Figma 4 เฟรม (รูป 33 ไฟล์ใน `src/renderer/assets/room/`) ดูใน Electron จริงแล้วตรงแบบ | (1) `dev-mock-tasks.js` ลบได้หลัง Backend ทำข้อ 1.7 (`deadline_state`/`urgency_score` ในนั้นเป็นค่าประมาณ ไม่ใช่สูตร §9) (2) สมมติฐานที่ยังไม่ยืนยัน: เวลาเริ่มต้นของ due = 23:59, ป้ายในฟอร์มเป็นภาษาอังกฤษ, ช่วงเวลาเช้า/กลางวัน/เย็น/ค่ำ = 05/11/16/19 น., ปุ่ม Settings แสดงทุกช่วงเวลา (Figma เฟรมเช้าไม่มี), token สีใน `tokens.css` ยังเป็นค่าชั่วคราว (3) `window-evening.png` ขนาด 14.7 MB ควรขอไฟล์เล็กลงจากดีไซเนอร์ (4) ยังไม่ทำตัวบอกงานด่วนบนกระดาน (spec แค่อนุญาต) (5) ลบ `download-room-assets.ps1` แล้ว ห้าม commit (6) ไฟล์ใน repo โชว์ว่าแก้เพราะ line ending (CRLF) ไม่ใช่เนื้อหา (เพื่อนเป็นคนเขียนแถวนี้ รวมจาก ROADMAP ฉบับเพื่อน) |
| 2026-10-08 | 2.1, 2.2 (ติ๊กแล้ว เบลยืนยันใน DevTools) | ตรวจงานข้อ 2 ที่เขียนไว้ 2026-10-06 ซ้ำ ไม่เขียนโค้ดใหม่ (เบลเลือกใช้ของเดิม และใช้ payload `{ key, value }` เดิม): เทสใน `_claude-draft` 11/11 ผ่าน, `settings.service.js` กับ `settings.ipc.js` ใน `src/` ตรงกับ draft, smoke test หลอก electron กับไฟล์จริงใน `src/` (ใช้ไฟล์ DB จริง) ผ่าน: default -> ตั้งครบ 3 key -> payload ผิด 7 แบบ reject และไม่เขียนอะไร -> ปิด-เปิดใหม่ค่ายังอยู่ -> `tasks:list` ยังใช้ได้ รวมส่วน frontend ของเพื่อนที่ยังไม่ได้ merge เข้าไฟล์นี้ (ข้อ 0.4 ฟอร์ม Priority/Course, ความคืบหน้าแทร็กเพื่อน, แถวบันทึก Room) โดยยึดตามที่เพื่อนเขียน ส่วนอื่นของฉบับเพื่อนเป็นของก่อนข้อ 1 จึงไม่เอามาทับ | (1) เบลเช็คใน DevTools แล้วผ่านหมด: get/set, reject key ผิด/ค่าผิด/cutoff ไม่มีเวลา, ปิด-เปิดใหม่ค่ายังอยู่ (2) ยังไม่ commit ทั้งข้อ 2 (`src/main/services/settings.service.js` ใหม่, `settings.ipc.js`, `ipc/index.js`, `docs/ipc-contract.md`, `docs/ROADMAP.md`) ทำบน branch `backend` แล้วเปิด PR (3) แจ้งเพื่อนตอน PR: `ipc-contract.md` เพิ่ม `settings:*` และชื่อ key `classroom_cutoff_date` / `reminder_window_days` กับขั้นต่ำ 1 วันเป็นการตัดสินของเรา (4) ข้อ 1.7 เสร็จแล้ว เพื่อนลบ `dev-mock-tasks.js` และต่อ Task Board กับ `tasks:*` จริงได้ (ฝั่ง renderer เพื่อนทำเอง) (5) ข้อสมมติของเพื่อนเรื่องเวลาเริ่มต้นของ due = 23:59 ต้องส่งมาเป็น ISO 8601 วัน+เวลาตาม `ipc-contract.md` (6) `tests/schema.test.js` ยังไม่ track ต้องตัดสินใจว่าจะเอาลงไหม (7) ข้อถัดไป: ข้อ 3 Pomodoro |
| 2026-10-11 | spec | ขึ้นสเปก `PROJECT_v0.14.md` และ `UX-UI-Design-Review_v0.14.md` (เพิ่ม `tasks.first_started_at`, ตัด Longest Inactive Assignment เหลือ 6 metrics, ตัดคำโฆษณา Urgency Score ออกจาก §29), ลบไฟล์ v0.13 ทั้งสองไฟล์, แก้ชื่อเวอร์ชันที่ชี้ไปยังสเปกปัจจุบันใน README/ROADMAP/ipc-contract/.env.example | (1) ยังไม่แก้โค้ด: `schema.sql`, `tests/schema.test.js`, ข้อ 3.1, 4.1-4.3, migration ข้อ 7.1 (2) comment ใน `src/`, `tests/`, `supabase/`, `_claude-draft/` ยังอ้าง v0.13 (3) แก้ `schema.sql` แล้วต้องลบ `studyflow.sqlite` ใน userData (4) เพื่อนต้องรู้ว่า Dashboard เหลือ 6 metrics |
| 2026-10-11 | 1.2b | เพิ่ม `first_started_at` ใน `schema.sql` และ `tests/schema.test.js` (รายชื่อคอลัมน์ + เช็ค NULL ได้) เทส 18/18 ผ่าน, เปลี่ยน comment `PROJECT_v0.13` เป็น `PROJECT_v0.14` เฉพาะฝั่ง backend (`src/main/`, `tests/`, `supabase/` เว้นประโยคประวัติใน `schema.test.js`), ลบช่องว่างท้ายบรรทัดที่หลุดใน `task.service.js` | (1) เบลลบ `studyflow.sqlite` ใน userData เองก่อนรันแอป (2) ยังไม่ commit (3) `tests/schema.test.js` ยังไม่ track และเทสข้อ 1.5/1.6 ยังอยู่ใน `_claude-draft/tests/` ต้องตัดสินใจว่าจะย้ายลง `tests/` ไหม (4) comment ใน `src/renderer/` และ `src/shared/constants.js` ยังอ้าง v0.13 ไม่ได้แตะ (ของเพื่อน / ต้องคุยกันก่อน) ให้เพื่อนแก้เองตอนทำหน้านั้น `_claude-draft/` ก็ยังอ้าง v0.13 (ไม่ commit เลยไม่แก้) (5) ข้อถัดไป: ข้อ 3 (3.1 ต้องตั้ง `first_started_at` ครั้งแรกครั้งเดียว) |
| 2026-10-16 | 3.1-3.7 (ติ๊กแล้ว เบลยืนยันใน Electron) | เขียนข้อ 3 Pomodoro ทั้งชุด: `pomodoro.service.js` (`startBatch` ตั้ง `last_focus_started_at`/`first_started_at`/status ด้วย SQL คำสั่งเดียว, timer ทุก 1 วิคำนวณจากเวลาที่ phase จะจบ, focus→break→focus จนครบ, pause/resume/stop, บันทึก 1 แถวต่อ focus, stop/ปิดแอปกลาง focus บันทึก `completed = 0`, ส่ง event, OS notification), `pomodoro.ipc.js` (5 channel), `floating-widget.js` (หน้าต่าง always-on-top ใช้ preload ตัวเดิม), `settings.service.js` เพิ่ม `pomodoro_focus_minutes` / `pomodoro_break_minutes`, `main.js` (`before-quit` เรียก `pomodoroService.stop()` ก่อนปิด DB, ปิดหน้าต่างหลัก = ปิดแอป, `setAppUserModelId`), `docs/ipc-contract.md` เพิ่ม `pomodoro:*` ทดสอบใน `_claude-draft` ก่อน (pomodoro 35 เทสผ่าน ใช้ electron ปลอมกับ mock timer) แล้วย้ายลง `src/` + smoke test รัน `main.js` จริงกับไฟล์ DB จริง (เล่น 2 รอบ, ปิดแอปกลางรอบ 2, เปิดใหม่ข้อมูลยังอยู่, เวลาจริง 3 วิ) ไม่แตะ `src/shared` `src/preload` `src/renderer` | (1) ยังไม่ commit: ทำบน branch `backend` แล้วเปิด PR (ไฟล์ที่แก้: `src/main/services/pomodoro.service.js`, `settings.service.js`, `src/main/ipc/pomodoro.ipc.js`, `index.js`, `src/main/windows/floating-widget.js`, `src/main/main.js`, `docs/ipc-contract.md`, `docs/ROADMAP.md` ปนกับของข้อ 1.2b/คอมเมนต์ v0.14 ที่ยังไม่ commit) (2) แจ้งเพื่อนตอน PR: หน้า Settings ต้องมีช่องกรอก focus/break นาที (`settings:set`), หน้า Pomodoro เรียก `settings:get` แล้ว preview เวลารวมเอง (`session_total x focus + (session_total - 1) x break`), `start-batch` ส่งแค่ `{ task_id, session_total }` ห้ามส่ง field อื่น (reject), ปุ่ม Start ควรปิดสำหรับ task ที่ `completed`, widget เรียก `pomodoro:get-state` ตอนโหลดแล้วค่อยฟัง event, `widget.html` / `widget.js` เป็นของเพื่อนยังเป็น stub (หน้าต่าง widget ตอนนี้ว่าง) และคอมเมนต์ใน `widget.html` / `pomodoro.html` ยังอ้าง v0.13 (3) เทสอยู่ที่ `_claude-draft/tests/pomodoro.test.js` (ไม่ลง `src/` และ `tests/`) เทสเก่า `moved-*.test.js` ใน draft ล้มเพราะเป็นสำเนาเก่าที่ยังอ้างระบบ migration แบบมีเลข version (ไม่เกี่ยวกับโค้ดจริง) (4) ถ้ารัน `settings:get` จะได้ 5 key แล้ว ข้อ 5 อ่าน `reminder_window_days` ได้เหมือนเดิม (5) ข้อ 4.2 อ่าน `tasks.first_started_at`, ข้อ 6.7 เรียก `pomodoroService.getState().status !== 'idle'` เช็คว่า Pomodoro วิ่งอยู่ไหม, ข้อ 7 sync `pomodoro_sessions` (6) จำกัดที่รู้: เครื่องดับ/แอปโดน kill กลางรอบไม่มีแถวบันทึก (§15.1 accepted limitation) และ batch ไม่ถูกกู้คืนหลังเปิดแอปใหม่ (7) ข้อถัดไป: ข้อ 4 Dashboard |
