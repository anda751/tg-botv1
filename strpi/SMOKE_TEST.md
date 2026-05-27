# Smoke Test Checklist

Use this after backend or frontend deploys.

## Auth

1. Register a manager
2. Login as manager
3. Logout and login again
4. Register or login as staff
5. Logout and login again

## Manager flow

1. Open dashboard
2. Open projects
3. Create a project
4. Open KPI and switch between:
   - 14 days
   - 30 days
   - 60 days
5. Open reports
6. Open settings and save a harmless profile edit

## Staff flow

1. Open staff home
2. Confirm only one of these can stay open at a time:
   - งานรอตรวจ
   - งานเสร็จแล้ว
   - รายการที่ซ่อนไว้
3. Confirm refresh button reloads data
4. Open settings and save a harmless profile edit

## Task flow

1. Create a task
2. Update progress with image
3. Submit task with proof image
4. Confirm staff sees the task under review
5. Confirm manager sees it in review flow
6. Reject the task once
7. Confirm staff sees:
   - returned note
   - notification in app
8. Re-submit task
9. Approve task
10. Confirm staff sees approved notification
11. Confirm task appears under done tasks

## Hide / restore flow

1. Hide a done task
2. Restore that task
3. Hide a notification
4. Restore that notification
5. Use restore-all in hidden items

## Handover / pickup flow

1. Send a task to handover
2. Open pickup page
3. Request pickup
4. Confirm manager can review the handover state correctly

## Media Library / deployment

1. Upload a Media Library file if that flow matters
2. Redeploy Railway
3. Confirm the file still exists

## Regression watch

Watch logs for:

- `403` on routes that should be available after login
- `404` on task action routes
- `DeprecationWarning: Calling client.query()...`
