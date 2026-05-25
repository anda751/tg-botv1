"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        // Default CRUD routes
        { method: 'GET', path: '/tasks', handler: 'task.find', config: {} },
        { method: 'GET', path: '/tasks/my', handler: 'task.my', config: {} },
        { method: 'GET', path: '/tasks/waiting-pickup', handler: 'task.waitingPickup', config: {} },
        { method: 'GET', path: '/tasks/:id', handler: 'task.findOne', config: {} },
        { method: 'POST', path: '/tasks', handler: 'task.create', config: {} },
        // Custom routes
        { method: 'POST', path: '/tasks/:id/submit', handler: 'task.submit', config: {} },
        { method: 'POST', path: '/tasks/:id/progress', handler: 'task.progress', config: {} },
        { method: 'POST', path: '/tasks/:id/approve', handler: 'task.approve', config: {} },
        { method: 'POST', path: '/tasks/:id/reject', handler: 'task.reject', config: {} },
    ],
};
