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

  async notifyManager({ taskId, taskName, submittedBy, reportText, imageUrl, userId }: {
    taskId: string;
    taskName: string;
    submittedBy: string;
    reportText: string;
    imageUrl: string;
    userId?: string;
  }) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const managerChatId = process.env.TELEGRAM_MANAGER_CHAT_ID;

    if (imageUrl) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: managerChatId,
          photo: imageUrl,
          caption: `📬 งานรอตรวจ: *${taskName}*\nโดย: ${submittedBy}\n\n📝 รายงาน:\n${reportText}`,
          parse_mode: 'Markdown',
        }),
      });
    }

    const messageBody: any = {
      chat_id: managerChatId,
      text: taskName
        ? `📬 *${taskName}*\nจาก: ${submittedBy}\n\n${reportText}`
        : reportText,
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

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageBody),
    });
  },

  async notifyManagerHandover({ handoverId, taskName, pickedUpBy }: {
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