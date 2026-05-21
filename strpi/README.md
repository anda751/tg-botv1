# 🤖 Telegram Task Tracking System — Project README

> ระบบบริหารจัดการงานผ่าน Telegram Mini App + Group Bot สำหรับทีมงานหน้างาน

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend / API | Strapi 5.46.0 (Node.js + TypeScript) |
| Database | PostgreSQL via Supabase |
| File Storage | Supabase Storage |
| Bot Platform | Telegram Bot API |
| Frontend | React + Tailwind CSS (Telegram Mini App) |

---

## ✅ สิ่งที่สร้างเสร็จแล้ว

### 1. Database Schema (Strapi Content Types)

| Collection | ไฟล์ Schema | หมายเหตุ |
|-----------|------------|---------|
| `project` | `src/api/project/content-types/project/schema.json` | draftAndPublish: false |
| `task` | `src/api/task/content-types/task/schema.json` | draftAndPublish: false |
| `task-log` | `src/api/task-log/content-types/task-log/schema.json` | draftAndPublish: false |
| `proof-image` | `src/api/proof-image/content-types/proof-image/schema.json` | draftAndPublish: false |
| `handover-request` | `src/api/handover-request/content-types/handover-request/schema.json` | draftAndPublish: false |
| `user` | Strapi built-in + custom fields | เพิ่ม telegram_id, display_name, role_app, is_approved, telegram_chat_id |

#### User Fields (เพิ่มเติมจาก Strapi built-in)
```
email            → built-in (มีอยู่แล้ว)
telegram_id      → Text, Unique
display_name     → Text
role_app         → Enumeration [manager, staff]
is_approved      → Boolean, default: false
telegram_chat_id → Text
```

#### Relation Map
```
User ──< Project (creator)
User >──< Project (members)
User ──< Task (current_owner)
User ──< Task (creator)
Project ──< Task
Task ──< Task Log
Task ──< Proof Image
Task ──< Handover Request
User ──< Task Log (actor)
User ──< Proof Image (submitted_by)
User ──< Handover Request (requested_by)
```

---

### 2. Task Controller
**ไฟล์:** `src/api/task/controllers/task.ts`

| Method | Endpoint | Handler | สิทธิ์ |
|--------|----------|---------|--------|
| POST | `/tasks` | `create` | Staff |
| POST | `/tasks/:id/submit` | `submit` | Staff (เจ้าของงาน) |
| POST | `/tasks/:id/approve` | `approve` | Manager |
| POST | `/tasks/:id/reject` | `reject` | Manager |

**Logic สำคัญ:**
- `create` → validate ชื่องาน (ต้องมีตัวอักษรภาษาไทย/อังกฤษ, ≥5 ตัว), set `current_owner` และ `status_task: in_progress` อัตโนมัติ, บันทึก Task Log, แจ้งกลุ่ม
- `submit` → บังคับแนบ `image_url` + `report_text` (≥5 ตัว), เปลี่ยนสถานะเป็น `under_review`, แจ้ง Manager ผ่าน DM
- `approve` → เฉพาะ Manager, เปลี่ยนสถานะเป็น `done`, ประกาศกลุ่มใหญ่
- `reject` → เฉพาะ Manager, บังคับระบุเหตุผล (≥5 ตัว), คืนสถานะเป็น `in_progress`, แจ้ง Staff ผ่าน DM (ไม่ประกาศกลุ่ม)

---

### 3. Task Routes
**ไฟล์:** `src/api/task/routes/task.ts`

```
GET  /tasks
GET  /tasks/:id
POST /tasks
POST /tasks/:id/submit
POST /tasks/:id/approve
POST /tasks/:id/reject
```

---

### 4. Task Service (Telegram Notifications)
**ไฟล์:** `src/api/task/services/task.ts`

| Function | ทำอะไร |
|----------|--------|
| `notifyGroup` | ส่งข้อความไปกลุ่ม Telegram ใหญ่ (ตัวหนังสือเท่านั้น) |
| `notifyManager` | ส่งรูปหลักฐาน + รายงาน + inline button ไปที่ Manager DM |
| `notifyStaff` | ส่ง DM ส่วนตัวหา Staff คนนั้นโดยตรง (ดึง telegram_chat_id จาก DB) |

---

### 5. Handover Controller
**ไฟล์:** `src/api/handover-request/controllers/handover-request.ts`

| Method | Endpoint | Handler | สิทธิ์ |
|--------|----------|---------|--------|
| POST | `/tasks/:id/handover` | `handover` | Staff (เจ้าของงาน) |
| POST | `/tasks/:id/pickup` | `pickup` | Staff (คนอื่น) |
| POST | `/handover-requests/:id/approve` | `approveHandover` | Manager |
| POST | `/handover-requests/:id/cancel` | `cancelHandover` | Staff (เจ้าของ request) |

**Logic สำคัญ:**
- `handover` → เปลี่ยนสถานะ task เป็น `waiting_pickup`, สร้าง Handover Request พร้อม `expires_at = now + 30 นาที`, ประกาศกลุ่ม
- `pickup` → Staff คนใหม่ขอรับงาน, เช็ค timeout, ส่งคำขอให้ Manager อนุมัติ (ยังไม่เปลี่ยน owner ทันที)
- `approveHandover` → Manager อนุมัติ, เปลี่ยน `current_owner` เป็นคนใหม่, เปลี่ยนสถานะกลับเป็น `in_progress`, แจ้ง Staff ใหม่ + ประกาศกลุ่ม
- `cancelHandover` → Staff ยกเลิกเอง, คืน task กลับ `waiting_pickup`, ประกาศกลุ่ม

---

### 6. Handover Routes
**ไฟล์:** `src/api/handover-request/routes/handover-request.ts`

```
POST /tasks/:id/handover
POST /tasks/:id/pickup
POST /handover-requests/:id/approve
POST /handover-requests/:id/cancel
```

---

### 7. Cron Jobs
**ไฟล์:** `src/index.ts` (bootstrap)

| Job | Schedule | ทำอะไร |
|-----|----------|--------|
| Handover Timeout | `*/5 * * * *` (ทุก 5 นาที) | หา Handover Request ที่ pending และ expires_at < now → เปลี่ยนเป็น timeout, คืน task เป็น waiting_pickup, แจ้ง Staff |
| Morning Summary | `0 8 * * *` (ทุกวัน 08:00) | สรุปงานตกค้างทั้งหมด (in_progress, waiting_pickup, under_review) ส่งกลุ่มใหญ่ |
| Deadline Alert | `0 * * * *` (ทุก 1 ชั่วโมง) | แจ้งโปรเจกต์ที่ deadline อีก 24 ชั่วโมง + แจ้ง Overdue |

**Timezone:** Asia/Bangkok (GMT+7)

---

## 🔧 Environment Variables

```dotenv
HOST=0.0.0.0
PORT=1337

# Strapi Secrets
APP_KEYS=...
API_TOKEN_SALT=...
ADMIN_JWT_SECRET=...
TRANSFER_TOKEN_SALT=...
ENCRYPTION_KEY=...

# Database (Supabase Pooler)
DATABASE_CLIENT=postgres
DATABASE_HOST=aws-1-ap-northeast-2.pooler.supabase.com
DATABASE_PORT=6543
DATABASE_NAME=postgres
DATABASE_USERNAME=postgres.xxxxxxxxxxxx
DATABASE_PASSWORD=
DATABASE_SSL=true

# Telegram (ยังไม่ได้ใส่ค่า — รอสร้าง Bot)
TELEGRAM_BOT_TOKEN=
TELEGRAM_GROUP_CHAT_ID=
TELEGRAM_MANAGER_CHAT_ID=
TELEGRAM_MINI_APP_URL=
```

---

## 🗂️ โครงสร้างไฟล์ที่สร้างแล้ว

```
src/
├── index.ts                          ✅ Bootstrap + Cron Jobs
└── api/
    ├── task/
    │   ├── controllers/task.ts       ✅ create, submit, approve, reject
    │   ├── services/task.ts          ✅ notifyGroup, notifyManager, notifyStaff
    │   └── routes/task.ts            ✅ custom routes
    ├── handover-request/
    │   ├── controllers/              ✅ handover, pickup, approveHandover, cancelHandover
    │   └── routes/                   ✅ custom routes
    ├── project/                      ✅ schema only
    ├── task-log/                     ✅ schema only
    └── proof-image/                  ✅ schema only

config/
├── server.ts                         ✅ cron: { enabled: true }
├── database.ts                       ✅ Supabase SSL config
└── cron-tasks.ts                     ⚠️ ไม่ได้ใช้แล้ว (ลบได้)
```

---

## 🚧 สิ่งที่ยังต้องทำต่อ

### Backend (Strapi)
- [ ] User Registration & Approval API
- [ ] Project Controller (สร้าง/ปิดโปรเจกต์, จัดการสมาชิก)
- [ ] Permissions & Middleware (ตรวจสอบ role_app, is_approved, Telegram initData)
- [ ] Dashboard API endpoints สำหรับ Manager

### Telegram Bot
- [ ] สร้าง Bot ผ่าน @BotFather
- [ ] ตั้งค่า Webhook
- [ ] เติม ENV variables ให้ครบ

### Mini App (Frontend)
- [ ] Staff view (My Tasks, สร้างงาน, ส่งงาน, Handover, Pickup)
- [ ] Manager view (Dashboard, Projects, Tasks, Staff, Reports)
- [ ] Telegram Web App SDK integration
- [ ] Responsive design (Mobile + Desktop)

---

## 📌 Task Status Flow

```
[สร้างงาน]
     ↓
 in_progress
     ↓ submit()
 under_review  ──reject()──→  in_progress
     ↓ approve()
    done

 in_progress
     ↓ handover()
 waiting_pickup
     ↓ pickup() + approveHandover()
 in_progress (owner ใหม่)
```

---

## 🔒 Data Privacy Rules

- รูปหลักฐานส่งตรงถึง Manager DM เท่านั้น ไม่โชว์ในกลุ่มใหญ่
- เหตุผลการตีกลับงานส่ง DM หา Staff เจ้าของงานเท่านั้น
- รูปภาพใน Supabase Storage ใช้ Signed URL (หมดอายุอัตโนมัติ)
- ทุก API request ต้อง verify Telegram `initData` (ยังไม่ได้ implement)
