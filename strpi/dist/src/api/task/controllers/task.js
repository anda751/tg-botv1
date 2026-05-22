"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
const supabase_1 = require("../../../services/supabase");
exports.default = strapi_1.factories.createCoreController('api::task.task', ({ strapi }) => ({
    async my(ctx) {
        const user = ctx.state.user;
        const tasks = await strapi.entityService.findMany('api::task.task', {
            filters: {
                current_owner: {
                    id: user.id,
                },
            },
            populate: ['project', 'current_owner'],
            sort: ['updatedAt:desc', 'id:desc'],
        });
        return ctx.send(tasks);
    },
    async waitingPickup(ctx) {
        const tasks = await strapi.entityService.findMany('api::task.task', {
            filters: {
                status_task: 'waiting_pickup',
            },
            populate: ['current_owner', 'task_log'],
            sort: ['updatedAt:desc', 'id:desc'],
        });
        return ctx.send(tasks);
    },
    // ===== สร้างงานใหม่ =====
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
    // ===== ส่งงาน (Under Review) =====
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
            return ctx.notFound('ไม่พบงานนี้');
        if (task.current_owner.id !== user.id)
            return ctx.forbidden('คุณไม่ใช่เจ้าของงานนี้');
        if (task.status_task !== 'in_progress')
            return ctx.badRequest('งานนี้ไม่ได้อยู่ในสถานะ In Progress');
        if (!file)
            return ctx.badRequest('กรุณาแนบรูปหลักฐาน');
        if (!report_text || report_text.length < 5)
            return ctx.badRequest('รายงานต้องมีอย่างน้อย 5 ตัวอักษร');
        // อัปโหลดขึ้น Supabase Storage
        const imagePath = await (0, supabase_1.uploadProofImage)(file.data, file.name || file.filename || file.originalFilename || 'proof', file.type);
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
        await strapi.entityService.create('api::proof-image.proof-image', {
            data: {
                task: id,
                image_url: imagePath, // เก็บ path ไว้ใน DB
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
        let signedImageUrl = '';
        try {
            signedImageUrl = await (0, supabase_1.getSignedUrl)(imagePath);
        }
        catch {
            signedImageUrl = '';
        }
        const imageBuffer = Buffer.isBuffer(file.data)
            ? file.data
            : Buffer.from(file.data);
        await strapi.service('api::task.task').notifyManager({
            taskId: id,
            taskName: task.name,
            submittedBy: user.username,
            reportText: report_text,
            imageUrl: signedImageUrl,
            imageBuffer,
            imageFilename: file.name || file.filename || file.originalFilename || 'proof',
            imageMimeType: file.type,
        });
        return ctx.send({ message: 'ส่งงานเรียบร้อย รอหัวหน้าตรวจสอบ' });
    },
    // ===== อนุมัติงาน (Manager) =====
    async approve(ctx) {
        const user = ctx.state.user;
        const { id } = ctx.params;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const task = await strapi.entityService.findOne('api::task.task', id, {
            populate: ['current_owner'],
        }); // ← cast as any
        if (!task)
            return ctx.notFound('ไม่พบงานนี้');
        if (task.status_task !== 'under_review')
            return ctx.badRequest('งานนี้ไม่ได้รอการตรวจ');
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
            message: `✅ งานเสร็จสมบูรณ์: *${task.name}*\nโดย: ${task.current_owner.username}`,
        });
        return ctx.send({ message: 'อนุมัติงานเรียบร้อย' });
    },
    // ===== ปฏิเสธงาน (Manager) =====
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
        }); // ← cast as any
        if (!task)
            return ctx.notFound('ไม่พบงานนี้');
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
            message: `⚠️ งาน *${task.name}* ถูกส่งกลับ\nเหตุผล: ${reason}`,
        });
        return ctx.send({ message: 'ส่งกลับงานเรียบร้อย' });
    },
}));
