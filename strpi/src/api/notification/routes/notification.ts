export default {
  routes: [
    { method: 'GET', path: '/notifications/my', handler: 'notification.my', config: { auth: false } },
    { method: 'GET', path: '/notifications/hidden', handler: 'notification.hidden', config: { auth: false } },
    { method: 'POST', path: '/notifications/:id/read', handler: 'notification.markRead', config: { auth: false } },
    { method: 'POST', path: '/notifications/read-all', handler: 'notification.markAllRead', config: { auth: false } },
    { method: 'POST', path: '/notifications/:id/hide', handler: 'notification.hide', config: { auth: false } },
    { method: 'POST', path: '/notifications/hide-read', handler: 'notification.hideRead', config: { auth: false } },
    { method: 'POST', path: '/notifications/:id/restore', handler: 'notification.restore', config: { auth: false } },
  ],
};
