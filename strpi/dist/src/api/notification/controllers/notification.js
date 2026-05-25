"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
const notificationUid = 'api::notification.notification';
exports.default = strapi_1.factories.createCoreController(notificationUid, ({ strapi }) => ({
    async my(ctx) {
        const user = ctx.state.user;
        if (!(user === null || user === void 0 ? void 0 : user.id))
            return ctx.unauthorized('กรุณาเข้าสู่ระบบ');
        const notifications = await strapi.entityService.findMany(notificationUid, {
            filters: { recipient: { id: user.id } },
            sort: ['createdAt:desc', 'id:desc'],
            limit: 20,
        });
        return ctx.send(notifications.map(serializeNotification));
    },
    async markRead(ctx) {
        var _a, _b;
        const user = ctx.state.user;
        const { id } = ctx.params;
        if (!(user === null || user === void 0 ? void 0 : user.id))
            return ctx.unauthorized('กรุณาเข้าสู่ระบบ');
        const notification = await strapi.entityService.findOne(notificationUid, id, {
            populate: ['recipient'],
        });
        if (!notification)
            return ctx.notFound('ไม่พบการแจ้งเตือน');
        if (((_a = notification.recipient) === null || _a === void 0 ? void 0 : _a.id) !== user.id)
            return ctx.forbidden('คุณไม่มีสิทธิ์เข้าถึงการแจ้งเตือนนี้');
        const updated = await strapi.entityService.update(notificationUid, id, {
            data: {
                is_read: true,
                read_at: (_b = notification.read_at) !== null && _b !== void 0 ? _b : new Date(),
            },
        });
        return ctx.send({
            message: 'อัปเดตสถานะการแจ้งเตือนแล้ว',
            notification: serializeNotification(updated),
        });
    },
    async markAllRead(ctx) {
        const user = ctx.state.user;
        if (!(user === null || user === void 0 ? void 0 : user.id))
            return ctx.unauthorized('กรุณาเข้าสู่ระบบ');
        const notifications = await strapi.entityService.findMany(notificationUid, {
            filters: {
                recipient: { id: user.id },
                is_read: false,
            },
            fields: ['id'],
            limit: -1,
        });
        await Promise.all(notifications.map((notification) => strapi.entityService.update(notificationUid, notification.id, {
            data: {
                is_read: true,
                read_at: new Date(),
            },
        })));
        return ctx.send({
            message: 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมดเรียบร้อย',
            count: notifications.length,
        });
    },
}));
function serializeNotification(notification) {
    return {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: notification.link || '',
        is_read: !!notification.is_read,
        read_at: notification.read_at,
        createdAt: notification.createdAt,
    };
}
