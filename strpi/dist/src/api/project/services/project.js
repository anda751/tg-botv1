"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
const projectUid = 'api::project.project';
const notificationUid = 'api::notification.notification';
exports.default = strapi_1.factories.createCoreService(projectUid, ({ strapi }) => ({
    async syncOverdueNotificationsForUser(user) {
        const userId = Number(user === null || user === void 0 ? void 0 : user.id);
        if (!Number.isFinite(userId) || userId <= 0)
            return;
        const now = new Date();
        const projects = await strapi.entityService.findMany(projectUid, {
            filters: {
                status_project: 'active',
                ...((user === null || user === void 0 ? void 0 : user.role_app) === 'manager'
                    ? { creator: { id: userId } }
                    : { members: { id: userId } }),
            },
            fields: ['id', 'name', 'deadline'],
            limit: -1,
            sort: ['deadline:asc', 'id:asc'],
        });
        for (const project of projects) {
            const deadline = new Date(project.deadline);
            if (Number.isNaN(deadline.getTime()) || deadline >= now)
                continue;
            const deadlineText = formatDeadline(project.deadline);
            const payload = (user === null || user === void 0 ? void 0 : user.role_app) === 'manager'
                ? {
                    title: 'โปรเจกต์เกินกำหนด',
                    message: `โปรเจกต์ "${project.name}" เลยกำหนดแล้วตั้งแต่ ${deadlineText} กรุณาตรวจสอบและติดตามงานในโปรเจกต์นี้`,
                    link: '/projects',
                }
                : {
                    title: 'โปรเจกต์ที่คุณอยู่เกินกำหนด',
                    message: `โปรเจกต์ "${project.name}" เลยกำหนดแล้วตั้งแต่ ${deadlineText} กรุณาอัปเดตงานหรือประสานกับหัวหน้าโปรเจกต์`,
                    link: '/create',
                };
            const existing = await strapi.entityService.findMany(notificationUid, {
                filters: {
                    recipient: { id: userId },
                    type: 'project',
                    title: payload.title,
                    message: payload.message,
                    link: payload.link,
                },
                fields: ['id'],
                limit: 1,
            });
            if (existing.length > 0)
                continue;
            await strapi.entityService.create(notificationUid, {
                data: {
                    recipient: userId,
                    title: payload.title,
                    message: payload.message,
                    type: 'project',
                    link: payload.link,
                    is_read: false,
                    is_hidden: false,
                },
            });
        }
    },
}));
function formatDeadline(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return 'วันที่ไม่ระบุ';
    return date.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}
