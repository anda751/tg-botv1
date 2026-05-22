import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::task.task', ({ strapi }) => ({
  async notifyGroup({ message }: { message: string }) {
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

    if (imageBuffer?.length) {
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
          { text: '✅ อนุมัติพนักงาน', callback_data: `approve_user:${userId}` },
          { text: '❌ ปฏิเสธ', callback_data: `reject_user:${userId}` },
        ]],
      };
    } else if (taskId) {
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

  async notifyStaff({ userId, message }: { userId: string; message: string }) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    const user = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      userId,
    ) as any;

    if (!user?.telegram_chat_id) return;

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
