"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        {
            method: 'POST',
            path: '/auth/telegram/register',
            handler: 'api::user.user.register',
            config: { auth: false },
        },
        {
            method: 'GET',
            path: '/users/me/profile',
            handler: 'api::user.user.me',
        },
        {
            method: 'POST',
            path: '/users/:id/approve',
            handler: 'api::user.user.approveUser',
        },
        {
            method: 'POST',
            path: '/users/:id/reject',
            handler: 'api::user.user.rejectUser',
        },
    ],
};
