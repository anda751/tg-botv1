"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('plugin::users-permissions.user', ({ strapi }) => ({
    async register(ctx) {
        const { email, display_name, telegram_id, telegram_chat_id, role_app, } = ctx.request.body;
        const selectedRole = role_app === 'manager' ? 'manager' : 'staff';
        const requiresApproval = selectedRole === 'staff';
        if (!email || !display_name || !telegram_id || !telegram_chat_id) {
            return ctx.badRequest('กรุณากรอกข้อมูลให้ครบ');
        }
        if (display_name.length < 2) {
            return ctx.badRequest('ชื่อต้องมีอย่างน้อย 2 ตัวอักษร');
        }
        const existing = await strapi.entityService.findMany('plugin::users-permissions.user', {
            filters: {
                telegram_id,
                role_app: selectedRole,
            },
            limit: 1,
        });
        if (existing.length) {
            return ctx.badRequest(`Telegram account นี้ลงทะเบียนเป็น ${selectedRole} แล้ว`);
        }
        const existingEmail = await strapi.entityService.findMany('plugin::users-permissions.user', {
            filters: {
                email,
                role_app: selectedRole,
            },
            limit: 1,
        });
        if (existingEmail.length) {
            return ctx.badRequest(`Email นี้ถูกใช้กับบทบาท ${selectedRole} แล้ว`);
        }
        const defaultRole = await strapi
            .query('plugin::users-permissions.role')
            .findOne({ where: { type: 'authenticated' } });
        if (!defaultRole)
            return ctx.internalServerError('ไม่พบ authenticated role');
        const user = await strapi.entityService.create('plugin::users-permissions.user', {
            data: {
                email,
                username: `${email}:${selectedRole}`,
                display_name,
                telegram_id,
                telegram_chat_id,
                role_app: selectedRole,
                is_approved: !requiresApproval,
                role: defaultRole.id,
                confirmed: true,
                blocked: false,
            },
        });
        if (requiresApproval) {
            await strapi.service('api::task.task').notifyManager({
                taskId: '',
                taskName: '',
                submittedBy: display_name,
                reportText: `📩 ผู้ใช้ใหม่รออนุมัติ\nชื่อ: ${display_name}\nEmail: ${email}\nRole: ${selectedRole}\nTelegram ID: ${telegram_id}`,
                imageUrl: '',
                userId: String(user.id),
            });
        }
        return ctx.send({
            message: requiresApproval ? 'สมัครเรียบร้อย กรุณารอหัวหน้าอนุมัติ' : 'สมัครสมาชิกเรียบร้อย',
            userId: user.id,
            requiresApproval,
            role_app: selectedRole,
        });
    },
    async approveUser(ctx) {
        const currentUser = ctx.state.user;
        const { id } = ctx.params;
        if (currentUser.role_app !== 'manager')
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
            message: '✅ หัวหน้าอนุมัติแล้ว คุณสามารถเข้าใช้งานระบบได้เลยครับ',
        });
        return ctx.send({ message: 'อนุมัติพนักงานเรียบร้อย' });
    },
    async rejectUser(ctx) {
        const currentUser = ctx.state.user;
        const { id } = ctx.params;
        const { reason } = ctx.request.body;
        if (currentUser.role_app !== 'manager')
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
        const currentUser = ctx.state.user;
        const fullUser = await strapi.entityService.findOne('plugin::users-permissions.user', currentUser.id, { populate: [] });
        if (!fullUser)
            return ctx.notFound('ไม่พบผู้ใช้');
        return ctx.send({
            id: fullUser.id,
            email: fullUser.email,
            display_name: fullUser.display_name,
            telegram_id: fullUser.telegram_id,
            role_app: fullUser.role_app,
            is_approved: fullUser.is_approved,
        });
    },
}));
