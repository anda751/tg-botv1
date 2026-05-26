"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
const projectUid = 'api::project.project';
const notificationUid = 'api::notification.notification';
exports.default = strapi_1.factories.createCoreService(projectUid, ({ strapi }) => ({
    async syncOverdueNotifications() {
        var _a, _b;
        const now = new Date();
        const projects = await strapi.entityService.findMany(projectUid, {
            filters: {
                status_project: 'active',
            },
            populate: ['creator', 'members'],
            limit: -1,
            sort: ['deadline:asc', 'id:asc'],
        });
        const overdueProjects = projects.filter((project) => {
            const deadline = new Date(project.deadline);
            return !Number.isNaN(deadline.getTime()) && deadline < now;
        });
        for (const project of overdueProjects) {
            const deadlineText = formatDeadline(project.deadline);
            const recipients = new Map();
            if ((_a = project.creator) === null || _a === void 0 ? void 0 : _a.id) {
                recipients.set(Number(project.creator.id), {
                    title: 'โปรเจกต์เกินกำหนด',
                    message: `โปรเจกต์ "${project.name}" เลยกำหนดแล้วตั้งแต่ ${deadlineText} กรุณาตรวจสอบและติดตามงานในโปรเจกต์นี้`,
                    link: '/projects',
                });
            }
            for (const member of (_b = project.members) !== null && _b !== void 0 ? _b : []) {
                if (!(member === null || member === void 0 ? void 0 : member.id))
                    continue;
                recipients.set(Number(member.id), {
                    title: 'โปรเจกต์ที่คุณอยู่เกินกำหนด',
                    message: `โปรเจกต์ "${project.name}" เลยกำหนดแล้วตั้งแต่ ${deadlineText} กรุณาอัปเดตงานหรือประสานกับหัวหน้าโปรเจกต์`,
                    link: '/create',
                });
            }
            for (const [recipientId, payload] of recipients.entries()) {
                const existing = await strapi.entityService.findMany(notificationUid, {
                    filters: {
                        recipient: { id: recipientId },
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
                        recipient: recipientId,
                        title: payload.title,
                        message: payload.message,
                        type: 'project',
                        link: payload.link,
                        is_read: false,
                        is_hidden: false,
                    },
                });
            }
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
