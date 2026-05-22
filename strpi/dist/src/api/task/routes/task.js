"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        // Default CRUD routes
        { method: 'GET', path: '/tasks', handler: 'task.find', config: { auth: false } },
        { method: 'GET', path: '/tasks/my', handler: 'task.my', config: { auth: false } },
        { method: 'GET', path: '/tasks/waiting-pickup', handler: 'task.waitingPickup', config: { auth: false } },
        { method: 'GET', path: '/tasks/:id', handler: 'task.findOne', config: { auth: false } },
        { method: 'POST', path: '/tasks', handler: 'task.create', config: { auth: false } },
        // Custom routes
        { method: 'POST', path: '/tasks/:id/submit', handler: 'task.submit', config: { auth: false } },
        { method: 'POST', path: '/tasks/:id/approve', handler: 'task.approve', config: { auth: false } },
        { method: 'POST', path: '/tasks/:id/reject', handler: 'task.reject', config: { auth: false } },
    ],
};
