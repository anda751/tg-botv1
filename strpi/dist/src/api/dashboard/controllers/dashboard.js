"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
const supabase_1 = require("../../../services/supabase");
exports.default = strapi_1.factories.createCoreController('api::task.task', ({ strapi }) => ({
    async summary(ctx) {
        var _a, _b, _c, _d;
        const user = ctx.state.user;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const [tasks, projects, staffList] = await Promise.all([
            strapi.entityService.findMany('api::task.task', {
                populate: ['current_owner'],
                limit: -1,
            }),
            strapi.entityService.findMany('api::project.project', {
                limit: -1,
            }),
            strapi.entityService.findMany('plugin::users-permissions.user', {
                filters: { role_app: 'staff', is_approved: true },
                limit: -1,
            }),
        ]);
        const tasksByStatus = tasks.reduce((acc, t) => {
            var _a;
            acc[t.status_task] = ((_a = acc[t.status_task]) !== null && _a !== void 0 ? _a : 0) + 1;
            return acc;
        }, {});
        const now = new Date();
        const overdueProjects = projects.filter((p) => p.status_project === 'active' && new Date(p.deadline) < now);
        return ctx.send({
            tasks: {
                total: tasks.length,
                in_progress: (_a = tasksByStatus.in_progress) !== null && _a !== void 0 ? _a : 0,
                under_review: (_b = tasksByStatus.under_review) !== null && _b !== void 0 ? _b : 0,
                waiting_pickup: (_c = tasksByStatus.waiting_pickup) !== null && _c !== void 0 ? _c : 0,
                done: (_d = tasksByStatus.done) !== null && _d !== void 0 ? _d : 0,
            },
            projects: {
                total: projects.length,
                active: projects.filter((p) => p.status_project === 'active').length,
                overdue: overdueProjects.length,
            },
            staff: {
                total: staffList.length,
            },
        });
    },
    async pendingTasks(ctx) {
        const user = ctx.state.user;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const tasks = await strapi.entityService.findMany('api::task.task', {
            filters: { status_task: { $ne: 'done' } },
            populate: ['current_owner', 'task_log'],
            sort: { createdAt: 'asc' },
            limit: -1,
        });
        return ctx.send(tasks.map((t) => {
            var _a, _b;
            return ({
                id: t.id,
                name: t.name,
                status_task: t.status_task,
                current_owner: t.current_owner
                    ? { id: t.current_owner.id, display_name: t.current_owner.display_name, username: t.current_owner.username }
                    : null,
                created_at: t.createdAt,
                log_count: (_b = (_a = t.task_log) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0,
            });
        }));
    },
    async underReview(ctx) {
        const user = ctx.state.user;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const tasks = await strapi.entityService.findMany('api::task.task', {
            filters: { status_task: 'under_review' },
            populate: ['current_owner', 'proof_images'],
            sort: { updatedAt: 'asc' },
            limit: -1,
        });
        const result = await Promise.all(tasks.map(async (t) => {
            var _a, _b;
            const latestProof = (_b = (_a = t.proof_images) === null || _a === void 0 ? void 0 : _a.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0]) !== null && _b !== void 0 ? _b : null;
            let imageUrl = null;
            if (latestProof === null || latestProof === void 0 ? void 0 : latestProof.image_url) {
                try {
                    imageUrl = await (0, supabase_1.resolveImageUrl)(latestProof.image_url);
                }
                catch {
                    imageUrl = null;
                }
            }
            return {
                id: t.id,
                name: t.name,
                current_owner: t.current_owner
                    ? { id: t.current_owner.id, display_name: t.current_owner.display_name }
                    : null,
                latest_proof: latestProof ? {
                    image_url: imageUrl,
                    report_text: latestProof.report_text,
                    submitted_at: latestProof.submitted_at,
                } : null,
            };
        }));
        return ctx.send(result);
    },
    async staffOverview(ctx) {
        var _a;
        const user = ctx.state.user;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const [staffList, activeTasks] = await Promise.all([
            strapi.entityService.findMany('plugin::users-permissions.user', {
                filters: { role_app: 'staff', is_approved: true },
                limit: -1,
            }),
            strapi.entityService.findMany('api::task.task', {
                filters: { status_task: { $ne: 'done' } },
                populate: ['current_owner'],
                limit: -1,
            }),
        ]);
        const taskCount = {};
        for (const t of activeTasks) {
            if (t.current_owner) {
                taskCount[t.current_owner.id] = ((_a = taskCount[t.current_owner.id]) !== null && _a !== void 0 ? _a : 0) + 1;
            }
        }
        return ctx.send(staffList.map((s) => {
            var _a;
            return ({
                id: s.id,
                display_name: s.display_name,
                username: s.username,
                telegram_id: s.telegram_id,
                active_tasks: (_a = taskCount[s.id]) !== null && _a !== void 0 ? _a : 0,
            });
        }));
    },
}));
