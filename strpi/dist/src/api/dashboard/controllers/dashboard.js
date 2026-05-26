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
        const tasks = await strapi.entityService.findMany('api::task.task', {
            populate: ['current_owner'],
            limit: -1,
        });
        const projects = await strapi.entityService.findMany('api::project.project', {
            limit: -1,
        });
        const staffList = await strapi.entityService.findMany('plugin::users-permissions.user', {
            filters: { role_app: 'staff', is_approved: true },
            limit: -1,
        });
        const tasksByStatus = tasks.reduce((acc, task) => {
            var _a;
            acc[task.status_task] = ((_a = acc[task.status_task]) !== null && _a !== void 0 ? _a : 0) + 1;
            return acc;
        }, {});
        const now = new Date();
        const overdueProjects = projects.filter((project) => project.status_project === 'active' && new Date(project.deadline) < now);
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
                active: projects.filter((project) => project.status_project === 'active').length,
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
        return ctx.send(tasks.map((task) => {
            var _a, _b;
            return ({
                id: task.id,
                name: task.name,
                status_task: task.status_task,
                current_owner: task.current_owner
                    ? {
                        id: task.current_owner.id,
                        display_name: task.current_owner.display_name,
                        username: task.current_owner.username,
                    }
                    : null,
                created_at: task.createdAt,
                log_count: (_b = (_a = task.task_log) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0,
            });
        }));
    },
    async underReview(ctx) {
        var _a, _b;
        const user = ctx.state.user;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const tasks = await strapi.entityService.findMany('api::task.task', {
            filters: { status_task: 'under_review' },
            populate: ['current_owner', 'proof_images'],
            sort: { updatedAt: 'asc' },
            limit: -1,
        });
        const result = [];
        for (const task of tasks) {
            const latestProof = (_b = (_a = task.proof_images) === null || _a === void 0 ? void 0 : _a.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0]) !== null && _b !== void 0 ? _b : null;
            let imageUrl = null;
            if (latestProof === null || latestProof === void 0 ? void 0 : latestProof.image_url) {
                try {
                    imageUrl = await (0, supabase_1.resolveImageUrl)(latestProof.image_url);
                }
                catch {
                    imageUrl = null;
                }
            }
            result.push({
                id: task.id,
                name: task.name,
                current_owner: task.current_owner
                    ? { id: task.current_owner.id, display_name: task.current_owner.display_name }
                    : null,
                latest_proof: latestProof
                    ? {
                        image_url: imageUrl,
                        report_text: latestProof.report_text,
                        submitted_at: latestProof.submitted_at,
                    }
                    : null,
            });
        }
        return ctx.send(result);
    },
    async staffOverview(ctx) {
        var _a;
        const user = ctx.state.user;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const staffList = await strapi.entityService.findMany('plugin::users-permissions.user', {
            filters: { role_app: 'staff', is_approved: true },
            limit: -1,
        });
        const activeTasks = await strapi.entityService.findMany('api::task.task', {
            filters: { status_task: { $ne: 'done' } },
            populate: ['current_owner'],
            limit: -1,
        });
        const taskCount = {};
        for (const task of activeTasks) {
            if (task.current_owner) {
                taskCount[task.current_owner.id] = ((_a = taskCount[task.current_owner.id]) !== null && _a !== void 0 ? _a : 0) + 1;
            }
        }
        return ctx.send(staffList.map((member) => {
            var _a;
            return ({
                id: member.id,
                display_name: member.display_name,
                username: member.username,
                telegram_id: member.telegram_id,
                active_tasks: (_a = taskCount[member.id]) !== null && _a !== void 0 ? _a : 0,
            });
        }));
    },
    async staffKpi(ctx) {
        var _a, _b, _c, _d;
        const user = ctx.state.user;
        if (user.role_app !== 'manager')
            return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
        const days = normalizeRangeDays((_a = ctx.request.query) === null || _a === void 0 ? void 0 : _a.days);
        const now = new Date();
        const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const recentActivityStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const staffList = await strapi.entityService.findMany('plugin::users-permissions.user', {
            filters: { role_app: 'staff', is_approved: true },
            fields: ['id', 'display_name', 'username', 'telegram_id'],
            limit: -1,
            sort: ['display_name:asc', 'username:asc'],
        });
        const tasks = await strapi.entityService.findMany('api::task.task', {
            populate: ['current_owner', 'project', 'task_log'],
            limit: -1,
            sort: ['updatedAt:desc', 'id:desc'],
        });
        const staffMap = new Map();
        for (const member of staffList) {
            staffMap.set(member.id, createEmptyKpi(member));
        }
        for (const task of tasks) {
            const ownerId = Number((_b = task.current_owner) === null || _b === void 0 ? void 0 : _b.id);
            if (!staffMap.has(ownerId))
                continue;
            const entry = staffMap.get(ownerId);
            entry.tasks_total += 1;
            const logs = [...((_c = task.task_log) !== null && _c !== void 0 ? _c : [])].sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));
            if (task.status_task === 'in_progress')
                entry.active_in_progress += 1;
            if (task.status_task === 'under_review')
                entry.active_under_review += 1;
            if (task.status_task === 'waiting_pickup')
                entry.active_waiting_pickup += 1;
            if (task.status_task !== 'done')
                entry.active_tasks += 1;
            const lastActivityAt = getLastActivityAt(task, logs);
            if (task.status_task !== 'done') {
                if (lastActivityAt && lastActivityAt >= recentActivityStart) {
                    entry.active_updated_recently += 1;
                }
                else {
                    entry.stale_active_tasks += 1;
                }
            }
            const progressUpdates = logs.filter((log) => log.action === 'progress_update' && isWithinRange(log.createdAt, windowStart, now));
            entry.progress_updates += progressUpdates.length;
            const approvedLogs = logs.filter((log) => log.action === 'approved' && isWithinRange(log.createdAt, windowStart, now));
            const rejectedLogs = logs.filter((log) => log.action === 'rejected' && isWithinRange(log.createdAt, windowStart, now));
            entry.review_cycles += approvedLogs.length + rejectedLogs.length;
            entry.rejected_cycles += rejectedLogs.length;
            entry.completed_tasks += approvedLogs.length;
            for (const approvedLog of approvedLogs) {
                const approvedAt = new Date(String(approvedLog.createdAt));
                const createdAt = new Date(String(task.createdAt || approvedLog.createdAt));
                if (!Number.isNaN(createdAt.getTime()) && !Number.isNaN(approvedAt.getTime())) {
                    entry.total_completion_hours += Math.max(0, (approvedAt.getTime() - createdAt.getTime()) / 36e5);
                    entry.completion_samples += 1;
                }
                const deadline = ((_d = task.project) === null || _d === void 0 ? void 0 : _d.deadline) ? new Date(task.project.deadline) : null;
                if (deadline && !Number.isNaN(deadline.getTime())) {
                    entry.deadline_tracked_completed += 1;
                    if (approvedAt.getTime() <= deadline.getTime()) {
                        entry.on_time_completed += 1;
                    }
                }
            }
        }
        const outputTarget = Math.max(2, Math.round((days / 30) * 8));
        const result = Array.from(staffMap.values())
            .map((entry) => finalizeKpi(entry, { outputTarget }))
            .sort((a, b) => b.total_score - a.total_score || a.display_name.localeCompare(b.display_name, 'th'));
        return ctx.send({
            window_days: days,
            generated_at: now.toISOString(),
            formula_guide: buildFormulaGuide(days, outputTarget),
            staff: result,
        });
    },
}));
function normalizeRangeDays(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return 30;
    return Math.min(90, Math.max(7, Math.round(parsed)));
}
function toTime(value) {
    const time = new Date(String(value || '')).getTime();
    return Number.isNaN(time) ? 0 : time;
}
function isWithinRange(value, start, end) {
    const time = toTime(value);
    return time >= start.getTime() && time <= end.getTime();
}
function getLastActivityAt(task, logs) {
    var _a;
    const latestLog = (_a = logs[logs.length - 1]) === null || _a === void 0 ? void 0 : _a.createdAt;
    if (latestLog) {
        const date = new Date(latestLog);
        if (!Number.isNaN(date.getTime()))
            return date;
    }
    const fallback = task.updatedAt || task.createdAt;
    if (!fallback)
        return null;
    const date = new Date(fallback);
    return Number.isNaN(date.getTime()) ? null : date;
}
function createEmptyKpi(member) {
    return {
        id: member.id,
        display_name: member.display_name || member.username || `Staff #${member.id}`,
        username: member.username || '',
        telegram_id: member.telegram_id || '',
        tasks_total: 0,
        completed_tasks: 0,
        review_cycles: 0,
        rejected_cycles: 0,
        active_tasks: 0,
        active_in_progress: 0,
        active_under_review: 0,
        active_waiting_pickup: 0,
        active_updated_recently: 0,
        stale_active_tasks: 0,
        progress_updates: 0,
        on_time_completed: 0,
        deadline_tracked_completed: 0,
        total_completion_hours: 0,
        completion_samples: 0,
    };
}
function finalizeKpi(entry, config) {
    const rejectionRate = entry.review_cycles > 0
        ? round((entry.rejected_cycles / entry.review_cycles) * 100)
        : 0;
    const onTimeRate = entry.deadline_tracked_completed > 0
        ? round((entry.on_time_completed / entry.deadline_tracked_completed) * 100)
        : null;
    const avgCompletionHours = entry.completion_samples > 0
        ? round(entry.total_completion_hours / entry.completion_samples)
        : null;
    const updateRate = entry.active_tasks > 0
        ? round((entry.active_updated_recently / entry.active_tasks) * 100)
        : 100;
    const outputScore = Math.min(100, round((entry.completed_tasks / config.outputTarget) * 100));
    const qualityScore = scoreQuality(rejectionRate, entry.review_cycles);
    const onTimeScore = scoreOnTime(onTimeRate, entry.deadline_tracked_completed);
    const speedScore = scoreSpeed(avgCompletionHours, entry.completion_samples);
    const updateScore = scoreUpdate(updateRate, entry.active_tasks);
    const totalScore = round(outputScore * 0.2
        + qualityScore * 0.3
        + onTimeScore * 0.2
        + speedScore * 0.15
        + updateScore * 0.15);
    return {
        ...entry,
        rejection_rate: rejectionRate,
        on_time_rate: onTimeRate,
        avg_completion_hours: avgCompletionHours,
        update_rate: updateRate,
        output_target: config.outputTarget,
        output_score: outputScore,
        quality_score: qualityScore,
        on_time_score: onTimeScore,
        speed_score: speedScore,
        update_score: updateScore,
        total_score: totalScore,
        status: getKpiStatus(totalScore),
        focus_note: buildFocusNote({
            rejectionRate,
            onTimeRate,
            avgCompletionHours,
            updateRate,
            activeTasks: entry.active_tasks,
            staleActiveTasks: entry.stale_active_tasks,
            completedTasks: entry.completed_tasks,
            outputTarget: config.outputTarget,
        }),
    };
}
function scoreQuality(rejectionRate, reviewedCount) {
    if (reviewedCount === 0)
        return 80;
    if (rejectionRate <= 10)
        return 100;
    if (rejectionRate <= 20)
        return 85;
    if (rejectionRate <= 30)
        return 70;
    return 50;
}
function scoreOnTime(onTimeRate, trackedCount) {
    if (trackedCount === 0 || onTimeRate === null)
        return 80;
    if (onTimeRate >= 90)
        return 100;
    if (onTimeRate >= 75)
        return 85;
    if (onTimeRate >= 60)
        return 70;
    return 50;
}
function scoreSpeed(avgHours, sampleCount) {
    if (sampleCount === 0 || avgHours === null)
        return 75;
    if (avgHours <= 48)
        return 100;
    if (avgHours <= 96)
        return 85;
    if (avgHours <= 168)
        return 70;
    return 50;
}
function scoreUpdate(updateRate, activeTasks) {
    if (activeTasks === 0)
        return 100;
    if (updateRate >= 90)
        return 100;
    if (updateRate >= 75)
        return 85;
    if (updateRate >= 60)
        return 70;
    return 45;
}
function getKpiStatus(totalScore) {
    if (totalScore >= 85)
        return { label: 'ดีมาก', tone: 'green' };
    if (totalScore >= 70)
        return { label: 'ดี', tone: 'blue' };
    if (totalScore >= 55)
        return { label: 'เฝ้าดู', tone: 'amber' };
    return { label: 'เร่งติดตาม', tone: 'red' };
}
function buildFocusNote(input) {
    if (input.rejectionRate > 20)
        return 'งานถูกส่งกลับค่อนข้างบ่อย ควรช่วยดูคุณภาพก่อนส่ง';
    if (input.onTimeRate !== null && input.onTimeRate < 75)
        return 'งานเสร็จไม่ค่อยทันเวลา ควรช่วยจัดลำดับความสำคัญ';
    if (input.activeTasks > 0 && input.updateRate < 75)
        return 'งานที่เปิดอยู่ยังอัปเดตไม่สม่ำเสมอ ควรติดตามความคืบหน้า';
    if (input.avgCompletionHours !== null && input.avgCompletionHours > 168)
        return 'ใช้เวลาปิดงานค่อนข้างนาน ควรช่วยปลด blocker';
    if (input.completedTasks < input.outputTarget * 0.5)
        return 'จำนวนงานที่ปิดได้ยังต่ำกว่าเป้าช่วงนี้';
    if (input.staleActiveTasks > 0)
        return 'ยังมีงานค้างที่ไม่ค่อยขยับ ควรเปิดดูงานค้างล่าสุด';
    return 'ภาพรวมค่อนข้างนิ่ง ทำงานต่อเนื่องดี';
}
function buildFormulaGuide(days, outputTarget) {
    return {
        window_label: `ย้อนหลัง ${days} วัน`,
        weights: [
            { key: 'output', label: 'ปริมาณงานปิดสำเร็จ', weight: 20, formula: `งานที่อนุมัติแล้ว / เป้า ${outputTarget} งาน` },
            { key: 'quality', label: 'คุณภาพงาน', weight: 30, formula: '100 - อัตรางานตีกลับตามช่วง threshold' },
            { key: 'on_time', label: 'ตรงเวลา', weight: 20, formula: 'งานที่อนุมัติก่อน deadline / งานที่มี deadline' },
            { key: 'speed', label: 'ความเร็วเฉลี่ย', weight: 15, formula: 'เวลาตั้งแต่สร้างงานจนอนุมัติ (ชั่วโมงเฉลี่ย)' },
            { key: 'update', label: 'ความสม่ำเสมอในการอัปเดต', weight: 15, formula: 'งานที่ยัง active และมีความเคลื่อนไหวใน 7 วัน / งาน active ทั้งหมด' },
        ],
        thresholds: {
            quality: [
                'ตีกลับ <= 10% = 100 คะแนน',
                'ตีกลับ 11-20% = 85 คะแนน',
                'ตีกลับ 21-30% = 70 คะแนน',
                'ตีกลับ > 30% = 50 คะแนน',
            ],
            on_time: [
                'ตรงเวลา >= 90% = 100 คะแนน',
                '75-89% = 85 คะแนน',
                '60-74% = 70 คะแนน',
                '< 60% = 50 คะแนน',
            ],
            speed: [
                'ปิดงานเฉลี่ย <= 48 ชม. = 100 คะแนน',
                '49-96 ชม. = 85 คะแนน',
                '97-168 ชม. = 70 คะแนน',
                '> 168 ชม. = 50 คะแนน',
            ],
            update: [
                'อัปเดตงาน active ใน 7 วัน >= 90% = 100 คะแนน',
                '75-89% = 85 คะแนน',
                '60-74% = 70 คะแนน',
                '< 60% = 45 คะแนน',
            ],
            total: [
                'รวม >= 85 = ดีมาก',
                '70-84 = ดี',
                '55-69 = เฝ้าดู',
                '< 55 = เร่งติดตาม',
            ],
        },
    };
}
function round(value) {
    return Math.round(value * 10) / 10;
}
