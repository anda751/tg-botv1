# Task Tracking System - Handover README

This README is intended for the next AI or engineer who continues work on this project.

It reflects the current state of the system as of 2026-05-25.

## Overview

This project is a task tracking system with:

- Backend: Strapi 5 + TypeScript
- Frontend: React + Vite + Tailwind in `miniapp/`
- Database: PostgreSQL via Supabase
- File storage for task proof images: Supabase Storage
- Notifications: Telegram
- Hosting: Railway

The system originally leaned heavily on Telegram Mini App auth, but it has now been shifted to a more standard username/password + JWT flow for normal app usage.

Telegram is now intended to be used mainly for manager notifications, not as the primary login path for daily testing.

## Current Architecture

### Backend auth model

Backend auth is handled by:

- JWT bearer token when available
- TEST_MODE fallback for easier local or test usage
- Telegram init data fallback when JWT is not used

Important middleware:

- `src/middlewares/telegram-auth.ts`

Important note:

- Most API routes are configured with `auth: false` on the Strapi route layer on purpose.
- This is not public access by design.
- The real auth check is done in `global::telegram-auth`.
- This avoids Strapi users-permissions blocking requests with 403 before custom auth runs.

## Frontend auth model

Frontend app in `miniapp/` now uses:

- `/auth/register`
- `/auth/login`
- `/profile/me`

JWT is stored in localStorage under:

- `auth-token`

Main frontend entry:

- `miniapp/src/App.tsx`

## What has already been done

### 1. Registration and login flow changed

Previous direction:

- Telegram-first registration/auth

Current direction:

- username/password login
- JWT-based session
- role-aware app routing

Implemented in:

- `src/api/user/controllers/user.ts`
- `src/api/user/routes/user.ts`
- `miniapp/src/pages/Login.tsx`
- `miniapp/src/pages/Register.tsx`
- `miniapp/src/App.tsx`

Current behavior:

- user registers with username, email, password, display name, role
- user is auto-approved immediately
- JWT is returned right after register/login
- frontend stores token and loads user profile from `/profile/me`

### 2. Telegram usage narrowed down

Current intended behavior:

- Telegram is used mainly for manager notifications
- staff users do not need Telegram linkage for normal test flow
- only manager accounts may optionally store:
  - `telegram_id`
  - `telegram_chat_id`

Register form now shows Telegram fields only when role is `manager`.

Implemented in:

- `src/api/user/controllers/user.ts`
- `miniapp/src/pages/Register.tsx`

### 3. Notification behavior updated

Current state:

- `notifyManager()` is still actively used
- `notifyStaff()` still exists, but in practice often becomes a no-op unless the target user has `telegram_chat_id`
- this is acceptable for current test flow

Guards were added so Telegram notification functions quietly return if bot token or target chat config is missing.

Implemented in:

- `src/api/task/services/task.ts`

### 4. Progress image upload bug fixed

Bug:

- submitting task proof uploaded image correctly for manager notification
- progress update did not always include the actual file buffer
- result: progress image often did not show in Telegram manager notification

Fix:

- progress flow now sends `imageBuffer`, `imageFilename`, and `imageMimeType` to `notifyManager()` just like submit flow

Implemented in:

- `src/api/task/controllers/task.ts`

### 5. Manager projects page became more resilient

Bug:

- manager projects page used `Promise.all()`
- if join-request endpoint failed, the project list also disappeared

Fix:

- switched to `Promise.allSettled()`
- project list can still render even if join request API fails

Implemented in:

- `miniapp/src/pages/manager/Projects.tsx`

### 6. Thai UI text and broken encoding cleaned up in miniapp

A large number of UI strings were previously garbled from encoding issues.

Rewritten pages include:

- `miniapp/src/pages/Login.tsx`
- `miniapp/src/pages/Register.tsx`
- `miniapp/src/pages/staff/MyTasks.tsx`
- `miniapp/src/pages/staff/CreateTask.tsx`
- `miniapp/src/pages/staff/SubmitTask.tsx`
- `miniapp/src/pages/staff/ProgressTask.tsx`
- `miniapp/src/pages/staff/PickupTask.tsx`
- `miniapp/src/pages/staff/HandoverTask.tsx`
- `miniapp/src/pages/manager/Dashboard.tsx`
- `miniapp/src/pages/manager/Projects.tsx`
- `miniapp/src/pages/manager/Staff.tsx`
- `miniapp/src/pages/manager/Reports.tsx`

### 7. Route auth wiring corrected

Issue discovered:

- changing Strapi route configs to standard authenticated routes caused 403 from Strapi permission layer
- custom middleware auth was being bypassed or blocked too early

Current intended setup:

- route config stays `auth: false`
- custom auth middleware performs real access control

Updated files:

- `src/middlewares/telegram-auth.ts`
- `src/api/user/routes/user.ts`
- `src/api/dashboard/routes/dashboard.ts`
- `src/api/task/routes/task.ts`
- `src/api/project/routes/project.ts`
- `src/api/handover-request/routes/handover-request.ts`

## Current backend feature status

### Working

- Register
- Login
- Profile fetch
- Staff task listing
- Create task
- Submit task with proof image
- Progress update with optional image
- Manager review dashboard
- Approve/reject task
- Handover
- Pickup request
- Manager project listing
- Project join request flow exists in backend

### Partially working / needs follow-up

- Staff Telegram notifications are inconsistent by design right now
- Media Library file persistence on Railway is not solved yet
- Some backend error messages are still English or older text
- Manager configuration UI beyond initial register does not exist yet

## Storage model

There are currently two different storage behaviors:

### 1. Proof images for tasks

These are uploaded to Supabase Storage.

Code:

- `src/services/supabase.ts`
- `src/api/task/controllers/task.ts`

This part is working.

### 2. Strapi Media Library uploads

These still use Strapi local upload provider by default.

Important consequence on Railway:

- files under `public/uploads` are not persistent unless a Railway Volume is mounted

Observed issue:

- Media Library may show records in DB, but actual files disappear after deploy/restart

Recommended Railway fix:

- attach a Railway Volume
- mount path should be:

```txt
/app/public/uploads
```

Reason:

- Railway service root directory is `/strpi`
- app runs from `/app`
- Strapi local uploads resolve to `/app/public/uploads`

Note:

- this does not restore already-lost files
- it only prevents future Media Library files from disappearing

## Important files

### Backend

- `src/middlewares/telegram-auth.ts`
- `src/api/user/controllers/user.ts`
- `src/api/user/routes/user.ts`
- `src/api/task/controllers/task.ts`
- `src/api/task/services/task.ts`
- `src/api/task/routes/task.ts`
- `src/api/project/controllers/project.ts`
- `src/api/project/routes/project.ts`
- `src/api/dashboard/controllers/dashboard.ts`
- `src/api/dashboard/routes/dashboard.ts`
- `src/api/handover-request/controllers/handover-request.ts`
- `src/api/handover-request/routes/handover-request.ts`
- `src/services/supabase.ts`
- `config/middlewares.ts`

### Frontend

- `../miniapp/src/App.tsx`
- `../miniapp/src/api/index.ts`
- `../miniapp/src/pages/Login.tsx`
- `../miniapp/src/pages/Register.tsx`
- `../miniapp/src/pages/manager/Dashboard.tsx`
- `../miniapp/src/pages/manager/Projects.tsx`
- `../miniapp/src/pages/staff/MyTasks.tsx`
- `../miniapp/src/pages/staff/SubmitTask.tsx`
- `../miniapp/src/pages/staff/ProgressTask.tsx`

## Known issues

### 1. Railway Media Library persistence

Still needs environment-side setup, not just code changes.

Action:

- create Railway Volume
- mount to `/app/public/uploads`

### 2. Some backend messages still need cleanup

Frontend Thai text is much better now, but backend response strings are mixed.

Action:

- normalize backend response messages
- decide whether to use Thai everywhere or English everywhere

### 3. Staff notifications strategy is not finalized

Right now the system accepts that staff may not have Telegram linkage.

Action:

- decide whether staff notifications should remain no-op
- or move them into in-app notifications later

### 4. No manager settings page yet

Manager Telegram values can be set during register only.

Action:

- add profile/settings UI for manager
- support updating Telegram fields later

## Recommended next tasks

Priority order:

1. Configure Railway Volume for `public/uploads`
2. Deploy backend after recent auth route changes
3. Verify manager can open:
   - `/projects/all`
   - `/projects/join-requests/pending`
   - `/dashboard/*`
4. Smoke test full manager/staff flow
5. Add manager settings page for Telegram fields
6. Clean backend response strings
7. Decide long-term path for Media Library:
   - keep local uploads + Railway Volume
   - or move Media Library itself to persistent object storage provider

## Smoke test checklist

Use this after deploy:

1. Register a manager account
2. Login as manager
3. Open dashboard
4. Create a project
5. Register or login as staff
6. Create a task
7. Update progress with image
8. Submit task with proof image
9. Login as manager and review task
10. Approve or reject task
11. Test handover and pickup flow
12. Upload a Media Library image
13. Redeploy Railway service
14. Confirm Media Library image still exists after Volume is attached

## Notes for the next AI

- Do not switch route configs back to normal Strapi auth unless you also redesign the custom middleware flow.
- The current system intentionally uses custom auth middleware as the main gatekeeper.
- The manager projects page issue was not only a backend issue; frontend failure handling also mattered.
- Media Library persistence on Railway is operational work, not just source code work.
- Proof image storage and Media Library storage are currently different systems.
