"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
const notificationUid = 'api::notification.notification';
exports.default = strapi_1.factories.createCoreService('api::task.task', ({ strapi }) => ({
    async notifyGroup({ message }) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
        if (!botToken || !groupChatId)
            return;
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
    async notifyManager({ taskId, taskName, submittedBy, reportText, imageUrl, imageBuffer, imageFilename, imageMimeType, userId, }) {
        var _a, _b, _c, _d;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const managerChatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
        if (!botToken || !managerChatId)
            return;
        const hasImageBuffer = !!imageBuffer && (((_a = imageBuffer.length) !== null && _a !== void 0 ? _a : 0) > 0 ||
            ((_b = imageBuffer.byteLength) !== null && _b !== void 0 ? _b : 0) > 0);
        if (hasImageBuffer) {
            try {
                const FormDataCtor = globalThis.FormData;
                const BlobCtor = globalThis.Blob;
                const form = new FormDataCtor();
                const safeType = (imageMimeType || 'application/octet-stream').split(';')[0].trim();
                const filename = imageFilename || 'proof.jpg';
                form.append('chat_id', String(managerChatId || ''));
                form.append('caption', `งานรอตรวจ: ${taskName}\nโดย: ${submittedBy}\n\nรายงาน:\n${reportText}`);
                form.append('photo', new BlobCtor([imageBuffer], { type: safeType }), filename);
                const photoResp = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                    method: 'POST',
                    body: form,
                });
                const photoBody = await photoResp.json().catch(() => ({}));
                if (!photoResp.ok || (photoBody === null || photoBody === void 0 ? void 0 : photoBody.ok) === false) {
                    strapi.log.warn(`[notifyManager] sendPhoto failed: ${JSON.stringify(photoBody)}`);
                    const docForm = new FormDataCtor();
                    docForm.append('chat_id', String(managerChatId || ''));
                    docForm.append('caption', `งานรอตรวจ: ${taskName}\nโดย: ${submittedBy}\n\nรายงาน:\n${reportText}`);
                    docForm.append('document', new BlobCtor([imageBuffer], { type: safeType }), filename);
                    const docResp = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
                        method: 'POST',
                        body: docForm,
                    });
                    const docBody = await docResp.json().catch(() => ({}));
                    if (!docResp.ok || (docBody === null || docBody === void 0 ? void 0 : docBody.ok) === false) {
                        strapi.log.warn(`[notifyManager] sendDocument fallback failed: ${JSON.stringify(docBody)}`);
                    }
                }
            }
            catch (error) {
                strapi.log.warn(`[notifyManager] sendPhoto error: ${(_c = error === null || error === void 0 ? void 0 : error.message) !== null && _c !== void 0 ? _c : 'unknown error'}`);
            }
        }
        else if (imageUrl) {
            try {
                const photoResp = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: managerChatId,
                        photo: imageUrl,
                        caption: `งานรอตรวจ: ${taskName}\nโดย: ${submittedBy}\n\nรายงาน:\n${reportText}`,
                    }),
                });
                const photoBody = await photoResp.json().catch(() => ({}));
                if (!photoResp.ok || (photoBody === null || photoBody === void 0 ? void 0 : photoBody.ok) === false) {
                    strapi.log.warn(`[notifyManager] sendPhoto(url) failed: ${JSON.stringify(photoBody)}`);
                }
            }
            catch (error) {
                strapi.log.warn(`[notifyManager] sendPhoto(url) error: ${(_d = error === null || error === void 0 ? void 0 : error.message) !== null && _d !== void 0 ? _d : 'unknown error'}`);
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
                        { text: 'อนุมัติพนักงาน', callback_data: `approve_user:${userId}` },
                        { text: 'ปฏิเสธ', callback_data: `reject_user:${userId}` },
                    ]],
            };
        }
        else if (taskId) {
            messageBody.reply_markup = {
                inline_keyboard: [[
                        { text: 'อนุมัติ', callback_data: `approve:${taskId}` },
                        { text: 'ปฏิเสธ', callback_data: `reject:${taskId}` },
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
        if (!botToken || !managerChatId)
            return;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: managerChatId,
                text: `🤝 *ขอรับงานต่อ*\nงาน: *${taskName}*\nผู้ขอรับ: ${pickedUpBy}\n\nกรุณาอนุมัติหรือปฏิเสธ`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                            { text: 'อนุมัติ', callback_data: `approve_handover:${handoverId}` },
                            { text: 'ปฏิเสธ', callback_data: `reject_handover:${handoverId}` },
                        ]],
                },
            }),
        });
    },
    async notifyStaff({ userId, title, message, type = 'general', link = '/', }) {
        const recipientId = Number(userId);
        if (!Number.isFinite(recipientId) || recipientId <= 0)
            return;
        // Notification policy:
        // - Telegram is used for manager notifications only.
        // - Staff updates are stored as in-app notifications.
        await strapi.entityService.create(notificationUid, {
            data: {
                recipient: recipientId,
                title: (title === null || title === void 0 ? void 0 : title.trim()) || 'มีอัปเดตใหม่',
                message: message.trim(),
                type,
                link,
                is_read: false,
                is_hidden: false,
            },
        });
    },
}));
