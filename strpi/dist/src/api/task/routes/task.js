"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        // Default CRUD routes
        { method: 'GET', path: '/tasks', handler: 'task.find' },
        { method: 'GET', path: '/tasks/:id', handler: 'task.findOne' },
        { method: 'POST', path: '/tasks', handler: 'task.create' },
        // Custom routes
        { method: 'POST', path: '/tasks/:id/submit', handler: 'task.submit' },
        { method: 'POST', path: '/tasks/:id/approve', handler: 'task.approve' },
        { method: 'POST', path: '/tasks/:id/reject', handler: 'task.reject' },
    ],
};
