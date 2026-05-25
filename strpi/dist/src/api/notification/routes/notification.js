"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        { method: 'GET', path: '/notifications/my', handler: 'notification.my', config: { auth: false } },
        { method: 'POST', path: '/notifications/:id/read', handler: 'notification.markRead', config: { auth: false } },
        { method: 'POST', path: '/notifications/read-all', handler: 'notification.markAllRead', config: { auth: false } },
    ],
};
