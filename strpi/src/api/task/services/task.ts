import { factories } from '@strapi/strapi';

const notificationUid = 'api::notification.notification' as any;

export default factories.createCoreService('api::task.task', ({ strapi }) => ({
  async notifyGroup({ message }: { message: string }) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
    if (!botToken || !groupChatId) return;

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

  async notifyManager({
    taskId,
    taskName,
    submittedBy,
    reportText,
    imageUrl,
    imageBuffer,
    imageFilename,
    imageMimeType,
    userId,
  }: {
    taskId: string;
    taskName: string;
    submittedBy: string;
    reportText: string;
    imageUrl: string;
    imageBuffer?: Buffer;
    imageFilename?: string;
    imageMimeType?: string;
    userId?: string;
  }) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const managerChatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
    if (!botToken || !managerChatId) return;

    const hasImageBuffer = !!imageBuffer && (
      ((imageBuffer as any).length ?? 0) > 0 ||
      ((imageBuffer as any).byteLength ?? 0) > 0
    );

    if (hasImageBuffer) {
      try {
        const FormDataCtor = (globalThis as any).FormData;
        const BlobCtor = (globalThis as any).Blob;
        const form: any = new FormDataCtor();
        const safeType = (imageMimeType || 'application/octet-stream').split(';')[0].trim();
        const filename = imageFilename || 'proof.jpg';
        form.append('chat_id', String(managerChatId || ''));
        form.append('caption', `งานรอตรวจ: ${taskName}\nโดย: ${submittedBy}\n\nรายงาน:\n${reportText}`);
        form.append('photo', new BlobCtor([imageBuffer], { type: safeType }), filename);

        const photoResp = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          body: form,
        });
        const photoBody: any = await photoResp.json().catch(() => ({}));
        if (!photoResp.ok || photoBody?.ok === false) {
          strapi.log.warn(`[notifyManager] sendPhoto failed: ${JSON.stringify(photoBody)}`);

          const docForm: any = new FormDataCtor();
          docForm.append('chat_id', String(managerChatId || ''));
          docForm.append('caption', `งานรอตรวจ: ${taskName}\nโดย: ${submittedBy}\n\nรายงาน:\n${reportText}`);
          docForm.append('document', new BlobCtor([imageBuffer], { type: safeType }), filename);
          const docResp = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
            method: 'POST',
            body: docForm,
          });
          const docBody: any = await docResp.json().catch(() => ({}));
          if (!docResp.ok || docBody?.ok === false) {
            strapi.log.warn(`[notifyManager] sendDocument fallback failed: ${JSON.stringify(docBody)}`);
          }
        }
      } catch (error: any) {
        strapi.log.warn(`[notifyManager] sendPhoto error: ${error?.message ?? 'unknown error'}`);
      }
    } else if (imageUrl) {
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
        const photoBody: any = await photoResp.json().catch(() => ({}));
        if (!photoResp.ok || photoBody?.ok === false) {
          strapi.log.warn(`[notifyManager] sendPhoto(url) failed: ${JSON.stringify(photoBody)}`);
        }
      } catch (error: any) {
        strapi.log.warn(`[notifyManager] sendPhoto(url) error: ${error?.message ?? 'unknown error'}`);
      }
    }

    const messageBody: any = {
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
    } else if (taskId) {
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
    const msgBody: any = await msgResp.json().catch(() => ({}));
    if (!msgResp.ok || msgBody?.ok === false) {
      strapi.log.warn(`[notifyManager] sendMessage failed: ${JSON.stringify(msgBody)}`);
    }
  },

  async notifyManagerHandover({
    handoverId,
    taskName,
    pickedUpBy,
  }: {
    handoverId: string;
    taskName: string;
    pickedUpBy: string;
  }) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const managerChatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
    if (!botToken || !managerChatId) return;

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

  async notifyStaff({
    userId,
    title,
    message,
    type = 'general',
    link = '/',
  }: {
    userId: string | number;
    title?: string;
    message: string;
    type?: 'task' | 'project' | 'handover' | 'general';
    link?: string;
  }) {
    const recipientId = Number(userId);
    if (!Number.isFinite(recipientId) || recipientId <= 0) return;

    // Notification policy:
    // - Telegram is used for manager notifications only.
    // - Staff updates are stored as in-app notifications.
    await strapi.db.query(notificationUid).create({
      data: {
        recipient: recipientId,
        title: title?.trim() || 'มีอัปเดตใหม่',
        message: message.trim(),
        type,
        link,
        is_read: false,
        is_hidden: false,
      },
    });
  },
}));
