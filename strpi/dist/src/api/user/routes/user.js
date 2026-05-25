"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        {
            method: 'POST',
            path: '/auth/register',
            handler: 'user.register',
            config: { auth: false },
        },
        {
            method: 'POST',
            path: '/auth/login',
            handler: 'user.login',
            config: { auth: false },
        },
        {
            method: 'GET',
            path: '/profile/me',
            handler: 'user.me',
            config: { auth: false },
        },
        {
            method: 'PUT',
            path: '/profile/me',
            handler: 'user.updateMe',
            config: { auth: false },
        },
    ],
};
