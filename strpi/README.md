# Task Tracking System - Current State

This README is for the next engineer or AI that picks up work in this repository.

It reflects the current state of the project as of May 27, 2026.

## Overview

This repository contains the backend for a task tracking system.

Current stack:

- Backend: Strapi 5 + TypeScript
- Frontend: React + Vite + Tailwind in `../miniapp`
- Database: PostgreSQL
- Task proof image storage: Supabase Storage
- Hosting: Railway
- Manager notifications: Telegram
- Staff notifications: in-app notifications

## Current Product Direction

The system has moved away from Telegram-first daily usage.

Current intended flow:

- Normal login uses `username/password + JWT`
- Telegram remains in the system mainly for manager-side notification use
- Staff users now rely on in-app notifications instead of Telegram

## Auth Model

Main auth middleware:

- `src/middlewares/telegram-auth.ts`

Runtime behavior:

1. If a bearer token exists, verify JWT and load the user
2. If `TEST_MODE` is enabled, allow test-user fallback
3. Otherwise, fall back to Telegram init data validation

Important design note:

- Most Strapi routes intentionally use `auth: false`
- This does **not** mean the routes are public by design
- Real access control is performed by `global::telegram-auth`
- This avoids the default Strapi users-permissions layer blocking custom auth too early

## Current Frontend App Shape

Main frontend entry:

- `../miniapp/src/App.tsx`

Frontend now supports two role-based app shells:

### Manager

- Dashboard
- Projects
- Tasks
- Staff
- KPI
- Reports
- Settings

### Staff

- My Tasks
- Create Task
- Submit Task
- Progress Task
- Handover Task
- Pickup Task
- Settings

JWT token storage:

- `localStorage['auth-token']`

## Major Changes Already Implemented

### 1. Login and registration were rebuilt

Current endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `GET /profile/me`
- `PUT /profile/me`

Current behavior:

- user registers with username, email, password, display name, role
- account is auto-approved immediately
- JWT is returned after register/login
- frontend stores token and loads `/profile/me`

Relevant files:

- `src/api/user/controllers/user.ts`
- `src/api/user/routes/user.ts`
- `../miniapp/src/pages/Login.tsx`
- `../miniapp/src/pages/Register.tsx`

### 2. Telegram was narrowed down to manager-side use

Current intended behavior:

- manager accounts may store `telegram_id` and `telegram_chat_id`
- staff accounts do not need Telegram for the normal app flow
- manager fields can be edited later in settings

Relevant files:

- `src/api/user/controllers/user.ts`
- `../miniapp/src/pages/Register.tsx`
- `../miniapp/src/pages/manager/Settings.tsx`

### 3. Staff notifications moved into the app

Current behavior:

- staff notification events are stored in the `notification` collection
- frontend shows them in the staff app
- notifications support:
  - read
  - read all
  - hide
  - hide read
  - restore
  - restore all

Relevant files:

- `src/api/notification/content-types/notification/schema.json`
- `src/api/notification/controllers/notification.ts`
- `src/api/notification/routes/notification.ts`
- `src/api/task/services/task.ts`
- `../miniapp/src/pages/staff/MyTasks.tsx`

### 4. Staff home was simplified

Current behavior:

- staff home now loads from a unified endpoint instead of many parallel requests
- the page is organized around:
  - current tasks
  - under review
  - done tasks
  - recent activity
  - hidden items
- under-review, done, and hidden sections use a single accordion state so only one opens at a time

Relevant files:

- `src/api/task/controllers/task.ts`
- `src/api/task/routes/task.ts`
- `../miniapp/src/pages/staff/MyTasks.tsx`

### 5. Manager pages were simplified to reduce heavy multi-request flows

Unified or reduced-flow endpoints now exist for:

- `GET /dashboard/home`
- `GET /dashboard/reports`
- `GET /dashboard/staff-kpi`
- `GET /projects/home`

Relevant files:

- `src/api/dashboard/controllers/dashboard.ts`
- `src/api/dashboard/routes/dashboard.ts`
- `src/api/project/controllers/project.ts`
- `src/api/project/routes/project.ts`
- `../miniapp/src/pages/manager/Dashboard.tsx`
- `../miniapp/src/pages/manager/Reports.tsx`
- `../miniapp/src/pages/manager/Kpi.tsx`
- `../miniapp/src/pages/manager/Projects.tsx`

### 6. KPI page exists for manager

Current KPI behavior:

- time window options: 14 / 30 / 60 days
- summary cards
- watch list
- formula guide
- searchable / filterable staff list
- staff list now uses accordion behavior to reduce clutter

Relevant files:

- `src/api/dashboard/controllers/dashboard.ts`
- `../miniapp/src/pages/manager/Kpi.tsx`

### 7. Profile settings now exist for both roles

Current behavior:

- manager can edit:
  - display name
  - password
  - Telegram ID
  - Telegram Chat ID
- staff can edit:
  - display name
  - password

Relevant files:

- `../miniapp/src/components/ProfileSettingsForm.tsx`
- `../miniapp/src/pages/manager/Settings.tsx`
- `../miniapp/src/pages/staff/Settings.tsx`
- `src/api/user/controllers/user.ts`

### 8. Hide / restore UX exists without deleting database records

Current behavior:

- hidden notifications stay in DB
- hidden done tasks stay in DB
- users can restore items later

Relevant fields:

- notification:
  - `is_hidden`
  - `hidden_at`
- task:
  - `is_hidden_for_owner`
  - `hidden_for_owner_at`

Relevant files:

- `src/api/notification/content-types/notification/schema.json`
- `src/api/task/content-types/task/schema.json`
- `src/api/notification/controllers/notification.ts`
- `src/api/task/controllers/task.ts`

## Current Storage Model

### 1. Task proof images

Task proof images are uploaded to Supabase Storage.

Relevant files:

- `src/services/supabase.ts`
- `src/api/task/controllers/task.ts`

This is the primary storage path used in the task flow.

### 2. Strapi Media Library

Strapi Media Library still uses local uploads unless changed at the platform level.

Current deployment note:

- Railway volume should be mounted at `/app/public/uploads`

Important note:

- proof-image storage and Media Library storage are still different systems

## Current Environment Variables

Observed runtime variables in code:

### Core app / Strapi

- `HOST`
- `ADMIN_JWT_SECRET`
- `API_TOKEN_SALT`
- `TRANSFER_TOKEN_SALT`
- `ENCRYPTION_KEY`
- `DATABASE_CLIENT`
- `DATABASE_URL`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `DATABASE_SCHEMA`
- `DATABASE_SSL_*`
- `DATABASE_FILENAME`

### Auth / behavior

- `TEST_MODE`

### Supabase

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_BUCKET`

### Telegram

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_MANAGER_CHAT_ID`
- `TELEGRAM_GROUP_CHAT_ID`

## Important Backend Files

### Auth and user

- `src/middlewares/telegram-auth.ts`
- `src/api/user/controllers/user.ts`
- `src/api/user/routes/user.ts`
- `src/extensions/users-permissions/content-types/user/schema.json`

### Task flow

- `src/api/task/controllers/task.ts`
- `src/api/task/routes/task.ts`
- `src/api/task/services/task.ts`
- `src/api/task/content-types/task/schema.json`
- `src/api/task-log/content-types/task-log/schema.json`
- `src/api/proof-image/content-types/proof-image/schema.json`

### Project flow

- `src/api/project/controllers/project.ts`
- `src/api/project/routes/project.ts`
- `src/api/project/content-types/project/schema.json`
- `src/api/project-join-request/content-types/project-join-request/schema.json`

### Handover flow

- `src/api/handover-request/controllers/handover-request.ts`
- `src/api/handover-request/routes/handover-request.ts`
- `src/api/handover-request/content-types/handover-request/schema.json`

### Notification flow

- `src/api/notification/controllers/notification.ts`
- `src/api/notification/routes/notification.ts`
- `src/api/notification/content-types/notification/schema.json`

### Manager reporting

- `src/api/dashboard/controllers/dashboard.ts`
- `src/api/dashboard/routes/dashboard.ts`

### Integrations

- `src/services/supabase.ts`
- `src/api/telegram/controllers/telegram.ts`
- `src/api/telegram/routes/telegram.ts`

## Important Frontend Files

- `../miniapp/src/App.tsx`
- `../miniapp/src/api/index.ts`
- `../miniapp/src/components/ProfileSettingsForm.tsx`
- `../miniapp/src/components/ManagerNav.tsx`
- `../miniapp/src/pages/Login.tsx`
- `../miniapp/src/pages/Register.tsx`
- `../miniapp/src/pages/staff/MyTasks.tsx`
- `../miniapp/src/pages/staff/CreateTask.tsx`
- `../miniapp/src/pages/staff/SubmitTask.tsx`
- `../miniapp/src/pages/staff/ProgressTask.tsx`
- `../miniapp/src/pages/staff/PickupTask.tsx`
- `../miniapp/src/pages/staff/Settings.tsx`
- `../miniapp/src/pages/manager/Dashboard.tsx`
- `../miniapp/src/pages/manager/Projects.tsx`
- `../miniapp/src/pages/manager/Tasks.tsx`
- `../miniapp/src/pages/manager/Staff.tsx`
- `../miniapp/src/pages/manager/Kpi.tsx`
- `../miniapp/src/pages/manager/Reports.tsx`
- `../miniapp/src/pages/manager/Settings.tsx`

## Current Known Issues / Follow-ups

### 1. Some UI/backend Thai strings still need cleanup

The system is much better than before, but a few pages or responses may still have older or garbled strings.

### 2. Strapi structure is still healthy, but some service scaffolds are mostly placeholders

Several Strapi API modules keep the default `services/` shape even when most runtime logic now sits in controllers or helper code.

This is not broken, but it should be reviewed later for cleanup.

### 3. README drift used to be a problem

This file was behind the real system state before this update. Keep it current after future architecture changes.

### 4. Media Library still depends on deployment behavior

If Railway volume or upload-provider setup changes, re-check Media Library persistence.

## Recommended Next Work

Priority order:

1. Clean remaining Thai/encoding inconsistencies in frontend and backend responses
2. Add a lightweight `SMOKE_TEST.md` or keep the checklist below updated
3. Add manager-side audit/history view for key actions
4. Add search/filter improvements for staff task browsing when task volume grows
5. Consider splitting large controllers further if manager reporting expands again

## Smoke Test Checklist

Use this after deploy:

1. Register manager
2. Login as manager
3. Open dashboard
4. Open projects
5. Open KPI and switch 14 / 30 / 60 day windows
6. Open reports
7. Register or login as staff
8. Open staff home
9. Create task
10. Update progress with image
11. Submit task with proof image
12. Confirm task appears in manager review flow
13. Reject task once and confirm staff sees:
    - returned note
    - in-app notification
14. Re-submit and approve task
15. Confirm staff sees approved notification
16. Hide and restore:
    - done task
    - notification
17. Test pickup / handover flow
18. If using Media Library, upload a file and verify persistence after redeploy

## Notes for the Next AI

- Do not switch routes back to default Strapi auth unless you redesign the custom middleware flow too
- The current app intentionally treats `global::telegram-auth` as the main gatekeeper
- Staff in-app notifications are now part of the product, not a temporary fallback
- Manager pages were simplified to reduce multi-request and heavy populate behavior
- Staff home was recently reorganized to reduce duplicated blocks and clutter
- Proof image storage and Media Library storage are still separate concerns
