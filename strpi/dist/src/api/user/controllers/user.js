"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    async register(ctx) {
        const { email, display_name, telegram_id, telegram_chat_id } = ctx.request.body;
        if (!email || !display_name || !telegram_id || !telegram_chat_id) {
            return ctx.badRequest('กรุณากรอกข้อมูลให้ครบ');
        }
        if (display_name.length < 2) {
            return ctx.badRequest('ชื่อต้องมีอย่างน้อย 2 ตัวอักษร');
        }
        const existing = await strapi.entityService.findMany('plugin::users-permissions.user', { filters: { telegram_id } });
        if (existing.length)
            return ctx.badRequest('Telegram ID นี้ลงทะเบียนแล้ว');
        const existingEmail = await strapi.entityService.findMany('plugin::users-permissions.user', { filters: { email } });
        if (existingEmail.length)
            return ctx.badRequest('Email นี้ถูกใช้แล้ว');
        const defaultRole = await strapi
            .query('plugin::users-permissions.role')
            .findOne({ where: { type: 'authenticated' } });
        const user = await strapi.entityService.create('plugin::users-permissions.user', {
            data: {
                email,
                username: `tg_${telegram_id}`,
                display_name,
                telegram_id,
                telegram_chat_id,
                role_app: 'staff',
                is_approved: true,
                role: defaultRole.id,
                confirmed: true,
                blocked: false,
            },
        });
        await strapi.service('api::task.task').notifyManager({
            taskId: '',
            taskName: '',
            submittedBy: display_name,
            reportText: `📩 พนักงานใหม่ขอเข้าระบบ\nชื่อ: ${display_name}\nEmail: ${email}\nTelegram ID: ${telegram_id}`,
            imageUrl: '',
            userId: String(user.id),
        });
        return ctx.send({
            message: 'สมัครสมาชิกเรียบร้อย',
            userId: user.id,
        });
    },
    async approveUser(ctx) {
        const user = ctx.state.user;
        const { id } = ctx.params;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const target = await strapi.entityService.findOne('plugin::users-permissions.user', id);
        if (!target)
            return ctx.notFound('ไม่พบผู้ใช้นี้');
        if (target.is_approved)
            return ctx.badRequest('อนุมัติแล้ว');
        await strapi.entityService.update('plugin::users-permissions.user', id, {
            data: { is_approved: true },
        });
        await strapi.service('api::task.task').notifyStaff({
            userId: id,
            message: `✅ หัวหน้าอนุมัติแล้ว คุณสามารถเข้าใช้งานระบบได้เลยครับ`,
        });
        return ctx.send({ message: 'อนุมัติพนักงานเรียบร้อย' });
    },
    async rejectUser(ctx) {
        const user = ctx.state.user;
        const { id } = ctx.params;
        const { reason } = ctx.request.body;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        if (!reason || reason.length < 5)
            return ctx.badRequest('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร');
        const target = await strapi.entityService.findOne('plugin::users-permissions.user', id);
        if (!target)
            return ctx.notFound('ไม่พบผู้ใช้นี้');
        await strapi.service('api::task.task').notifyStaff({
            userId: id,
            message: `❌ ขออภัย คำขอเข้าระบบถูกปฏิเสธ\nเหตุผล: ${reason}`,
        });
        await strapi.entityService.delete('plugin::users-permissions.user', id);
        return ctx.send({ message: 'ปฏิเสธพนักงานเรียบร้อย' });
    },
    async me(ctx) {
        const user = ctx.state.user;
        const fullUser = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, { populate: [] });
        return ctx.send({
            id: fullUser.id,
            email: fullUser.email,
            display_name: fullUser.display_name,
            telegram_id: fullUser.telegram_id,
            role_app: fullUser.role_app,
            is_approved: fullUser.is_approved,
        });
    },
};
