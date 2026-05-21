"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::project.project', ({ strapi }) => ({
    // ===== สร้างโปรเจกต์ (Manager) =====
    async create(ctx) {
        const user = ctx.state.user;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const { name, deadline } = ctx.request.body.data;
        if (!name || !deadline)
            return ctx.badRequest('กรุณากรอกชื่อและเดดไลน์');
        ctx.request.body.data = {
            ...ctx.request.body.data,
            creator: user.id,
            status_project: 'active',
        };
        const response = await super.create(ctx);
        await strapi.service('api::task.task').notifyGroup({
            message: `📁 โปรเจกต์ใหม่: *${name}*\nเดดไลน์: ${new Date(deadline).toLocaleDateString('th-TH')}\nสร้างโดย: ${user.username}`,
        });
        return response;
    },
    // ===== ปิดโปรเจกต์ (Manager) =====
    async closeProject(ctx) {
        const user = ctx.state.user;
        const { id } = ctx.params;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const project = await strapi.entityService.findOne('api::project.project', id);
        if (!project)
            return ctx.notFound('ไม่พบโปรเจกต์นี้');
        if (project.status_project === 'closed')
            return ctx.badRequest('โปรเจกต์นี้ปิดแล้ว');
        // เช็คว่ายังมีงานค้างอยู่ไหม
        const pendingTasks = await strapi.entityService.findMany('api::task.task', {
            filters: {
                project: { id: { $eq: id } },
                status_task: { $ne: 'done' },
            },
        });
        if (pendingTasks.length) {
            return ctx.badRequest(`ยังมีงานค้างอยู่ ${pendingTasks.length} งาน กรุณาปิดงานให้ครบก่อน`);
        }
        await strapi.entityService.update('api::project.project', id, {
            data: { status_project: 'closed' },
        });
        await strapi.service('api::task.task').notifyGroup({
            message: `🏁 โปรเจกต์ *${project.name}* ปิดเรียบร้อยแล้ว`,
        });
        return ctx.send({ message: 'ปิดโปรเจกต์เรียบร้อย' });
    },
    // ===== เพิ่มสมาชิกเข้าโปรเจกต์ (Manager) =====
    async addMember(ctx) {
        var _a, _b, _c;
        const user = ctx.state.user;
        const { id } = ctx.params;
        const { userId } = ctx.request.body;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const project = await strapi.entityService.findOne('api::project.project', id, {
            populate: ['members'],
        });
        if (!project)
            return ctx.notFound('ไม่พบโปรเจกต์นี้');
        const target = await strapi.entityService.findOne('plugin::users-permissions.user', userId);
        if (!target)
            return ctx.notFound('ไม่พบผู้ใช้นี้');
        if (!target.is_approved)
            return ctx.badRequest('พนักงานคนนี้ยังไม่ได้รับการอนุมัติ');
        // เช็คว่าเป็นสมาชิกอยู่แล้วไหม
        const alreadyMember = (_a = project.members) === null || _a === void 0 ? void 0 : _a.some((m) => m.id === Number(userId));
        if (alreadyMember)
            return ctx.badRequest('เป็นสมาชิกโปรเจกต์นี้แล้ว');
        const currentMembers = (_c = (_b = project.members) === null || _b === void 0 ? void 0 : _b.map((m) => m.id)) !== null && _c !== void 0 ? _c : [];
        await strapi.entityService.update('api::project.project', id, {
            data: { members: [...currentMembers, userId] },
        });
        // แจ้ง Staff ที่ถูกเพิ่ม
        await strapi.service('api::task.task').notifyStaff({
            userId,
            message: `📁 คุณได้รับมอบหมายให้เข้าร่วมโปรเจกต์ *${project.name}*`,
        });
        return ctx.send({ message: 'เพิ่มสมาชิกเรียบร้อย' });
    },
    // ===== ลบสมาชิกออกจากโปรเจกต์ (Manager) =====
    async removeMember(ctx) {
        var _a, _b;
        const user = ctx.state.user;
        const { id, userId } = ctx.params;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const project = await strapi.entityService.findOne('api::project.project', id, {
            populate: ['members'],
        });
        if (!project)
            return ctx.notFound('ไม่พบโปรเจกต์นี้');
        const currentMembers = (_b = (_a = project.members) === null || _a === void 0 ? void 0 : _a.map((m) => m.id)) !== null && _b !== void 0 ? _b : [];
        const updated = currentMembers.filter((mId) => mId !== Number(userId));
        await strapi.entityService.update('api::project.project', id, {
            data: { members: updated },
        });
        return ctx.send({ message: 'ลบสมาชิกเรียบร้อย' });
    },
    // ===== ดูรายการโปรเจกต์ของตัวเอง (Staff) =====
    async myProjects(ctx) {
        const user = ctx.state.user;
        const projects = await strapi.entityService.findMany('api::project.project', {
            filters: {
                members: { id: { $eq: user.id } },
                status_project: 'active',
            },
            populate: ['creator', 'members'],
        });
        return ctx.send(projects);
    },
}));
