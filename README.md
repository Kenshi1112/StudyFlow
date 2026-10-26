# StudyFlow

แอป Windows desktop สำหรับจัดการงานและความคืบหน้าของนักศึกษา (โปรเจกต์จบ ป.ตรี)
Electron + HTML/CSS/JS ล้วน (ไม่ใช้ framework) + SQLite (local) + Supabase (cloud backup และ Edge Functions)

Single Source of Truth ของโปรเจกต์คือ `PROJECT_v0.14.md` (ให้วางไว้ใน `docs/`) ห้ามเพิ่ม field หรือ requirement ที่ไม่มีใน spec

## วิธีรัน

```bash
npm install
npm start        # เปิดแอป
npm run dev      # เปิดแอปพร้อม DevTools
npm run build    # build installer สำหรับ Windows
```

คัดลอก `.env.example` เป็น `.env` แล้วใส่ค่าจริง (ห้าม commit `.env`)

## โครงสร้าง

```
.
├── src/
│   ├── main/                  # Backend: Electron main process
│   │   ├── main.js            # entry point เปิดหน้าต่างหลัก
│   │   ├── db/                # database.js, schema.sql, migrations/
│   │   ├── services/          # task, classroom-sync, pomodoro, dashboard, notification, cloud-sync
│   │   ├── ipc/               # handler ต่อ feature (ลงทะเบียนผ่าน ipc/index.js)
│   │   └── windows/           # floating-widget.js (หน้าต่างที่ 2 ของ Pomodoro)
│   ├── preload/               # Shared: สะพานระหว่าง renderer กับ main
│   │   └── preload.js
│   ├── renderer/              # Frontend: UI ทั้งหมด
│   │   ├── index.html
│   │   ├── pages/             # room, task-board, dashboard, pomodoro, calendar, settings (โฟลเดอร์ละ .html .css .js)
│   │   ├── components/        # ส่วน UI ที่ใช้ซ้ำ
│   │   ├── styles/            # tokens.css, global.css
│   │   ├── assets/            # รูป/ฟอนต์/ไอคอน
│   │   └── widget/            # หน้าตา floating widget
│   └── shared/                # Shared: สัญญาระหว่างสองฝั่ง
│       ├── ipc-channels.js    # รายชื่อ IPC channel
│       └── constants.js       # ค่า enum ตาม spec
├── supabase/                  # Backend
│   ├── migrations/            # SQL ของ Postgres บน Supabase
│   └── functions/
│       ├── line-webhook/      # ผูกบัญชี LINE + flow สร้าง task
│       └── notify-check/      # push แจ้งเตือน deadline (pg_cron)
├── tests/
└── docs/                      # วาง PROJECT_v0.14.md และเอกสารอื่นที่นี่
```

ทุกไฟล์ (ยกเว้น `package.json`, `.prettierrc`, `README.md`, `.gitkeep`) มี comment หัวไฟล์ 3 บรรทัด: Owner, หน้าที่, TODO

## ใครเป็นเจ้าของโฟลเดอร์ไหน

| โฟลเดอร์ | เจ้าของ | แก้ได้อย่างไร |
|---|---|---|
| `src/main/` | Backend | Backend แก้ได้เลย |
| `supabase/` | Backend | Backend แก้ได้เลย |
| `src/renderer/` | Frontend | Frontend แก้ได้เลย |
| `src/preload/` | Shared | ต้องคุยกันก่อนแก้ |
| `src/shared/` | Shared | ต้องคุยกันก่อนแก้ |
| `tests/`, `docs/` | ตามเนื้อหา | ใครเขียนก็ใส่ได้ แต่ test ของโค้ดฝั่งไหนให้เจ้าของฝั่งนั้นรีวิว |

## กฎสำคัญ

1. **renderer ห้ามเข้า DB ตรง** ทุกการอ่าน/เขียนข้อมูลต้องผ่าน IPC เท่านั้น: `renderer` -> `window.api.invoke(channel)` -> `preload` -> `ipc/*.ipc.js` -> `services/*` -> `db/database.js` เฉพาะ main process เท่านั้นที่แตะ SQLite (PROJECT_v0.14 section 17.2)
2. **renderer ไม่ใช้ `require` / Node API** เปิดแค่ `contextIsolation: true`, `nodeIntegration: false` เรียกของฝั่ง main ผ่าน `window.api` ที่ preload เปิดให้เท่านั้น
3. **เพิ่ม/เปลี่ยน IPC channel ต้องคุยกันก่อน** ขั้นตอน: (1) ตกลง channel และ payload (2) เพิ่มใน `src/shared/ipc-channels.js` (3) Backend ผูก handler ใน `src/main/ipc/` และ Frontend เรียกผ่าน `window.api.invoke` preload จะอนุญาตเฉพาะ channel ที่อยู่ในไฟล์นั้น
4. **ห้ามเพิ่ม field/feature/requirement ที่ไม่มีใน `PROJECT_v0.14.md`** ถ้าจำเป็นต้องเพิ่ม ให้แก้ spec ก่อน
5. **Secrets ห้าม commit** LINE Channel Access Token และ Channel Secret ตั้งเป็น Supabase Edge Function secrets ไม่เก็บในแอปหรือใน `.env` ของแอป (spec section 18.2, 20)

## หมายเหตุ

- `src/main/main.js` ตั้ง `sandbox: false` เพราะ `preload.js` ต้อง `require('../shared/ipc-channels')` ส่วน renderer ยังถูกแยกด้วย `contextIsolation`
- หน้า Pomodoro ใน `pages/pomodoro/` ต้องเข้าจาก task เท่านั้น ไม่มี session แบบไม่ผูก task (spec section 15)
- `.gitkeep` ใช้ให้ git เก็บโฟลเดอร์ที่ยังว่างอยู่ ลบได้เมื่อมีไฟล์จริงอยู่ข้างใน
