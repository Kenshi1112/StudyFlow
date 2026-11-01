# IPC Contract: `tasks:*`, `settings:*`, `pomodoro:*`, `dashboard:*`, `classroom:*` และ `line:*`

หน้าจอ (Frontend) ไม่แตะฐานข้อมูลตรง ต้องขอผ่าน `window.api.invoke(channel, payload)` เท่านั้น (spec §17.2)
ไฟล์นี้คือข้อตกลงว่าแต่ละ channel รับอะไร ส่งอะไรกลับ ถ้าไฟล์นี้ขัดกับ spec (`PROJECT_v0.15.md`) ให้ยึด spec

**สถานะ: ตกลงแล้ว** (เบลตัดสิน 2026-10-05) ถ้าเพื่อนอยากเปลี่ยน ให้แก้ไฟล์นี้แล้วบอกกัน
ครอบคลุม `tasks:*`, `settings:*`, `pomodoro:*`, `dashboard:*`, `classroom:*` และ `line:*` (ดูท้ายไฟล์)

## ตัวอย่างการใช้

```js
const task = await window.api.invoke('tasks:create', {
  title: 'ส่งรายงาน',
  due_date: '2026-10-10T17:00:00.000Z', // หรือไม่ส่ง / null ก็ได้
});

const tasks = await window.api.invoke('tasks:list');
await window.api.invoke('tasks:update', { id: task.id, changes: { status: 'completed' } });
await window.api.invoke('tasks:delete', { id: task.id });
```

ถ้าผิดพลาด (ส่ง field ผิด, ไม่พบ id) `invoke` จะ reject ให้ใช้ `try/catch`

## สิ่งที่ตัดสินแล้ว

1. **`due_date`** เป็นวัน+เวลา รูปแบบ ISO 8601 (หรือ `null`) "Due Today" เทียบเฉพาะส่วนวันที่ตามเวลาเครื่อง ฟอร์มสร้าง/แก้ task ต้องส่งรูปแบบนี้
2. **ลำดับ task:** `tasks:list` ไม่รับประกันลำดับ Frontend เรียงเองด้วย `urgency_score` มาก → น้อย แล้วเอา `null` (task ที่เสร็จแล้ว) ไว้ท้าย
3. **ย้อน status จาก `completed`:** main ล้าง `completed_at` เป็น `null`
4. **course และ priority (spec v0.13):** `classroom_course_name` เปลี่ยนชื่อเป็น `course_name` ใช้กับทุก source ส่วน `priority` เป็น `'low'` | `'medium'` | `'high'` | `null` (ผู้ใช้ใส่เอง `null` = ไม่ตั้ง) ทั้งสอง field ส่งตอนสร้างและแก้ได้ (ไม่บังคับ) ค่า `urgency_score` รวม priority แล้ว ฝั่งหน้าจอเรียงตามค่านี้เหมือนเดิม ไม่ต้องคิดเอง
5. **วันที่/เวลาทุก field** เป็น ISO 8601 string, `id` ให้มองเป็น string ทึบ ๆ
6. **Channel ที่เป็นการตีความของเรา** เก็บไว้ทั้งหมด: `classroom:get-status`, `settings:get`, `settings:set`, `line:get-status` (ทุกกลุ่มกำหนด payload แล้ว ดูท้ายไฟล์ สำหรับ `line:*` ทั้ง 3 channel ชื่อเป็นการตีความของเรา spec §14.2 บอกแค่ว่ามี Connect / Disconnect)
7. ไม่มี event ของ tasks ถ้า task ใหม่เข้ามาจาก sync/LINE ให้เรียก `tasks:list` ใหม่ตอนเปิดหน้า

## Channels

| channel | ส่งไป | ได้กลับ |
|---|---|---|
| `tasks:list` | ไม่มี | `Task[]` (ไม่รวมที่ลบแล้ว) |
| `tasks:get` | `{ id }` | `Task` หรือ `null` |
| `tasks:create` | `{ title, notes?, due_date?, progress_percentage?, course_name?, priority? }` | `Task` ที่สร้างแล้ว |
| `tasks:update` | `{ id, changes: { title?, notes?, status?, due_date?, progress_percentage?, course_name?, priority? } }` | `Task` ที่อัปเดตแล้ว |
| `tasks:delete` | `{ id }` | `{ id }` |

- `tasks:create`: `title` จำเป็นและห้ามว่าง ไม่ส่ง `progress_percentage` = 0 main ตั้ง `status = not_started`, `source = manual` ให้เอง
  task จาก Classroom ผ่าน `classroom:decide` และจาก LINE ผ่าน Edge Function ไม่ผ่าน channel นี้
- `tasks:update`: แก้ได้เฉพาะ 7 field ที่ตารางด้านล่างเขียนว่า "ได้" ส่ง field อื่นมา = reject ถ้าเปลี่ยนเป็น `completed` main ตั้ง `completed_at` ให้
  ผู้ใช้แก้ `status` เองได้ทุกเมื่อ (Not Started → In Progress อัตโนมัติเกิดจาก Pomodoro เท่านั้น §9.1)
- `tasks:delete`: soft delete (ตั้ง `deleted_at`) และไม่ทำให้ item Classroom เดิมถูกดึงกลับมาอีก (§13.5)

## หน้าตาของ `Task`

field ตรงกับตาราง `tasks` ใน spec §19 ทั้งหมด บวกอีก 2 ตัวที่คำนวณตอนอ่าน (ไม่เก็บใน DB และห้ามส่งกลับมา)

| field | type | แก้ผ่าน `tasks:update` |
|---|---|---|
| `id` | string | ไม่ได้ |
| `title` | string | ได้ |
| `notes` | string \| null | ได้ |
| `status` | `'not_started'` \| `'in_progress'` \| `'completed'` | ได้ |
| `due_date` | string \| null | ได้ |
| `progress_percentage` | number (0–100, กรอกเอง) | ได้ |
| `priority` | `'low'` \| `'medium'` \| `'high'` \| `null` | ได้ |
| `source` | `'manual'` \| `'google_classroom'` \| `'line'` | ไม่ได้ |
| `classroom_assignment_id` | string \| null | ไม่ได้ |
| `course_name` | string \| null | ได้ |
| `classroom_last_updated` | string \| null | ไม่ได้ |
| `completed_at` | string \| null | ไม่ได้ (main ตั้งเอง) |
| `deleted_at` | string \| null | ไม่ได้ |
| `first_started_at` | string \| null | ไม่ได้ (Pomodoro ตั้งครั้งแรกครั้งเดียว ไม่เขียนทับ, v0.14) |
| `last_focus_started_at` | string \| null | ไม่ได้ (Pomodoro ตั้ง) |
| `created_at` | string | ไม่ได้ |
| `updated_at` | string | ไม่ได้ (ใช้กับ sync เท่านั้น ห้ามใช้เป็นสัญญาณ activity §19) |
| `deadline_state` | `'no_deadline'` \| `'upcoming'` \| `'due_today'` \| `'overdue'` \| `'completed'` | คำนวณ §9.2 |
| `urgency_score` | number \| `null` | คำนวณ §9.5 (รวม priority) เป็น `null` เมื่อ `status = completed` |

ค่า enum ใช้จาก `src/shared/constants.js`

หมายเหตุ: ค่า `priority` ใช้จาก `TASK_PRIORITY` ใน `src/shared/constants.js` (`LOW`, `MEDIUM`, `HIGH`)

---

## `settings:*` (ข้อ 2, เบลตัดสิน 2026-10-06, ข้อ 3 เพิ่ม 2 key, ข้อ 6 เพิ่ม 1 key, v0.16 แทน `reminder_window_days` ด้วย 2 key)

เก็บใน table `settings` (local only ไม่ sync §19) มี 7 key (`reminder_days` / `reminder_upcoming_enabled` เป็นของ spec v0.16 §11.4, §19, 2 key Pomodoro เพิ่มในข้อ 3, `classroom_last_synced_at` เพิ่มในข้อ 6)

| channel | ส่งไป | ได้กลับ |
|---|---|---|
| `settings:get` | ไม่มี | object ครบทั้ง 7 key (key ที่ยังไม่เคยตั้ง = ค่า default) |
| `settings:set` | `{ key, value }` ทีละ key | object ครบทั้ง 7 key หลังอัปเดต |

```js
await window.api.invoke('settings:get')
// { has_seen_first_run_prompt: false, classroom_cutoff_date: null, classroom_last_synced_at: null,
//   reminder_days: [1], reminder_upcoming_enabled: true, pomodoro_focus_minutes: 25, pomodoro_break_minutes: 5 }
await window.api.invoke('settings:set', { key: 'reminder_days', value: [1, 7, 3] })   // ส่งลำดับไหนก็ได้
// { ..., reminder_days: [7, 3, 1], reminder_upcoming_enabled: true, ... }            // main เก็บและคืนเรียงมากไปน้อย
await window.api.invoke('settings:set', { key: 'reminder_upcoming_enabled', value: false })
// { ..., reminder_days: [7, 3, 1], reminder_upcoming_enabled: false, ... }           // ปิด toggle: ค่าที่ติ๊กยังอยู่
```

| key | type | default | ที่มา |
|---|---|---|---|
| `has_seen_first_run_prompt` | boolean | `false` | §19, §13.1 |
| `classroom_cutoff_date` | ISO 8601 วัน+เวลา \| `null` (เช่น `2026-08-01T00:00:00.000Z`) | `null` | §13.1 |
| `classroom_last_synced_at` | ISO 8601 วัน+เวลา \| `null` | `null` | §13.1 (ข้อ 6 ตั้งให้เองทุกครั้งที่ sync สำเร็จ หน้า Settings แค่แสดง ไม่ต้องตั้งเอง) |
| `reminder_days` | array ของ `7` / `3` / `2` / `1` ไม่ว่าง ไม่ซ้ำ (เช่น `[7, 3, 1]`) | `[1]` | §11.4, §19 (v0.16 แทน `reminder_window_days`) |
| `reminder_upcoming_enabled` | boolean | `true` | §11.1, §11.4, §19 (toggle "Remind me about upcoming deadlines" แยกจาก `reminder_days`) |
| `pomodoro_focus_minutes` | จำนวนเต็ม ≥ 1 (นาที) | `25` | §15.3 (ชื่อ key และค่า default เป็นการตัดสินของเรา spec ไม่ได้ระบุ) |
| `pomodoro_break_minutes` | จำนวนเต็ม ≥ 1 (นาที) | `5` | §15.3 (เหมือนด้านบน) |

- key ไม่อยู่ในตารางนี้ หรือ value ผิดชนิด = reject (ชื่อ key `classroom_cutoff_date` / `reminder_days` / `reminder_upcoming_enabled` เป็นชื่อที่เราตั้งเอง spec ไม่ได้ระบุชื่อ key)
- **`reminder_window_days` เลิกใช้แล้ว** `settings:set` ด้วย key นี้จะ reject (`Unknown setting`) ค่าเก่าที่ค้างในไฟล์ SQLite ไม่ถูกอ่าน และไม่แปลงค่าให้
- **`reminder_days` (สำหรับหน้า Settings)**
  - เป็น checkbox 4 ช่อง (7 / 3 / 2 / 1 วัน) ส่งทั้ง array ทุกครั้งที่ติ๊ก/เอาออก เช่น ติ๊ก 1 กับ 7 -> `value: [7, 1]`
  - ห้ามส่ง `[]` (reject) ตาม §11.4 ต้องติ๊กอย่างน้อย 1 ช่อง ขณะ toggle เปิดอยู่ให้ disable ช่องสุดท้ายที่ติ๊กไว้ (UX §5)
  - ปิด toggle ให้ส่ง `reminder_upcoming_enabled: false` อย่างเดียว **ห้ามล้าง `reminder_days`** (spec ให้เก็บค่าที่ติ๊กไว้) ช่อง checkbox แสดงเป็นสีจาง
  - ข้อความ helper ใต้แถว: "You get one reminder for each box you tick." และเมื่อผูก LINE: "Also sent to LINE"
- **LINE ตามค่านี้ (§14.4) โดยฝั่ง Backend ทำเอง** หลัง `settings:set` ของ 2 key นี้สำเร็จ main เขียนค่าไป Supabase ทางเดียว (ไม่รอผล ออฟไลน์ก็ไม่ทำให้บันทึกพัง) หน้าจอไม่ต้องเรียกอะไรเพิ่ม และไม่ต้องรอผลของการเขียน
- ข้อความแจ้งเตือน (OS notification) ที่ main สร้างเอง: Upcoming `อีก N วันถึงกำหนด: ชื่องาน` / รอบเดียวเกิน 3 อัน `มี N งานใกล้ถึงกำหนด` / Due Today `ถึงกำหนดวันนี้: ...` / Overdue `เลยกำหนดแล้ว: ...` (หน้าจอไม่ต้องทำ)
- `classroom_cutoff_date` ต้องมีวัน+เวลา (ไม่รับ `2026-08-01` เฉย ๆ) เหมือน `due_date`
- การบังคับให้ตั้ง cutoff ก่อน fetch ครั้งแรก (§13.1) เป็นหน้าที่ของ `classroom:*` (ข้อ 6) ไม่ใช่ channel นี้

## `pomodoro:*` (ข้อ 3, เบลตัดสิน 2026-10-16)

เริ่มจาก task เท่านั้น (§15) ทีละ batch เท่านั้น timer อยู่ใน main process หน้าจอแค่สั่งและแสดงผล

| channel | ส่งไป | ได้กลับ |
|---|---|---|
| `pomodoro:start-batch` | `{ task_id, session_total }` | `State` |
| `pomodoro:pause` | ไม่มี | `State` |
| `pomodoro:resume` | ไม่มี | `State` |
| `pomodoro:stop` | ไม่มี | `State` (idle) |
| `pomodoro:get-state` | ไม่มี | `State` |
| `pomodoro:show-widget` | ไม่มี | `State` |
| event `pomodoro:state-changed` | - | `State` |

```js
// State
{ status: 'idle' | 'running' | 'paused',
  phase: 'focus' | 'break' | null,
  task_id, batch_id, session_index, session_total,   // 1-based; idle = null ทั้งหมด
  phase_total_seconds, remaining_seconds }           // idle = null ทั้งคู่
```

- **ความยาว focus/break ไม่อยู่ใน payload:** main อ่านจาก `settings` (`pomodoro_focus_minutes` / `pomodoro_break_minutes`, default 25/5) ตอนกด Start ถ้าแก้ settings ระหว่างวิ่ง batch นั้นไม่เปลี่ยนตาม หน้า Pomodoro ที่ต้อง preview เวลารวมให้เรียก `settings:get` เอง
  เวลารวมของ batch = `session_total x focus + (session_total - 1) x break` (ไม่มี break หลังรอบสุดท้าย) เช่น 2 รอบ 25/5 = 55 นาที
- **`start-batch`:** `session_total` เป็นจำนวนเต็ม ≥ 1 ส่ง field อื่นมา = reject และ reject เมื่อ task ไม่พบ/ถูกลบ, task เป็น `completed` (ต้องเปลี่ยน status เป็น In Progress ก่อน), หรือมี batch วิ่งอยู่แล้ว
  ผลต่อ task (§15.3): `last_focus_started_at` = ตอนนี้ทุกครั้ง, `not_started` เป็น `in_progress` และตั้ง `first_started_at` เฉพาะ batch แรก (ตอนที่ `first_started_at` ยังเป็น null) ไม่เขียนทับ
  main เปิด floating widget ให้เอง
- **`pause` / `resume`:** กดซ้ำไม่เป็นไร (คืน state เดิม) ไม่มี batch = reject
- **`stop`:** ไม่มี batch ก็ไม่ reject (คืน idle) ถ้าอยู่ใน focus จะบันทึกเวลาที่ผ่านไปเป็น `completed = 0` (ผ่านไป 0 วินาทีไม่บันทึก) อยู่ใน break ไม่บันทึกอะไรเพิ่ม
- **event `pomodoro:state-changed`:** ส่งทุก 1 วินาทีระหว่าง `running` และทุกครั้งที่เปลี่ยน (start/pause/resume/เปลี่ยน phase/จบ) ให้ทุกหน้าต่าง ตอนจบ/หยุดส่ง state `idle` widget ที่เพิ่งเปิดให้เรียก `pomodoro:get-state` ตอนโหลดก่อน แล้วค่อย subscribe event
- **ปิดแอปกลาง Pomodoro:** บันทึกเหมือน `stop` (§15.1) ปิดหน้าต่างหลัก = ปิดทั้งแอป
- **`show-widget` (เพิ่ม 2026-11-01, Frontend ทำทั้งสองฝั่ง เบลตรวจตอน PR):** เปิด floating widget กลับมาหลังผู้ใช้กดปิด ถ้า widget เปิดอยู่แล้วแค่ดึงขึ้นมาข้างหน้า reject เมื่อไม่มี batch วิ่งอยู่ (state `idle`) ไม่กระทบ timer
- **OS notification:** ส่งตอนเปลี่ยน phase และตอนจบ batch ("ถึงเวลาพักแล้ว", "ถึงเวลาทำงานแล้ว", "ครบทุกรอบแล้ว") ไม่ส่งตอนกด Start

## `dashboard:*` (ข้อ 4, เบลตัดสิน 2026-10-16)

คำนวณฝั่ง main จากตาราง `tasks` (ไม่รวมที่ลบแล้ว) ตาม spec §10 หน้าจอแค่เลือกช่วงเวลาแล้วแสดงผล

| channel | ส่งไป | ได้กลับ |
|---|---|---|
| `dashboard:get-metrics` | `{ range }` (`'this_week'` \| `'this_month'` \| `'all_time'` ค่าเดียวกับ `DASHBOARD_RANGE`) | `Metrics` |

```js
// Metrics
{ range,
  total_assignments, completed_assignments, remaining_assignments,   // จำนวนเต็ม
  overdue_assignments,                                               // จำนวนเต็ม ไม่ขึ้นกับ range
  percent_completed_before_deadline,                                 // 0-100 ทศนิยม 1 ตำแหน่ง หรือ null
  average_time_to_start_lag }                                        // เปอร์เซ็นต์ ทศนิยม 1 ตำแหน่ง (เกิน 100 ได้) หรือ null
```

- **`range`:** ไม่ส่ง / ค่านอก 3 ค่า / ไม่ใช่ string = reject (ไม่ default) สัปดาห์เริ่มวันจันทร์ ช่วงเป็น `[เริ่ม, จบ)` ตามเวลาเครื่อง (This Week = จ. 00:00 ถึงจ.ถัดไป 00:00, This Month = วันที่ 1 ถึงวันที่ 1 เดือนถัดไป)
- **`null`:** `percent_completed_before_deadline` เป็น `null` เมื่อไม่มี task ที่ completed และ due อยู่ในช่วง, `average_time_to_start_lag` เป็น `null` เมื่อไม่มี task ที่เข้าเงื่อนไข §10.3 ให้หน้าจอแสดง empty state (ไม่ใช่ 0)
- **ตัวนับ:** Total/Remaining นับตาม `due_date` (task ไม่มี due นับเฉพาะ `all_time`), Completed นับตาม `completed_at`, Overdue เป็น real-time จึงอาจไม่เท่ากับ Total - Completed - Remaining ตาม spec
- **ไม่มี field จำนวน task ที่ใช้คำนวณ Lag** (spec ไม่ได้ขอ) ถ้าหน้าจอต้องแยกกรณีข้อมูลน้อย ให้คุยกันแล้วเพิ่มทีหลัง

---

## `classroom:*` (ข้อ 6, เบลตัดสิน 2026-10-29)

login Google กับ token อยู่ฝั่ง main ทั้งหมด หน้าจอไม่เห็น token (§20) token เก็บเป็นไฟล์เข้ารหัสด้วย `safeStorage` ใน userData ไม่อยู่ใน SQLite ต้องมี `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` ใน `.env`

| channel | ส่งไป | ได้กลับ |
|---|---|---|
| `classroom:get-status` | ไม่มี | `Status` |
| `classroom:connect` | ไม่มี | `Status` (เปิดเบราว์เซอร์ให้ login แล้วรอจนจบ ไม่เกิน 3 นาที) |
| `classroom:disconnect` | ไม่มี | `Status` |
| `classroom:sync-now` | ไม่มี | `{ new_items, pending }` |
| `classroom:get-pending` | ไม่มี | `[{ id, title, course_name, due_date }]` |
| `classroom:decide` | `{ id, decision }` (`'import'` \| `'ignore'`) | `{ id, decision }` |
| event `classroom:pending-changed` | - | `{ pending_count }` |

```js
// Status
{ connected: true, account_email: 'student@gmail.com',
  last_synced_at: '2026-10-29T09:30:00.000Z',   // null = ยังไม่เคย sync
  cutoff_date: '2026-08-01T00:00:00.000Z' }     // null = ยังไม่ตั้ง (ตั้งผ่าน settings:set classroom_cutoff_date)
await window.api.invoke('classroom:get-pending')
// [{ id: '1111:9001', title: 'Lab 3', course_name: 'Calculus 101', due_date: '2026-11-02T16:59:00.000Z' }]
await window.api.invoke('classroom:decide', { id: '1111:9001', decision: 'import' })
// { id: '1111:9001', decision: 'import' }   -> หน้าจอเรียก tasks:list ใหม่เพื่อเห็น task ที่เพิ่งสร้าง
```

- **cutoff (§13.1):** `connect` ไม่บังคับตั้ง cutoff แต่ `sync-now` จะ reject ("ตั้งวัน cutoff ก่อน") จนกว่าจะตั้ง ส่วน fetch ตอนเปิดแอปจะข้ามเงียบ ๆ
- **connect / disconnect:** เชื่อมอยู่แล้วเรียก `connect` ซ้ำ = คืน status เดิม ไม่เปิดเบราว์เซอร์ (รองรับบัญชีเดียว) ผู้ใช้กดไม่อนุญาต / ติ๊กสิทธิ์ไม่ครบ / ไม่ login ใน 3 นาที = reject `disconnect` ลบ token กับล้าง cutoff (`cutoff_date` กลับเป็น `null` ตอน connect ใหม่จึงต้องเลือกวันอีกรอบ) ไม่ลบ task ที่ import แล้ว และไม่ล้างรายการที่เคย import/ignore (§13.4)
- **`sync-now`:** reject ถ้ายังไม่เชื่อมบัญชี / ยังไม่ตั้ง cutoff / ต่อ Google ไม่ได้ ถ้า token หมดอายุ (`invalid_grant`) จะลบ token และ reject พร้อมข้อความให้ Connect ใหม่ (consent screen ที่ยังเป็น Testing ทำให้ token อายุ 7 วัน) `new_items` = จำนวนที่เพิ่งเจอรอบนี้ `pending` = ที่รอตัดสินใจทั้งหมด ถ้า `new_items` เป็น 0 หน้าจอเป็นคนตัดสินว่าจะแสดง toast (§13.5) เอง
- **`id`:** รูป `courseId:courseWorkId` เช่น `1111:9001` (§19)
- **`get-pending`:** อ่านจาก DB (ไม่ยิง Google) ใช้ออฟไลน์ได้ เรียงตาม `due_date` งานไม่มี due ไว้ท้าย ยังไม่เชื่อมบัญชี = `[]`
- **`decide`:** payload ต้องมีแค่ `id` กับ `decision` และ `id` ต้องเป็นรายการ `pending` ไม่งั้น reject ทั้งสองแบบถาวร (§13.5)
  `ignore` ไม่ยิง Google ทำตอนออฟไลน์ได้ `import` ต้องออนไลน์ เพราะถามสถานะการส่งงานจาก Google ตอนนั้น (`TURNED_IN` / `RETURNED` = `completed` ที่เหลือ = `not_started` §9.1) ถ้าไม่สำเร็จ (ออฟไลน์ / งานถูกลบ) = reject และรายการยังเป็น `pending`
  task ที่สร้าง: `source = 'google_classroom'`, `title` / `due_date` / `course_name` / `notes` ตามที่เก็บไว้, `classroom_last_updated` = `updateTime` ตอน fetch, `priority` = `null` ถ้า import เป็น `completed` จะตั้ง `progress_percentage = 100` และ `completed_at` = เวลาที่กด import
- **`notes` ของ task ที่ import:** `<คำอธิบายงาน>` เว้นบรรทัด `ลิงก์งานใน Classroom:` ขึ้นบรรทัดใหม่แล้วตามด้วย URL ไม่มีคำอธิบายจะเหลือแค่ส่วนลิงก์ เป็นข้อความธรรมดา ต้องให้หน้าจอทำเองถ้าต้องการให้กดได้
- **`due_date`:** แปลงจาก UTC ของ Classroom เป็น ISO เช่น 2 พ.ย. 16:59 UTC = `2026-11-02T16:59:00.000Z` มีวันแต่ไม่มีเวลา = 23:59 เวลาเครื่อง ไม่มีวัน = `null`
- **event `classroom:pending-changed`:** ส่งให้ทุกหน้าต่างเฉพาะตอน fetch เจอรายการใหม่ (ทั้งตอนเปิดแอปและ Sync now) ไม่ส่งหลัง `decide` main ไม่เปิด popup เอง หน้าจอเป็นคนตัดสินว่าจะเด้ง popup หรือแสดงตัวบอกเงียบ ๆ ถ้ากำลังจับเวลา Pomodoro (§13.5 Interruption-safe) โดยเรียก `pomodoro:get-state` เช็คเอง (หน้าจอต้องเช็คตอนเข้า Task Board ด้วย เพราะตอนนั้นไม่มี event)

## Cloud sync (ข้อ 7, เบลตัดสิน 2026-10-31)

**ไม่มี channel และ event ใหม่** sync ทำงานเบื้องหลังใน main process (`cloud-sync.service.js`) หน้าจอไม่ต้องทำอะไร

- เริ่มเองตอนเปิดแอป: sync ทันที 1 รอบ แล้วทุก 5 นาที และ 10 วินาทีหลังมีการแก้ `tasks` / `pomodoro_sessions` ในเครื่อง
- sync เฉพาะตอนเชื่อม Google แล้ว (`classroom:connect`) เพราะใช้บัญชีเดียวกัน login Supabase (§20) ยังไม่เชื่อม = ไม่ sync ไม่มีข้อความแจ้ง
- ข้อมูลจากเครื่องอื่นหรือ LINE ลงมาเองโดยไม่มี event หน้าจอเรียก `tasks:list` ใหม่ตอนเปิดหน้า (ข้อ 7 ใน "สิ่งที่ตัดสินแล้ว") หน้าที่เปิดค้างอยู่จะเห็นข้อมูลใหม่เมื่อเปิดหน้านั้นอีกครั้ง
- `Task.updated_at` หลัง sync จะเป็นเวลาของ server (ตัดเหลือมิลลิวินาที) ยังห้ามใช้เป็นสัญญาณ activity ตามเดิม
- ถ้าเครื่องสองเครื่องแก้ task เดียวกัน เครื่องที่ส่งถึง server ทีหลังชนะทั้งแถว (§18.2) ไม่ merge ทีละ field
- sync ไม่สำเร็จ (ออฟไลน์, token Google หมดอายุ) = แค่ log ในหน้าต่าง main แล้วลองใหม่รอบถัดไป หน้าจอไม่ได้รับแจ้ง

## `line:*` (ข้อ 8.5, เบลตัดสิน 2026-10-31)

ฝั่งแอปของ §14.2: ขอโค้ดผูก LINE / ดูว่าผูกแล้วไหม / ยกเลิกการผูก ทำใน main (`cloud-sync.service.js`) ผ่าน Supabase ในนามผู้ใช้ที่ login (RLS) ไม่ใช้ `service_role`
การผูกจริงทำโดย Edge Function `line-webhook` ตอนผู้ใช้ส่งโค้ดมาใน LINE หน้าจอไม่ต้องทำอะไรในขั้นนั้น

| channel | ส่งไป | ได้กลับ |
|---|---|---|
| `line:generate-code` | ไม่มี | `{ code, expires_at }` |
| `line:get-status` | ไม่มี | `{ connected, linked_at }` |
| `line:disconnect` | ไม่มี | `{ connected: false, linked_at: null }` |

```js
await window.api.invoke('line:generate-code')
// { code: '042917', expires_at: '2026-10-31T09:10:00.456Z' }   -> หน้าจอโชว์โค้ดให้ผู้ใช้พิมพ์ส่งใน LINE OA
await window.api.invoke('line:get-status')
// { connected: false, linked_at: null }   ยังไม่ผูก
// { connected: true, linked_at: '2026-10-31T09:05:00.000Z' }   ผูกแล้ว
await window.api.invoke('line:disconnect')
// { connected: false, linked_at: null }
```

- **ทั้ง 3 channel ไม่รับ payload** (ส่งมาก็ถูกเมิน) ชื่อ channel อยู่ใน `IPC.LINE` ของ `src/shared/ipc-channels.js` อยู่แล้ว
- **ต้องเชื่อม Google ก่อน:** Supabase login ใช้บัญชี Google เดียวกัน (§20) ยังไม่เชื่อม = `generate-code` / `disconnect` reject ("ต้องเชื่อม Google ก่อน") ส่วน `get-status` ตอบ `connected: false` ไม่ reject หน้าจอเช็ค `classroom:get-status.connected` เพื่อปิดปุ่มหรือขึ้นข้อความเองได้
- **`generate-code`:** โค้ดเลข 6 หลักสุ่มใหม่ทุกครั้ง (มีเลขศูนย์นำหน้าได้ เช่น `'000042'`) อายุ 10 นาทีนับจาก `expires_at` ที่ server ตั้ง (หน้าจอใช้ค่านี้ ไม่คิดจากนาฬิกาเครื่อง) กดซ้ำได้ โค้ดเก่าที่ยังไม่หมดอายุใช้ได้ต่อ ผูกสำเร็จแล้วโค้ดทั้งหมดของผู้ใช้ถูกลบ ชนกับโค้ดที่มีอยู่ลองใหม่เองไม่เกิน 3 ครั้ง ถ้ายังชนอยู่ = reject
- **ไม่มี event:** หน้าจอรู้ว่าผูกสำเร็จโดย poll `line:get-status` (เช่นทุก 3 วินาที ระหว่างโชว์โค้ด ไม่เกิน 10 นาที) การ "รอโค้ด" (โค้ด + เวลาหมดอายุ) หน้าจอเก็บเอง `get-status` ไม่ส่งโค้ดที่ค้างกลับ และไม่ส่ง `line_user_id`
- **`disconnect`:** ลบแถวของตัวเองใน `line_account_links` ไม่ลบ task ที่เคยสร้างผ่าน LINE (§14.5) กดซ้ำ / ยังไม่ได้ผูก = ไม่ error
- **ออฟไลน์ / Supabase ล่ม:** reject พร้อมข้อความ error (เหมือน `classroom:*`) ไม่ retry เอง
- **ข้อจำกัดที่รู้:** ถ้าผู้ใช้ Disconnect Google ทั้งที่ผูก LINE ไว้ แอปจะมองไม่เห็นลิงก์ LINE เดิม (ลิงก์ยังอยู่บน cloud) ต้องเชื่อม Google ใหม่ก่อนถึงจะ Disconnect LINE ได้ และตาม §20 หนึ่งบัญชีต่อเครื่อง
