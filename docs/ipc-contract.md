# IPC Contract: `tasks:*` และ `settings:*`

หน้าจอ (Frontend) ไม่แตะฐานข้อมูลตรง ต้องขอผ่าน `window.api.invoke(channel, payload)` เท่านั้น (spec §17.2)
ไฟล์นี้คือข้อตกลงว่าแต่ละ channel รับอะไร ส่งอะไรกลับ ถ้าไฟล์นี้ขัดกับ spec (`PROJECT_v0.14.md`) ให้ยึด spec

**สถานะ: ตกลงแล้ว** (เบลตัดสิน 2026-10-05) ถ้าเพื่อนอยากเปลี่ยน ให้แก้ไฟล์นี้แล้วบอกกัน
ครอบคลุม `tasks:*` และ `settings:*` (ดูท้ายไฟล์) กลุ่มอื่นจะเพิ่มเมื่อถึงข้อของมัน

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
6. **Channel ที่เป็นการตีความของเรา** เก็บไว้ทั้งหมด: `classroom:get-status`, `settings:get`, `settings:set`, `line:get-status` (`settings:*` กำหนด payload แล้ว ดูท้ายไฟล์ ที่เหลือค่อยกำหนดตอนถึงข้อของมัน)
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

## `settings:*` (ข้อ 2, เบลตัดสิน 2026-10-06)

เก็บใน table `settings` (local only ไม่ sync §19) มีแค่ 3 key ตาม spec

| channel | ส่งไป | ได้กลับ |
|---|---|---|
| `settings:get` | ไม่มี | object ครบทั้ง 3 key (key ที่ยังไม่เคยตั้ง = ค่า default) |
| `settings:set` | `{ key, value }` ทีละ key | object ครบทั้ง 3 key หลังอัปเดต |

```js
await window.api.invoke('settings:get')
// { has_seen_first_run_prompt: false, classroom_cutoff_date: null, reminder_window_days: 1 }
await window.api.invoke('settings:set', { key: 'reminder_window_days', value: 3 })
// { has_seen_first_run_prompt: false, classroom_cutoff_date: null, reminder_window_days: 3 }
```

| key | type | default | ที่มา |
|---|---|---|---|
| `has_seen_first_run_prompt` | boolean | `false` | §19, §13.1 |
| `classroom_cutoff_date` | ISO 8601 วัน+เวลา \| `null` (เช่น `2026-08-01T00:00:00.000Z`) | `null` | §13.1 |
| `reminder_window_days` | จำนวนเต็ม ≥ 1 (วัน) | `1` | §11.1 |

- key ไม่อยู่ในตารางนี้ หรือ value ผิดชนิด = reject (ชื่อ key `classroom_cutoff_date` / `reminder_window_days` เป็นชื่อที่เราตั้งเอง spec ไม่ได้ระบุ และ spec ไม่ได้กำหนดช่วงของ reminder window ขั้นต่ำ 1 เป็นการตัดสินของเรา)
- `classroom_cutoff_date` ต้องมีวัน+เวลา (ไม่รับ `2026-08-01` เฉย ๆ) เหมือน `due_date`
- การบังคับให้ตั้ง cutoff ก่อน fetch ครั้งแรก (§13.1) เป็นหน้าที่ของ `classroom:*` (ข้อ 6) ไม่ใช่ channel นี้
