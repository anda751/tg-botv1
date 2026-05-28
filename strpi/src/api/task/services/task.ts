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

    const trimmedReport = reportText?.trim() || '-';
    const reviewCaption = [
      'มีงานรอตรวจ',
      `งาน: ${taskName}`,
      `ผู้ส่ง: ${submittedBy}`,
      '',
      'สรุปงาน:',
      trimmedReport,
    ].join('\n');

    const reviewMessage = [
      '📋 *มีงานรอตรวจ*',
      `งาน: *${taskName}*`,
      `ผู้ส่ง: *${submittedBy}*`,
      '',
      '*สรุปงาน*',
      trimmedReport,
      '',
      'กรุณาเลือก `อนุมัติ` หรือ `ส่งกลับ`',
    ].join('\n');

    const userApprovalMessage = [
      '👤 *มีคำขอเข้าระบบใหม่*',
      '',
      trimmedReport,
      '',
      'กรุณาเลือก `อนุมัติพนักงาน` หรือ `ปฏิเสธ`',
    ].join('\n');

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
        form.append('caption', reviewCaption);
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
          docForm.append('caption', reviewCaption);
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
            caption: reviewCaption,
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
      text: userId ? userApprovalMessage : reviewMessage,
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
          { text: 'ส่งกลับ', callback_data: `reject:${taskId}` },
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
        text: [
          '🤝 *มีคำขอรับช่วงต่องาน*',
          `งาน: *${taskName}*`,
          `ผู้ขอรับงาน: *${pickedUpBy}*`,
          '',
          'กรุณาเลือก `อนุมัติ` หรือ `ปฏิเสธ`',
        ].join('\n'),
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

  async notifyManagersInApp({
    title,
    message,
    type = 'general',
    link = '/',
  }: {
    title?: string;
    message: string;
    type?: 'task' | 'project' | 'handover' | 'general';
    link?: string;
  }) {
    const managers = await strapi.db.query('plugin::users-permissions.user' as any).findMany({
      where: {
        role_app: 'manager',
        is_approved: true,
      },
      select: ['id'],
    }) as Array<{ id: number }>;

    for (const manager of managers) {
      const managerId = Number(manager.id);
      if (!Number.isFinite(managerId) || managerId <= 0) continue;

      await strapi.db.query(notificationUid).create({
        data: {
          recipient: managerId,
          title: title?.trim() || 'มีอัปเดตใหม่',
          message: message.trim(),
          type,
          link,
          is_read: false,
          is_hidden: false,
        },
      });
    }
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
