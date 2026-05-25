"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        {
            method: 'GET',
            path: '/dashboard/summary',
            handler: 'dashboard.summary',
            config: {},
        },
        {
            method: 'GET',
            path: '/dashboard/pending-tasks',
            handler: 'dashboard.pendingTasks',
            config: {},
        },
        {
            method: 'GET',
            path: '/dashboard/under-review',
            handler: 'dashboard.underReview',
            config: {},
        },
        {
            method: 'GET',
            path: '/dashboard/staff',
            handler: 'dashboard.staffOverview',
            config: {},
        },
    ],
};
