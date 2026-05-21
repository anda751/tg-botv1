"use strict";
// path: /config/cron-tasks.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * ===== Handover Timeout ทุก 5 นาที =====
     */
    '*/5 * * * *': {
        task: async ({ strapi }) => {
            try {
                strapi.log.info('[Cron] Handover timeout running...');
                const now = new Date();
                const expiredHandovers = await strapi.entityService.findMany('api::handover-request.handover-request', {
                    filters: {
                        status_handover: 'pending',
                        expires_at: { $lt: now },
                    },
                    populate: ['task', 'requested_by'],
                });
                for (const handover of expiredHandovers) {
                    try {
                        if (!handover.task)
                            continue;
                        // update handover
                        await strapi.entityService.update('api::handover-request.handover-request', handover.id, {
                            data: {
                                status_handover: 'timeout',
                            },
                        });
                        // reset task status
                        await strapi.entityService.update('api::task.task', handover.task.id, {
                            data: {
                                status_task: 'waiting_pickup',
                            },
                        });
                        // notify requester
                        if (handover.requested_by) {
                            await strapi
                                .service('api::task.task')
                                .notifyStaff({
                                userId: handover.requested_by.id,
                                message: `⏰ คำขอรับงาน *${handover.task.name}* หมดเวลาแล้ว (30 นาที)\n` +
                                    `งานยังรอคนรับอยู่`,
                            });
                        }
                        // notify group
                        await strapi
                            .service('api::task.task')
                            .notifyGroup({
                            message: `⏰ คำขอรับงาน *${handover.task.name}* หมดเวลา\n` +
                                `งานยังรอคนรับอยู่`,
                        });
                        strapi.log.info(`[Cron] Handover timeout: task ${handover.task.id}`);
                    }
                    catch (err) {
                        strapi.log.error(`[Cron] Error processing handover ${handover.id}`, err);
                    }
                }
            }
            catch (err) {
                strapi.log.error('[Cron] Handover timeout failed', err);
            }
        },
        options: {
            tz: 'Asia/Bangkok',
        },
    },
    /**
     * ===== Morning Summary ทุกวัน 08:00 =====
     */
    '0 8 * * *': {
        task: async ({ strapi }) => {
            try {
                strapi.log.info('[Cron] Morning summary running...');
                const pendingTasks = await strapi.entityService.findMany('api::task.task', {
                    filters: {
                        status_task: {
                            $in: [
                                'in_progress',
                                'waiting_pickup',
                                'under_review',
                            ],
                        },
                    },
                    populate: ['current_owner'],
                });
                // ไม่มีงานค้าง
                if (!pendingTasks.length) {
                    await strapi
                        .service('api::task.task')
                        .notifyGroup({
                        message: `☀️ *สรุปงานประจำวัน*\n\n` +
                            `ไม่มีงานตกค้าง ทุกอย่างเรียบร้อย! 🎉`,
                    });
                    return;
                }
                const inProgress = pendingTasks.filter((t) => t.status_task === 'in_progress');
                const waitingPickup = pendingTasks.filter((t) => t.status_task === 'waiting_pickup');
                const underReview = pendingTasks.filter((t) => t.status_task === 'under_review');
                let message = `☀️ *สรุปงานประจำวัน*\n\n`;
                // in progress
                if (inProgress.length) {
                    message += `🔵 *กำลังดำเนินการ (${inProgress.length} งาน)*\n`;
                    inProgress.forEach((t) => {
                        var _a, _b;
                        message +=
                            `• ${t.name} → ` +
                                `${(_b = (_a = t.current_owner) === null || _a === void 0 ? void 0 : _a.username) !== null && _b !== void 0 ? _b : 'ไม่มีผู้รับผิดชอบ'}\n`;
                    });
                    message += '\n';
                }
                // waiting pickup
                if (waitingPickup.length) {
                    message +=
                        `🟡 *รอคนรับช่วงต่อ (${waitingPickup.length} งาน)*\n`;
                    waitingPickup.forEach((t) => {
                        message += `• ${t.name}\n`;
                    });
                    message += '\n';
                }
                // under review
                if (underReview.length) {
                    message +=
                        `🟠 *รอหัวหน้าตรวจ (${underReview.length} งาน)*\n`;
                    underReview.forEach((t) => {
                        var _a, _b;
                        message +=
                            `• ${t.name} → ` +
                                `ส่งโดย ${(_b = (_a = t.current_owner) === null || _a === void 0 ? void 0 : _a.username) !== null && _b !== void 0 ? _b : '-'}\n`;
                    });
                }
                await strapi
                    .service('api::task.task')
                    .notifyGroup({ message });
                strapi.log.info(`[Cron] Morning summary sent: ${pendingTasks.length} tasks`);
            }
            catch (err) {
                strapi.log.error('[Cron] Morning summary failed', err);
            }
        },
        options: {
            tz: 'Asia/Bangkok',
        },
    },
    /**
     * ===== Deadline Alert ทุก 1 ชั่วโมง =====
     */
    '5 * * * *': {
        task: async ({ strapi }) => {
            try {
                strapi.log.info('[Cron] Deadline alert running...');
                const now = new Date();
                const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                /**
                 * ===== ใกล้ deadline =====
                 */
                const projects = await strapi.entityService.findMany('api::project.project', {
                    filters: {
                        deadline: {
                            $gt: now,
                            $lt: soon,
                        },
                        status_project: 'active',
                    },
                });
                for (const project of projects) {
                    try {
                        const hoursLeft = Math.max(0, Math.floor((new Date(project.deadline).getTime() -
                            now.getTime()) /
                            (1000 * 60 * 60)));
                        await strapi
                            .service('api::task.task')
                            .notifyGroup({
                            message: `⚠️ *ใกล้ถึงเดดไลน์!*\n` +
                                `โปรเจกต์: *${project.name}*\n` +
                                `เหลือเวลา: ${hoursLeft} ชั่วโมง`,
                        });
                    }
                    catch (err) {
                        strapi.log.error(`[Cron] Error notifying project ${project.id}`, err);
                    }
                }
                /**
                 * ===== Overdue =====
                 */
                const overdueProjects = await strapi.entityService.findMany('api::project.project', {
                    filters: {
                        deadline: { $lt: now },
                        status_project: 'active',
                    },
                });
                for (const project of overdueProjects) {
                    try {
                        const overdueTasks = await strapi.entityService.findMany('api::task.task', {
                            filters: {
                                project: {
                                    id: {
                                        $eq: project.id,
                                    },
                                },
                                status_task: {
                                    $ne: 'done',
                                },
                            },
                            populate: ['current_owner'],
                        });
                        if (!overdueTasks.length)
                            continue;
                        let message = `🚨 *OVERDUE!*\n` +
                            `โปรเจกต์: *${project.name}*\n\n`;
                        overdueTasks.forEach((t) => {
                            var _a, _b;
                            message +=
                                `• ${t.name} → ` +
                                    `${(_b = (_a = t.current_owner) === null || _a === void 0 ? void 0 : _a.username) !== null && _b !== void 0 ? _b : 'ไม่มีผู้รับผิดชอบ'}\n`;
                        });
                        await strapi
                            .service('api::task.task')
                            .notifyGroup({ message });
                    }
                    catch (err) {
                        strapi.log.error(`[Cron] Error overdue project ${project.id}`, err);
                    }
                }
                strapi.log.info('[Cron] Deadline alert checked');
            }
            catch (err) {
                strapi.log.error('[Cron] Deadline alert failed', err);
            }
        },
        options: {
            tz: 'Asia/Bangkok',
        },
    },
};
