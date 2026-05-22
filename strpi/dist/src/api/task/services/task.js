"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreService('api::task.task', ({ strapi }) => ({
    async notifyGroup({ message }) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: groupChatId,
                text: message,
                parse_mode: 'Markdown',
            }),
        });
    },
    async notifyManager({ taskId, taskName, submittedBy, reportText, imageUrl, userId, }) {
        var _a;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const managerChatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
        if (imageUrl) {
            try {
                const photoResp = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: managerChatId,
                        photo: imageUrl,
                        // Plain caption avoids Markdown parser issues from user-generated text.
                        caption: `งานรอตรวจ: ${taskName}\nโดย: ${submittedBy}\n\nรายงาน:\n${reportText}`,
                    }),
                });
                const photoBody = await photoResp.json().catch(() => ({}));
                if (!photoResp.ok || (photoBody === null || photoBody === void 0 ? void 0 : photoBody.ok) === false) {
                    strapi.log.warn(`[notifyManager] sendPhoto failed: ${JSON.stringify(photoBody)}`);
                }
            }
            catch (error) {
                strapi.log.warn(`[notifyManager] sendPhoto error: ${(_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : 'unknown error'}`);
            }
        }
        const messageBody = {
            chat_id: managerChatId,
            text: taskName ? `📬 *${taskName}*\nจาก: ${submittedBy}\n\n${reportText}` : reportText,
            parse_mode: 'Markdown',
        };
        if (userId) {
            messageBody.reply_markup = {
                inline_keyboard: [[
                        { text: '✅ อนุมัติพนักงาน', callback_data: `approve_user:${userId}` },
                        { text: '❌ ปฏิเสธ', callback_data: `reject_user:${userId}` },
                    ]],
            };
        }
        else if (taskId) {
            messageBody.reply_markup = {
                inline_keyboard: [[
                        { text: '✅ อนุมัติ', callback_data: `approve:${taskId}` },
                        { text: '❌ ปฏิเสธ', callback_data: `reject:${taskId}` },
                    ]],
            };
        }
        const msgResp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageBody),
        });
        const msgBody = await msgResp.json().catch(() => ({}));
        if (!msgResp.ok || (msgBody === null || msgBody === void 0 ? void 0 : msgBody.ok) === false) {
            strapi.log.warn(`[notifyManager] sendMessage failed: ${JSON.stringify(msgBody)}`);
        }
    },
    async notifyManagerHandover({ handoverId, taskName, pickedUpBy, }) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const managerChatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: managerChatId,
                text: `🤝 *ขอรับงานต่อ*\nงาน: *${taskName}*\nผู้ขอรับ: ${pickedUpBy}\n\nกรุณาอนุมัติหรือปฏิเสธ`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                            { text: '✅ อนุมัติ', callback_data: `approve_handover:${handoverId}` },
                            { text: '❌ ปฏิเสธ', callback_data: `reject_handover:${handoverId}` },
                        ]],
                },
            }),
        });
    },
    async notifyStaff({ userId, message }) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId);
        if (!(user === null || user === void 0 ? void 0 : user.telegram_chat_id))
            return;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: user.telegram_chat_id,
                text: message,
                parse_mode: 'Markdown',
            }),
        });
    },
}));
