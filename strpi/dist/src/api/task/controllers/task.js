"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
const node_fs_1 = require("node:fs");
const supabase_1 = require("../../../services/supabase");
exports.default = strapi_1.factories.createCoreController('api::task.task', ({ strapi }) => ({
    async my(ctx) {
        const user = ctx.state.user;
        const tasks = await strapi.entityService.findMany('api::task.task', {
            filters: {
                current_owner: { id: user.id },
                is_hidden_for_owner: false,
            },
            populate: ['project', 'current_owner', 'task_log'],
            sort: ['updatedAt:desc', 'id:desc'],
        });
        return ctx.send(tasks);
    },
    async hidden(ctx) {
        const user = ctx.state.user;
        const tasks = await strapi.entityService.findMany('api::task.task', {
            filters: {
                current_owner: { id: user.id },
                is_hidden_for_owner: true,
            },
            populate: ['project', 'current_owner', 'task_log'],
            sort: ['hidden_for_owner_at:desc', 'updatedAt:desc', 'id:desc'],
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
            return ctx.badRequest('ชื่องานต้องมีตัวอักษรหรือตัวเลขอย่างน้อย 1 ตัว');
        }
        if (name.length < 5) {
            return ctx.badRequest('ชื่องานต้องยาวอย่างน้อย 5 ตัวอักษร');
        }
        const projectId = projectValue === null || projectValue === undefined || projectValue === ''
            ? null
            : Number(projectValue);
        if (projectId !== null && Number.isNaN(projectId)) {
            return ctx.badRequest('รูปแบบโปรเจกต์ไม่ถูกต้อง');
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
                note: `สร้างงาน: ${name}`,
            },
        });
        await strapi.service('api::task.task').notifyGroup({
            message: `งานใหม่: *${name}*\nผู้รับผิดชอบ: ${user.username}`,
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
            return ctx.notFound('ไม่พบงาน');
        if (task.current_owner.id !== user.id)
            return ctx.forbidden('คุณไม่ใช่ผู้รับผิดชอบงานนี้');
        if (task.status_task !== 'in_progress')
            return ctx.badRequest('งานนี้ไม่ได้อยู่ระหว่างดำเนินการ');
        if (!file)
            return ctx.badRequest('กรุณาแนบรูปหลักฐาน');
        if (!report_text || report_text.length < 5)
            return ctx.badRequest('รายละเอียดงานต้องยาวอย่างน้อย 5 ตัวอักษร');
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
        return ctx.send({ message: 'ส่งงานเรียบร้อย รอหัวหน้าตรวจสอบ' });
    },
    async progress(ctx) {
        var _a, _b, _c;
        const user = ctx.state.user;
        const { id } = ctx.params;
        const reportTextRaw = (_a = ctx.request.body) === null || _a === void 0 ? void 0 : _a.report_text;
        const reportText = typeof reportTextRaw === 'string' ? reportTextRaw.trim() : '';
        const file = (_b = ctx.request.files) === null || _b === void 0 ? void 0 : _b.proof_image;
        let fileBuffer = null;
        const task = await strapi.entityService.findOne('api::task.task', id, {
            populate: ['current_owner'],
        });
        if (!task)
            return ctx.notFound('ไม่พบงาน');
        if (task.current_owner.id !== user.id)
            return ctx.forbidden('คุณไม่ใช่ผู้รับผิดชอบงานนี้');
        if (task.status_task !== 'in_progress')
            return ctx.badRequest('อัปเดตความคืบหน้าได้เฉพาะงานที่กำลังดำเนินการอยู่');
        if (!reportText || reportText.length < 5)
            return ctx.badRequest('ข้อความอัปเดตต้องยาวอย่างน้อย 5 ตัวอักษร');
        let resolvedImageUrl = '';
        let uploadedMediaId = null;
        if (file) {
            fileBuffer = await readUploadedFileBuffer(file);
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
            reportText: `อัปเดตความคืบหน้า:\n${reportText}`,
            imageUrl: resolvedImageUrl,
            imageBuffer: fileBuffer !== null && fileBuffer !== void 0 ? fileBuffer : undefined,
            imageFilename: (file === null || file === void 0 ? void 0 : file.name) || (file === null || file === void 0 ? void 0 : file.filename) || (file === null || file === void 0 ? void 0 : file.originalFilename) || 'progress',
            imageMimeType: file === null || file === void 0 ? void 0 : file.type,
        });
        return ctx.send({ message: 'อัปเดตความคืบหน้าเรียบร้อย' });
    },
    async approve(ctx) {
        const user = ctx.state.user;
        const { id } = ctx.params;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const task = await strapi.entityService.findOne('api::task.task', id, {
            populate: ['current_owner'],
        });
        if (!task)
            return ctx.notFound('ไม่พบงาน');
        if (task.status_task !== 'under_review')
            return ctx.badRequest('งานนี้ไม่ได้อยู่ในสถานะรอตรวจสอบ');
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
            message: `งานเสร็จสมบูรณ์: *${task.name}*\nโดย: ${task.current_owner.username}`,
        });
        await strapi.service('api::task.task').notifyStaff({
            userId: task.current_owner.id,
            title: 'งานได้รับอนุมัติแล้ว',
            message: `งาน *${task.name}* ผ่านการตรวจสอบและเสร็จสมบูรณ์แล้ว`,
            type: 'task',
            link: '/',
        });
        return ctx.send({ message: 'อนุมัติงานเรียบร้อย' });
    },
    async reject(ctx) {
        const user = ctx.state.user;
        const { id } = ctx.params;
        const { reason } = ctx.request.body;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        if (!reason || reason.length < 5)
            return ctx.badRequest('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร');
        const task = await strapi.entityService.findOne('api::task.task', id, {
            populate: ['current_owner'],
        });
        if (!task)
            return ctx.notFound('ไม่พบงาน');
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
            title: 'งานถูกส่งกลับ',
            message: `งาน *${task.name}* ไม่ผ่านการตรวจสอบ\nเหตุผล: ${reason}`,
            type: 'task',
            link: '/',
        });
        return ctx.send({ message: 'ตีกลับงานเรียบร้อย' });
    },
    async hide(ctx) {
        var _a;
        const user = ctx.state.user;
        const { id } = ctx.params;
        const task = await strapi.entityService.findOne('api::task.task', id, {
            populate: ['current_owner'],
        });
        if (!task)
            return ctx.notFound('ไม่พบงาน');
        if (((_a = task.current_owner) === null || _a === void 0 ? void 0 : _a.id) !== user.id)
            return ctx.forbidden('คุณไม่มีสิทธิ์ซ่อนงานนี้');
        if (task.status_task !== 'done')
            return ctx.badRequest('ซ่อนได้เฉพาะงานที่เสร็จแล้ว');
        if (task.is_hidden_for_owner)
            return ctx.send({ message: 'งานนี้ถูกซ่อนไว้แล้ว' });
        await strapi.entityService.update('api::task.task', id, {
            data: {
                is_hidden_for_owner: true,
                hidden_for_owner_at: new Date(),
            },
        });
        return ctx.send({ message: 'ซ่อนงานเรียบร้อย' });
    },
    async restore(ctx) {
        var _a;
        const user = ctx.state.user;
        const { id } = ctx.params;
        const task = await strapi.entityService.findOne('api::task.task', id, {
            populate: ['current_owner'],
        });
        if (!task)
            return ctx.notFound('ไม่พบงาน');
        if (((_a = task.current_owner) === null || _a === void 0 ? void 0 : _a.id) !== user.id)
            return ctx.forbidden('คุณไม่มีสิทธิ์กู้คืนงานนี้');
        await strapi.entityService.update('api::task.task', id, {
            data: {
                is_hidden_for_owner: false,
                hidden_for_owner_at: null,
            },
        });
        return ctx.send({ message: 'กู้คืนงานเรียบร้อย' });
    },
    async restoreAll(ctx) {
        const user = ctx.state.user;
        const tasks = await strapi.entityService.findMany('api::task.task', {
            filters: {
                current_owner: { id: user.id },
                is_hidden_for_owner: true,
            },
            fields: ['id'],
            limit: -1,
        });
        await Promise.all(tasks.map((task) => strapi.entityService.update('api::task.task', task.id, {
            data: {
                is_hidden_for_owner: false,
                hidden_for_owner_at: null,
            },
        })));
        return ctx.send({
            message: 'กู้คืนงานที่ซ่อนไว้ทั้งหมดเรียบร้อย',
            count: tasks.length,
        });
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
