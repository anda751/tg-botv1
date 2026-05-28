# Smoke Test Checklist

Use this after backend or frontend deploys.

## 1. Auth and routing

1. Open `/login`
2. Open `/register`
3. Login as manager
4. Logout
5. Login as staff
6. Confirm direct routes do not 404 after deploy:
   - `/history`
   - `/projects`
   - `/settings`
   - `/logout`

## 2. Manager flow

1. Open dashboard
2. Confirm dashboard summary cards load
3. Confirm in-app notifications load
4. Open projects
5. Create a project
6. Open one project and confirm:
   - grouped by status works
   - grouped by owner works
   - member filter works
   - search works
7. Click a task from a project and confirm manager task review opens
8. Return to the same project and confirm the last task is highlighted
9. Open KPI and switch between:
   - 14 days
   - 30 days
   - 60 days
10. Open reports
11. Open history and confirm filters/search work
12. Open settings and save a harmless profile edit

## 3. Staff flow

1. Open staff home
2. Confirm only one of these panels stays open at a time:
   - งานรอตรวจ
   - งานเสร็จแล้ว
   - รายการที่ซ่อนไว้
3. Confirm refresh button reloads data
4. Open settings and save a harmless profile edit

## 4. Task flow

1. Create a task
2. Update progress with image
3. Submit task with proof image
4. Confirm staff sees the task under review
5. Confirm manager sees it in review flow
6. Reject the task once
7. Confirm staff sees:
   - returned note
   - in-app notification
8. Re-submit task
9. Approve task
10. Confirm staff sees approved notification
11. Confirm task appears under done tasks

## 5. Hide / restore flow

1. Hide a done task
2. Restore that task
3. Hide a notification
4. Restore that notification
5. Use restore-all in hidden items

## 6. Handover / pickup flow

1. Send a task to handover
2. Open pickup page
3. Request pickup
4. Confirm manager sees the request in dashboard
5. Approve or reject the request in-app
6. Confirm Telegram manager alert still works if enabled

## 7. Project history flow

1. Create a project
2. Add a member
3. Remove a member
4. Close the project
5. Open manager history
6. Confirm these actions appear in history:
   - create project
   - add member
   - remove member
   - close project

## 8. Media Library / deployment

1. Upload a Media Library file if that flow matters
2. Redeploy Railway
3. Confirm the file still exists

## 9. Visual QA watch list

Watch for:

- Thai text corruption or mojibake
- duplicated sections
- panels opening at the same time when they should be exclusive
- wrong badge colors or status labels
- buttons that float over content
- route refresh causing navigation loss

## 10. Regression watch in logs

Watch logs for:

- `403` on routes that should be available after login
- `404` on task action routes
- `DeprecationWarning: Calling client.query()...`
