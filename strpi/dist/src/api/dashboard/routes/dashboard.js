"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        {
            method: 'GET',
            path: '/dashboard/summary',
            handler: 'dashboard.summary',
            config: { auth: false },
        },
        {
            method: 'GET',
            path: '/dashboard/pending-tasks',
            handler: 'dashboard.pendingTasks',
            config: { auth: false },
        },
        {
            method: 'GET',
            path: '/dashboard/under-review',
            handler: 'dashboard.underReview',
            config: { auth: false },
        },
        {
            method: 'GET',
            path: '/dashboard/staff',
            handler: 'dashboard.staffOverview',
            config: { auth: false },
        },
        {
            method: 'GET',
            path: '/dashboard/pending-approval',
            handler: 'dashboard.pendingApproval',
            config: { auth: false },
        },
    ],
};
