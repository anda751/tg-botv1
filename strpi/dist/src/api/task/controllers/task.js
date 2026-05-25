"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
const node_fs_1 = require("node:fs");
const supabase_1 = require("../../../services/supabase");
exports.default = strapi_1.factories.createCoreController('api::task.task', ({ strapi }) => ({
    async my(ctx) {
        const user = ctx.state.user;
        const tasks = await strapi.entityService.findMany('api::task.task', {
            filters: { current_owner: { id: user.id } },
            populate: ['project', 'current_owner'],
            sort: ['updatedAt:desc', 'id:desc'],
        });
        return ctx.send(tasks);
    },
    async waitingPickup(ctx) {
        const tasks = await strapi.entityService.findMany('api::task.task', {
            filters: { status_task: 'waiting_pickup' },
            populate: ['current_owner', 'task_log'],
            sort: ['updatedAt:desc', 'id:desc'],
        });
        return ctx.send(tasks);
    },
    async create(ctx) {
        var _a, _b;
        const user = ctx.state.user;
        const bodyData = (_b = (_a = ctx.request.body) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {};
        const name = typeof bodyData.name === 'string' ? bodyData.name.trim() : '';
        const projectValue = bodyData.project;
        if (!/[A-Za-z0-9\u0E00-\u0E7F]/.test(name)) {
            return ctx.badRequest('Task name must include at least one letter or number');
        }
        if (name.length < 5) {
            return ctx.badRequest('Task name must be at least 5 characters');
        }
        const projectId = projectValue === null || projectValue === undefined || projectValue === ''
            ? null
            : Number(projectValue);
        if (projectId !== null && Number.isNaN(projectId)) {
            return ctx.badRequest('Invalid project format');
        }
        const created = await strapi.entityService.create('api::task.task', {
            data: {
                ...bodyData,
                name,
                project: projectId,
                current_owner: user.id,
                creator: user.id,
                status_task: 'in_progress',
            },
            populate: ['project', 'current_owner'],
        });
        await strapi.entityService.create('api::task-log.task-log', {
            data: {
                task: created.id,
                action: 'created',
                actor: user.id,
                note: `Task created: ${name}`,
            },
        });
        await strapi.service('api::task.task').notifyGroup({
            message: `📋 New task: *${name}*\nOwner: ${user.username}`,
        });
        return ctx.send(created);
    },
    async submit(ctx) {
        var _a, _b;
        const user = ctx.state.user;
        const { id } = ctx.params;
        const { report_text } = ctx.request.body;
        const file = (_a = ctx.request.files) === null || _a === void 0 ? void 0 : _a.proof_image;
        const task = await strapi.entityService.findOne('api::task.task', id, {
            populate: ['current_owner'],
        });
        if (!task)
            return ctx.notFound('Task not found');
        if (task.current_owner.id !== user.id)
            return ctx.forbidden('You are not current owner');
        if (task.status_task !== 'in_progress')
            return ctx.badRequest('Task is not in progress');
        if (!file)
            return ctx.badRequest('Proof image is required');
        if (!report_text || report_text.length < 5)
            return ctx.badRequest('Report text must be at least 5 chars');
        const fileBuffer = await readUploadedFileBuffer(file);
        const imagePath = await (0, supabase_1.uploadProofImage)(fileBuffer, file.name || file.filename || file.originalFilename || 'proof', file.type);
        let uploadedMediaId = null;
        try {
            const uploaded = await strapi.plugin('upload').service('upload').upload({
                data: {
                    fileInfo: {
                        name: file.name || file.filename || file.originalFilename || 'proof',
                    },
                },
                files: file,
            });
            const media = Array.isArray(uploaded) ? uploaded[0] : uploaded;
            uploadedMediaId = (_b = media === null || media === void 0 ? void 0 : media.id) !== null && _b !== void 0 ? _b : null;
        }
        catch {
            uploadedMediaId = null;
        }
        const resolvedImageUrl = await (0, supabase_1.resolveImageUrl)(imagePath);
        await strapi.entityService.create('api::proof-image.proof-image', {
            data: {
                task: id,
                image_url: resolvedImageUrl,
                image_file: uploadedMediaId,
                report_text,
                submitted_by: user.id,
                submitted_at: new Date(),
            },
        });
        await strapi.entityService.update('api::task.task', id, {
            data: { status_task: 'under_review' },
        });
        await strapi.entityService.create('api::task-log.task-log', {
            data: {
                task: id,
                action: 'submitted',
                actor: user.id,
                note: report_text,
            },
        });
        await strapi.service('api::task.task').notifyManager({
            taskId: id,
            taskName: task.name,
            submittedBy: user.username,
            reportText: report_text,
            imageUrl: resolvedImageUrl,
            imageBuffer: fileBuffer,
            imageFilename: file.name || file.filename || file.originalFilename || 'proof',
            imageMimeType: file.type,
        });
        return ctx.send({ message: 'Submitted successfully and waiting for review' });
    },
    async progress(ctx) {
        var _a, _b, _c;
        const user = ctx.state.user;
        const { id } = ctx.params;
        const reportTextRaw = (_a = ctx.request.body) === null || _a === void 0 ? void 0 : _a.report_text;
        const reportText = typeof reportTextRaw === 'string' ? reportTextRaw.trim() : '';
        const file = (_b = ctx.request.files) === null || _b === void 0 ? void 0 : _b.proof_image;
        const task = await strapi.entityService.findOne('api::task.task', id, {
            populate: ['current_owner'],
        });
        if (!task)
            return ctx.notFound('Task not found');
        if (task.current_owner.id !== user.id)
            return ctx.forbidden('You are not current owner');
        if (task.status_task !== 'in_progress')
            return ctx.badRequest('Progress update is allowed only for in-progress tasks');
        if (!reportText || reportText.length < 5)
            return ctx.badRequest('Progress text must be at least 5 chars');
        let resolvedImageUrl = '';
        let uploadedMediaId = null;
        if (file) {
            const fileBuffer = await readUploadedFileBuffer(file);
            const imagePath = await (0, supabase_1.uploadProofImage)(fileBuffer, file.name || file.filename || file.originalFilename || 'progress', file.type);
            resolvedImageUrl = await (0, supabase_1.resolveImageUrl)(imagePath);
            try {
                const uploaded = await strapi.plugin('upload').service('upload').upload({
                    data: {
                        fileInfo: {
                            name: file.name || file.filename || file.originalFilename || 'progress',
                        },
                    },
                    files: file,
                });
                const media = Array.isArray(uploaded) ? uploaded[0] : uploaded;
                uploadedMediaId = (_c = media === null || media === void 0 ? void 0 : media.id) !== null && _c !== void 0 ? _c : null;
            }
            catch {
                uploadedMediaId = null;
            }
            await strapi.entityService.create('api::proof-image.proof-image', {
                data: {
                    task: id,
                    image_url: resolvedImageUrl,
                    image_file: uploadedMediaId,
                    report_text: reportText,
                    submitted_by: user.id,
                    submitted_at: new Date(),
                },
            });
        }
        await strapi.entityService.create('api::task-log.task-log', {
            data: {
                task: id,
                action: 'progress_update',
                actor: user.id,
                note: reportText,
            },
        });
        await strapi.service('api::task.task').notifyManager({
            taskId: id,
            taskName: task.name,
            submittedBy: user.username,
            reportText: `Progress update:\n${reportText}`,
            imageUrl: resolvedImageUrl,
        });
        return ctx.send({ message: 'Progress updated successfully' });
    },
    async approve(ctx) {
        const user = ctx.state.user;
        const { id } = ctx.params;
        if (user.role_app !== 'manager')
            return ctx.forbidden('Manager role required');
        const task = await strapi.entityService.findOne('api::task.task', id, {
            populate: ['current_owner'],
        });
        if (!task)
            return ctx.notFound('Task not found');
        if (task.status_task !== 'under_review')
            return ctx.badRequest('Task is not under review');
        await strapi.entityService.update('api::task.task', id, {
            data: { status_task: 'done' },
        });
        await strapi.entityService.create('api::task-log.task-log', {
            data: {
                task: id,
                action: 'approved',
                actor: user.id,
            },
        });
        await strapi.service('api::task.task').notifyGroup({
            message: `✅ Task done: *${task.name}*\nBy: ${task.current_owner.username}`,
        });
        return ctx.send({ message: 'Approved successfully' });
    },
    async reject(ctx) {
        const user = ctx.state.user;
        const { id } = ctx.params;
        const { reason } = ctx.request.body;
        if (user.role_app !== 'manager')
            return ctx.forbidden('Manager role required');
        if (!reason || reason.length < 5)
            return ctx.badRequest('Reason must be at least 5 chars');
        const task = await strapi.entityService.findOne('api::task.task', id, {
            populate: ['current_owner'],
        });
        if (!task)
            return ctx.notFound('Task not found');
        await strapi.entityService.update('api::task.task', id, {
            data: { status_task: 'in_progress' },
        });
        await strapi.entityService.create('api::task-log.task-log', {
            data: {
                task: id,
                action: 'rejected',
                actor: user.id,
                note: reason,
            },
        });
        await strapi.service('api::task.task').notifyStaff({
            userId: task.current_owner.id,
            message: `⚠️ Task *${task.name}* was rejected\nReason: ${reason}`,
        });
        return ctx.send({ message: 'Rejected successfully' });
    },
}));
async function readUploadedFileBuffer(file) {
    if (!file)
        throw new Error('proof_image is missing');
    if (Buffer.isBuffer(file.data))
        return file.data;
    if (Buffer.isBuffer(file.buffer))
        return file.buffer;
    if (file.data !== undefined && file.data !== null)
        return Buffer.from(file.data);
    if (file.buffer !== undefined && file.buffer !== null)
        return Buffer.from(file.buffer);
    const filePath = file.filepath || file.path || file.tempFilePath;
    if (typeof filePath === 'string' && filePath.length > 0)
        return node_fs_1.promises.readFile(filePath);
    throw new Error('Cannot read uploaded proof image buffer');
}
