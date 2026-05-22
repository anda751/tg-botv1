"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::project.project', ({ strapi }) => ({
    async all(ctx) {
        const projects = await strapi.entityService.findMany('api::project.project', {
            populate: ['creator', 'members'],
            sort: ['updatedAt:desc', 'id:desc'],
        });
        return ctx.send(projects);
    },
    async create(ctx) {
        var _a, _b;
        const user = ctx.state.user;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const bodyData = (_b = (_a = ctx.request.body) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {};
        const name = typeof bodyData.name === 'string' ? bodyData.name.trim() : '';
        const deadline = bodyData.deadline;
        if (!name || !deadline)
            return ctx.badRequest('กรุณากรอกชื่อและเดดไลน์');
        const deadlineDate = new Date(deadline);
        if (Number.isNaN(deadlineDate.getTime()))
            return ctx.badRequest('รูปแบบเดดไลน์ไม่ถูกต้อง');
        ctx.request.body.data = {
            ...bodyData,
            name,
            deadline: deadlineDate.toISOString(),
            creator: user.id,
            status_project: 'active',
        };
        const response = await super.create(ctx);
        await strapi.service('api::task.task').notifyGroup({
            message: `📁 โปรเจกต์ใหม่: *${name}*\nเดดไลน์: ${deadlineDate.toLocaleDateString('th-TH')}\nสร้างโดย: ${user.username}`,
        });
        return response;
    },
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
        const alreadyMember = (_a = project.members) === null || _a === void 0 ? void 0 : _a.some((m) => m.id === Number(userId));
        if (alreadyMember)
            return ctx.badRequest('เป็นสมาชิกโปรเจกต์นี้แล้ว');
        const currentMembers = (_c = (_b = project.members) === null || _b === void 0 ? void 0 : _b.map((m) => m.id)) !== null && _c !== void 0 ? _c : [];
        await strapi.entityService.update('api::project.project', id, {
            data: { members: [...currentMembers, userId] },
        });
        await strapi.service('api::task.task').notifyStaff({
            userId,
            message: `📁 คุณได้รับมอบหมายให้เข้าร่วมโปรเจกต์ *${project.name}*`,
        });
        return ctx.send({ message: 'เพิ่มสมาชิกเรียบร้อย' });
    },
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
    async myProjects(ctx) {
        const user = ctx.state.user;
        const projects = await strapi.entityService.findMany('api::project.project', {
            filters: {
                members: { id: { $eq: user.id } },
                status_project: 'active',
            },
            populate: ['creator', 'members'],
            sort: ['updatedAt:desc', 'id:desc'],
        });
        return ctx.send(projects);
    },
}));
