"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = [
    'strapi::logger',
    'strapi::errors',
    {
        name: 'strapi::security',
        config: {
            contentSecurityPolicy: {
                useDefaults: true,
                directives: {
                    'connect-src': ["'self'", 'https:'],
                },
            },
        },
    },
    {
        name: 'strapi::cors',
        config: {
            origin: ['https://tg-botv1-iota.vercel.app', 'https://tg-botv1-git-main-anda751s-projects.vercel.app'],
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            headers: [
                'Content-Type',
                'Authorization',
                'x-telegram-init-data',
                'x-role-app',
            ],
            keepHeaderOnError: true,
        },
    },
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
    {
        name: 'global::telegram-auth',
        config: {},
    },
];
exports.default = config;
