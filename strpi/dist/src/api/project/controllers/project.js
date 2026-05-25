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
        const created = await strapi.entityService.create('api::project.project', {
            data: {
                ...bodyData,
                name,
                deadline: deadlineDate.toISOString(),
                creator: user.id,
                status_project: 'active',
            },
            populate: ['creator', 'members'],
        });
        await strapi.service('api::task.task').notifyGroup({
            message: `📁 โปรเจกต์ใหม่: *${name}*\nเดดไลน์: ${deadlineDate.toLocaleDateString('th-TH')}\nสร้างโดย: ${user.username}`,
        });
        return ctx.send(created);
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
    async requestJoin(ctx) {
        var _a, _b;
        const user = ctx.state.user;
        const { id } = ctx.params;
        const { note } = (_a = ctx.request.body) !== null && _a !== void 0 ? _a : {};
        if (user.role_app !== 'staff')
            return ctx.forbidden('Staff role required');
        const project = await strapi.entityService.findOne('api::project.project', id, {
            populate: ['members'],
        });
        if (!project)
            return ctx.notFound('Project not found');
        if (project.status_project !== 'active')
            return ctx.badRequest('Project is not active');
        const alreadyMember = (_b = project.members) === null || _b === void 0 ? void 0 : _b.some((m) => m.id === user.id);
        if (alreadyMember)
            return ctx.badRequest('You are already a member of this project');
        const existingPending = await strapi.entityService.findMany('api::project-join-request.project-join-request', {
            filters: {
                project: { id: { $eq: id } },
                requested_by: { id: { $eq: user.id } },
                status_request: 'pending',
            },
            limit: 1,
        });
        if (existingPending.length)
            return ctx.badRequest('Join request is already pending');
        const request = await strapi.entityService.create('api::project-join-request.project-join-request', {
            data: {
                project: Number(id),
                requested_by: user.id,
                note: typeof note === 'string' ? note.trim() : '',
                status_request: 'pending',
            },
            populate: ['project', 'requested_by'],
        });
        await strapi.service('api::task.task').notifyManager({
            taskId: '',
            taskName: '',
            submittedBy: user.display_name || user.username,
            reportText: `Project join request\nProject: ${project.name}\nStaff: ${user.display_name || user.username}\nNote: ${request.note || '-'}`,
            imageUrl: '',
        });
        return ctx.send({ message: 'Join request submitted', request });
    },
    async pendingJoinRequests(ctx) {
        const user = ctx.state.user;
        if (user.role_app !== 'manager')
            return ctx.forbidden('Manager role required');
        const requests = await strapi.entityService.findMany('api::project-join-request.project-join-request', {
            filters: { status_request: 'pending' },
            populate: ['project', 'requested_by'],
            sort: ['createdAt:asc'],
            limit: -1,
        });
        return ctx.send(requests);
    },
    async approveJoinRequest(ctx) {
        var _a, _b, _c;
        const user = ctx.state.user;
        const { id } = ctx.params;
        if (user.role_app !== 'manager')
            return ctx.forbidden('Manager role required');
        const request = await strapi.entityService.findOne('api::project-join-request.project-join-request', id, { populate: ['project', 'requested_by', 'project.members'] });
        if (!request)
            return ctx.notFound('Join request not found');
        if (request.status_request !== 'pending')
            return ctx.badRequest('Request is not pending');
        const members = (_c = (_b = (_a = request.project) === null || _a === void 0 ? void 0 : _a.members) === null || _b === void 0 ? void 0 : _b.map((m) => m.id)) !== null && _c !== void 0 ? _c : [];
        const alreadyMember = members.includes(request.requested_by.id);
        if (!alreadyMember) {
            await strapi.entityService.update('api::project.project', request.project.id, {
                data: { members: [...members, request.requested_by.id] },
            });
        }
        await strapi.entityService.update('api::project-join-request.project-join-request', id, {
            data: {
                status_request: 'approved',
                reviewed_by: user.id,
            },
        });
        await strapi.service('api::task.task').notifyStaff({
            userId: String(request.requested_by.id),
            message: `Approved: You joined project *${request.project.name}*`,
        });
        return ctx.send({ message: 'Join request approved' });
    },
    async rejectJoinRequest(ctx) {
        var _a;
        const user = ctx.state.user;
        const { id } = ctx.params;
        const { reason } = (_a = ctx.request.body) !== null && _a !== void 0 ? _a : {};
        if (user.role_app !== 'manager')
            return ctx.forbidden('Manager role required');
        const request = await strapi.entityService.findOne('api::project-join-request.project-join-request', id, { populate: ['project', 'requested_by'] });
        if (!request)
            return ctx.notFound('Join request not found');
        if (request.status_request !== 'pending')
            return ctx.badRequest('Request is not pending');
        await strapi.entityService.update('api::project-join-request.project-join-request', id, {
            data: {
                status_request: 'rejected',
                reviewed_by: user.id,
                review_note: typeof reason === 'string' ? reason.trim() : '',
            },
        });
        await strapi.service('api::task.task').notifyStaff({
            userId: String(request.requested_by.id),
            message: `Rejected: Your request to join *${request.project.name}* was rejected`,
        });
        return ctx.send({ message: 'Join request rejected' });
    },
}));
