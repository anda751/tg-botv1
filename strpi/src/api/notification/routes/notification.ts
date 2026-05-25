export default {
  routes: [
    { method: 'GET', path: '/notifications/my', handler: 'notification.my', config: { auth: false } },
    { method: 'POST', path: '/notifications/:id/read', handler: 'notification.markRead', config: { auth: false } },
    { method: 'POST', path: '/notifications/read-all', handler: 'notification.markAllRead', config: { auth: false } },
  ],
};
