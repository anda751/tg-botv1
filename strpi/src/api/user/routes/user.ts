export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/telegram/register',
      handler: 'user.register',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/profile/me',
      handler: 'user.me',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/staff/:id/approve',      // ← เปลี่ยนจาก /users/:id/approve
      handler: 'user.approveUser',
    },
    {
      method: 'POST',
      path: '/staff/:id/reject',       // ← เปลี่ยนจาก /users/:id/reject
      handler: 'user.rejectUser',
    },
  ],
};
