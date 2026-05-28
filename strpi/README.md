# Task Tracking System - Current State

This README is for the next engineer or AI taking over this repository.

Last reviewed: May 28, 2026

## Overview

This repo contains:

- Backend: Strapi 5 + TypeScript in `strpi`
- Frontend: React + Vite + Tailwind in `miniapp`
- Database: PostgreSQL
- Hosting:
  - Backend on Railway
  - Frontend on Vercel
- File storage:
  - Task proof images in Supabase Storage
  - Strapi Media Library on local uploads with Railway volume persistence

## Product Direction

The product is no longer Telegram-first for daily work.

Current usage model:

- Login uses `username/password + JWT`
- Staff work inside the app
- Manager works inside the app and may also receive Telegram notifications
- Telegram is still part of the system, but mainly for manager-side alerts and legacy callback flows

## Auth Model

Main auth middleware:

- `src/middlewares/telegram-auth.ts`

Runtime order:

1. If a bearer token exists, verify JWT and load the user
2. If `TEST_MODE` is enabled, allow test-user fallback
3. Otherwise, validate Telegram init data

Important note:

- Many Strapi routes intentionally use `auth: false`
- Actual access control is enforced by `global::telegram-auth`
- Do not switch these routes back to default Strapi auth unless you redesign the auth flow as a whole

## Roles

### Manager

Can use:

- Dashboard
- Projects
- Tasks
- Staff
- KPI
- History
- Reports
- Settings

Can:

- Create and close projects
- Add or remove project members
- Review submitted tasks
- Reject or approve tasks
- Review pickup / handover requests
- View KPI and history logs
- Receive manager notifications in-app and through Telegram

### Staff

Can use:

- My Tasks
- Create Task
- Submit Task
- Progress Task
- Handover Task
- Pickup Task
- Settings

Can:

- Create tasks
- Update progress with proof images
- Submit tasks for review
- Handover tasks
- Request pickup of waiting tasks
- Use in-app notifications
- Hide and restore done items and notifications

## Current Frontend App Shape

Main entry:

- `../miniapp/src/App.tsx`

Important frontend behavior:

- JWT stored in `localStorage['auth-token']`
- `/logout` and `/test/logout` exist for fast logout and smoke testing
- Vercel SPA fallback is configured in `../miniapp/vercel.json`
- Login/register now support temporary query-string prefilling for browser-based smoke tests

Examples:

- `/login?identifier=anda&password=112224336a&autologin=1`
- `/register?...&autoregister=1`

## Major Implemented Changes

### 1. Login and registration rebuilt around JWT

Current endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `GET /profile/me`
- `PUT /profile/me`

Behavior:

- User registers with username, email, password, display name, and role
- Account is auto-approved immediately
- JWT is returned on register/login
- Frontend stores token and loads `/profile/me`

Relevant files:

- `src/api/user/controllers/user.ts`
- `src/api/user/routes/user.ts`
- `../miniapp/src/pages/Login.tsx`
- `../miniapp/src/pages/Register.tsx`

### 2. Telegram narrowed down to manager-side use

Behavior:

- Manager may store `telegram_id` and `telegram_chat_id`
- Staff do not need Telegram for normal work
- Manager can edit Telegram fields later in settings

Relevant files:

- `src/api/user/controllers/user.ts`
- `../miniapp/src/pages/Register.tsx`
- `../miniapp/src/pages/manager/Settings.tsx`

### 3. Staff notifications moved into the app

Behavior:

- Staff notification events are stored in the `notification` collection
- Frontend shows them in `My Tasks`
- Notifications support:
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

### 4. Staff home simplified into one main endpoint

Behavior:

- Staff home loads from `GET /tasks/home`
- Page is organized around:
  - current tasks
  - under review
  - done tasks
  - recent activity
  - hidden items
- Under-review, done, and hidden sections share one accordion state so only one stays open at a time

Relevant files:

- `src/api/task/controllers/task.ts`
- `src/api/task/routes/task.ts`
- `../miniapp/src/pages/staff/MyTasks.tsx`

### 5. Manager pages simplified to reduce heavy multi-request flows

Current unified or reduced-flow endpoints:

- `GET /dashboard/home`
- `GET /dashboard/reports`
- `GET /dashboard/staff-kpi`
- `GET /dashboard/history`
- `GET /projects/home`

Relevant files:

- `src/api/dashboard/controllers/dashboard.ts`
- `src/api/dashboard/routes/dashboard.ts`
- `src/api/project/controllers/project.ts`
- `src/api/project/routes/project.ts`

### 6. KPI page exists for manager

Behavior:

- Time window options: 14 / 30 / 60 days
- Summary cards
- Watch list
- Formula guide
- Search and filters
- Accordion per staff member to reduce clutter

Relevant files:

- `src/api/dashboard/controllers/dashboard.ts`
- `../miniapp/src/pages/manager/Kpi.tsx`

### 7. Manager action history exists

History includes:

- task approval
- task rejection
- task submission
- progress update
- pickup / handover actions
- project join request approval or rejection
- project create / close
- project member add / remove

Relevant files:

- `src/api/dashboard/controllers/dashboard.ts`
- `src/api/project/controllers/project.ts`
- `src/api/project-log/content-types/project-log/schema.json`
- `../miniapp/src/pages/manager/History.tsx`

### 8. Project page now supports drill-down workflow

Behavior:

- Manager can open one project at a time
- Tasks inside a project can be viewed:
  - grouped by status
  - grouped by owner
- Manager can search within a project and filter by member
- Clicking a task jumps to manager task review
- Returning from task review reopens the original project and highlights the selected task

Relevant files:

- `src/api/project/controllers/project.ts`
- `../miniapp/src/pages/manager/Projects.tsx`
- `../miniapp/src/pages/manager/Tasks.tsx`

### 9. Handover / pickup flow is now manager-reviewable in-app

Behavior:

- Staff can request pickup
- Manager gets:
  - Telegram alert
  - in-app dashboard alert
- Manager can approve or reject pickup requests in the app

Relevant files:

- `src/api/handover-request/controllers/handover-request.ts`
- `src/api/handover-request/routes/handover-request.ts`
- `src/api/task/services/task.ts`
- `../miniapp/src/pages/manager/Dashboard.tsx`

### 10. Profile settings exist for both roles

Manager can edit:

- display name
- password
- Telegram ID
- Telegram Chat ID

Staff can edit:

- display name
- password

Relevant files:

- `../miniapp/src/components/ProfileSettingsForm.tsx`
- `../miniapp/src/pages/manager/Settings.tsx`
- `../miniapp/src/pages/staff/Settings.tsx`
- `src/api/user/controllers/user.ts`

### 11. Hide / restore UX exists without deleting DB records

Behavior:

- Hidden notifications stay in DB
- Hidden done tasks stay in DB
- Users can restore items later

Relevant fields:

- notification:
  - `is_hidden`
  - `hidden_at`
- task:
  - `is_hidden_for_owner`
  - `hidden_for_owner_at`

## Storage Model

### Task proof images

Task proof images are uploaded to Supabase Storage.

Relevant files:

- `src/services/supabase.ts`
- `src/api/task/controllers/task.ts`

### Strapi Media Library

Strapi Media Library still uses local uploads unless an upload provider is added later.

Current deployment note:

- Railway volume should be mounted at `/app/public/uploads`

Important note:

- Proof-image storage and Media Library storage are still separate systems

## Environment Variables

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
- `src/api/project-log/content-types/project-log/schema.json`
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
- `../miniapp/src/components/ManagerNav.tsx`
- `../miniapp/src/components/ProfileSettingsForm.tsx`
- `../miniapp/src/pages/Login.tsx`
- `../miniapp/src/pages/Register.tsx`
- `../miniapp/src/pages/staff/MyTasks.tsx`
- `../miniapp/src/pages/staff/CreateTask.tsx`
- `../miniapp/src/pages/staff/SubmitTask.tsx`
- `../miniapp/src/pages/staff/ProgressTask.tsx`
- `../miniapp/src/pages/staff/HandoverTask.tsx`
- `../miniapp/src/pages/staff/PickupTask.tsx`
- `../miniapp/src/pages/staff/Settings.tsx`
- `../miniapp/src/pages/manager/Dashboard.tsx`
- `../miniapp/src/pages/manager/Projects.tsx`
- `../miniapp/src/pages/manager/Tasks.tsx`
- `../miniapp/src/pages/manager/Staff.tsx`
- `../miniapp/src/pages/manager/Kpi.tsx`
- `../miniapp/src/pages/manager/History.tsx`
- `../miniapp/src/pages/manager/Reports.tsx`
- `../miniapp/src/pages/manager/Settings.tsx`

## Current Known Issues / Follow-ups

### 1. Final UI polish is still possible

The product is functionally broad now. Remaining work is mostly refinement:

- spacing consistency
- label consistency
- micro-interactions
- final visual QA after deploy

### 2. Smoke testing still matters after deploy

Build and typecheck pass, but major deploy verification should still cover:

- manager routes
- staff routes
- task submit/progress
- notifications
- handover / pickup
- project history

### 3. Media Library still depends on deployment behavior

If Railway volume or provider setup changes, re-check Media Library persistence.

## Recommended Next Work

Priority order:

1. Run final smoke test after each deploy
2. Keep README and `SMOKE_TEST.md` aligned with the real product flow
3. Continue small UI consistency cleanup when new screens are touched
4. Revisit controller/service boundaries later if backend logic grows again

## Notes for the Next AI

- `global::telegram-auth` is still the main gatekeeper
- Staff in-app notifications are part of the product now, not a temporary fallback
- Manager pages were simplified to reduce heavy multi-request and populate behavior
- Staff home was reorganized to reduce duplicated blocks and clutter
- Project review flow now supports project → task → back to project navigation
- Visual smoke testing is easier now because login/register can be prefilled by query string
- Proof image storage and Media Library storage are still separate concerns
