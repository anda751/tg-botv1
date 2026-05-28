import { factories } from '@strapi/strapi';

// ใช้ Map เก็บสถานะรอเหตุผลจากการกดปุ่มใน Telegram
// key = telegram_user_id, value = taskId/userId + เวลาหมดอายุ
const rejectPendingMap = new Map<string, { taskId: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rejectPendingMap.entries()) {
    if (now > val.expiresAt) rejectPendingMap.delete(key);
  }
}, 10 * 60 * 1000);

export default factories.createCoreController('api::task.task', ({ strapi }) => ({
  async webhook(ctx) {
    const update = ctx.request.body as TelegramUpdate;

    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, strapi);
      ctx.status = 200;
      return ctx.send({ ok: true });
    }

    if (update.message) {
      await handleMessage(update.message, strapi);
      ctx.status = 200;
      return ctx.send({ ok: true });
    }

    ctx.status = 200;
    return ctx.send({ ok: true });
  },
}));

async function handleCallbackQuery(query: TelegramCallbackQuery, strapi: any) {
  const { data, from, message, id: callbackQueryId } = query;
  if (!data) return;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  await answerCallbackQuery(botToken, callbackQueryId);

  const [action, targetId] = data.split(':');

  const managers = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { telegram_id: String(from.id), role_app: 'manager' }, limit: 1 },
  ) as any[];

  if (!managers.length) {
    await sendMessage(botToken, from.id, 'คุณไม่มีสิทธิ์ดำเนินการรายการนี้');
    return;
  }

  const manager = managers[0];

  if (action === 'approve') {
    await approveTask(targetId, manager, strapi, botToken, from.id, message);
  } else if (action === 'reject') {
    rejectPendingMap.set(String(from.id), {
      taskId: targetId,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    await sendMessage(botToken, from.id, 'กรุณาพิมพ์เหตุผลสำหรับการส่งกลับงาน อย่างน้อย 5 ตัวอักษร');
  } else if (action === 'approve_handover') {
    await approveHandover(targetId, manager, strapi, botToken, from.id, message);
  } else if (action === 'reject_handover') {
    await rejectHandover(targetId, manager, strapi, botToken, from.id, message);
  } else if (action === 'approve_user') {
    await approveUserFromTelegram(targetId, manager, strapi, botToken, from.id, message);
  } else if (action === 'reject_user') {
    rejectPendingMap.set(String(from.id), {
      taskId: `user:${targetId}`,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    await sendMessage(botToken, from.id, 'กรุณาพิมพ์เหตุผลสำหรับการปฏิเสธพนักงาน อย่างน้อย 5 ตัวอักษร');
  }
}

async function handleMessage(message: TelegramMessage, strapi: any) {
  const { from, text, chat } = message;
  if (!text || !from) return;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const userId = String(from.id);
  const pending = rejectPendingMap.get(userId);

  if (pending) {
    if (Date.now() > pending.expiresAt) {
      rejectPendingMap.delete(userId);
      await sendMessage(botToken, chat.id, 'หมดเวลาแล้ว กรุณากดปุ่มเดิมอีกครั้งหากต้องการดำเนินการต่อ');
      return;
    }

    if (text.length < 5) {
      await sendMessage(botToken, chat.id, 'เหตุผลต้องมีอย่างน้อย 5 ตัวอักษร กรุณาพิมพ์ใหม่');
      return;
    }

    const managers = await strapi.entityService.findMany(
      'plugin::users-permissions.user',
      { filters: { telegram_id: userId, role_app: 'manager' }, limit: 1 },
    ) as any[];

    if (managers.length) {
      if (pending.taskId.startsWith('user:')) {
        const targetUserId = pending.taskId.replace('user:', '');
        await rejectUserFromTelegram(targetUserId, text, strapi, botToken, chat.id);
      } else {
        await rejectTask(pending.taskId, text, managers[0], strapi, botToken, chat.id);
      }
      rejectPendingMap.delete(userId);
    }
    return;
  }

  if (text === '/start') {
    await sendMessage(
      botToken,
      chat.id,
      [
        `สวัสดีครับ ${from.first_name}`,
        'บอตนี้ใช้แจ้งเตือนงานและอนุมัติรายการสำคัญให้หัวหน้า',
        'หากต้องการจัดการงานทั้งหมด สามารถเข้า Mini App ได้เลย',
      ].join('\n'),
    );
  }
}

async function approveTask(
  taskId: string,
  manager: any,
  strapi: any,
  botToken: string,
  chatId: number,
  originalMessage?: TelegramMessage,
) {
  const task = await strapi.entityService.findOne('api::task.task', taskId, {
    populate: ['current_owner'],
  }) as any;

  if (!task) {
    await sendMessage(botToken, chatId, 'ไม่พบงานนี้');
    return;
  }
  if (task.status_task !== 'under_review') {
    await sendMessage(botToken, chatId, `งาน *${task.name}* ไม่ได้อยู่ในสถานะรอตรวจแล้ว`);
    return;
  }

  await strapi.entityService.update('api::task.task', taskId, { data: { status_task: 'done' } });
  await strapi.entityService.create('api::task-log.task-log', {
    data: { task: taskId, action: 'approved', actor: manager.id },
  });

  if (originalMessage) {
    await editMessageReplyMarkup(botToken, chatId, originalMessage.message_id, null);
  }

  await sendMessage(botToken, chatId, [
    'อนุมัติงานเรียบร้อย',
    `งาน: *${task.name}*`,
    `ผู้ส่งงาน: *${task.current_owner.username}*`,
  ].join('\n'));
  await strapi.service('api::task.task').notifyStaff({
    userId: task.current_owner.id,
    title: 'งานเสร็จแล้ว',
    message: `หัวหน้าอนุมัติงาน "${task.name}" แล้ว`,
  });
  await strapi.service('api::task.task').notifyGroup({
    message: `งานเสร็จสมบูรณ์: *${task.name}*\nผู้รับผิดชอบ: ${task.current_owner.username}`,
  });
}

async function rejectTask(
  taskId: string,
  reason: string,
  manager: any,
  strapi: any,
  botToken: string,
  chatId: number,
) {
  const task = await strapi.entityService.findOne('api::task.task', taskId, {
    populate: ['current_owner'],
  }) as any;

  if (!task) {
    await sendMessage(botToken, chatId, 'ไม่พบงานนี้');
    return;
  }

  await strapi.entityService.update('api::task.task', taskId, { data: { status_task: 'in_progress' } });
  await strapi.entityService.create('api::task-log.task-log', {
    data: { task: taskId, action: 'rejected', actor: manager.id, note: reason },
  });

  await sendMessage(botToken, chatId, [
    'ส่งกลับงานเรียบร้อย',
    `งาน: *${task.name}*`,
    '',
    `เหตุผล: ${reason}`,
  ].join('\n'));
  await strapi.service('api::task.task').notifyStaff({
    userId: task.current_owner.id,
    title: 'งานถูกส่งกลับ',
    message: `งาน "${task.name}" ถูกส่งกลับ\nเหตุผล: ${reason}`,
  });
}

async function approveHandover(
  handoverId: string,
  manager: any,
  strapi: any,
  botToken: string,
  chatId: number,
  originalMessage?: TelegramMessage,
) {
  const handover = await strapi.entityService.findOne(
    'api::handover-request.handover-request',
    handoverId,
    { populate: ['task', 'requested_by', 'picked_up_by'] },
  ) as any;

  if (!handover || handover.status_handover !== 'pending') {
    await sendMessage(botToken, chatId, 'คำขอนี้ไม่สามารถอนุมัติได้แล้ว');
    return;
  }
  if (!handover.picked_up_by) {
    await sendMessage(botToken, chatId, 'ยังไม่มีคนขอรับงานนี้');
    return;
  }

  await strapi.entityService.update('api::task.task', handover.task.id, {
    data: { current_owner: handover.picked_up_by.id, status_task: 'in_progress' },
  });
  await strapi.entityService.update('api::handover-request.handover-request', handoverId, {
    data: { status_handover: 'approved' },
  });
  await strapi.entityService.create('api::task-log.task-log', {
    data: {
      task: handover.task.id,
      action: 'picked_up',
      actor: handover.picked_up_by.id,
      note: `รับงานต่อจาก ${handover.requested_by.username}`,
    },
  });

  if (originalMessage) {
    await editMessageReplyMarkup(botToken, chatId, originalMessage.message_id, null);
  }

  await sendMessage(botToken, chatId, [
    'อนุมัติคำขอรับช่วงต่องานเรียบร้อย',
    `งาน: *${handover.task.name}*`,
    `ผู้รับงาน: *${handover.picked_up_by.username}*`,
  ].join('\n'));
  await strapi.service('api::task.task').notifyStaff({
    userId: handover.picked_up_by.id,
    title: 'ได้รับงานต่อแล้ว',
    message: `หัวหน้าอนุมัติแล้ว งาน "${handover.task.name}" เป็นของคุณแล้ว`,
  });
  await strapi.service('api::task.task').notifyGroup({
    message: `งาน *${handover.task.name}* ส่งต่อให้ ${handover.picked_up_by.username} เรียบร้อย`,
  });
}

async function rejectHandover(
  handoverId: string,
  manager: any,
  strapi: any,
  botToken: string,
  chatId: number,
  originalMessage?: TelegramMessage,
) {
  const handover = await strapi.entityService.findOne(
    'api::handover-request.handover-request',
    handoverId,
    { populate: ['task', 'requested_by', 'picked_up_by'] },
  ) as any;

  if (!handover || handover.status_handover !== 'pending') {
    await sendMessage(botToken, chatId, 'คำขอนี้ไม่สามารถปฏิเสธได้แล้ว');
    return;
  }
  if (!handover.picked_up_by) {
    await sendMessage(botToken, chatId, 'ยังไม่มีคนขอรับงานนี้');
    return;
  }

  await strapi.entityService.update('api::handover-request.handover-request', handoverId, {
    data: { picked_up_by: null },
  });
  await strapi.entityService.create('api::task-log.task-log', {
    data: {
      task: handover.task.id,
      action: 'handover',
      actor: manager.id,
      note: `ปฏิเสธการรับช่วงต่อของ ${handover.picked_up_by.username}`,
    },
  });

  if (originalMessage) {
    await editMessageReplyMarkup(botToken, chatId, originalMessage.message_id, null);
  }

  await sendMessage(botToken, chatId, [
    'ปฏิเสธคำขอรับช่วงต่องานเรียบร้อย',
    `งาน: *${handover.task.name}*`,
    `ผู้ขอรับงาน: *${handover.picked_up_by.username}*`,
  ].join('\n'));
  await strapi.service('api::task.task').notifyStaff({
    userId: handover.picked_up_by.id,
    title: 'คำขอรับช่วงต่องานยังไม่ผ่าน',
    message: `หัวหน้ายังไม่อนุมัติคำขอรับช่วงต่องาน "${handover.task.name}"`,
    type: 'handover',
    link: '/pickup',
  });
}

async function approveUserFromTelegram(
  userId: string,
  _manager: any,
  strapi: any,
  botToken: string,
  chatId: number,
  originalMessage?: TelegramMessage,
) {
  const target = await strapi.entityService.findOne(
    'plugin::users-permissions.user',
    userId,
  ) as any;

  if (!target) {
    await sendMessage(botToken, chatId, 'ไม่พบผู้ใช้นี้');
    return;
  }
  if (target.is_approved) {
    await sendMessage(botToken, chatId, `พนักงาน *${target.display_name}* ได้รับอนุมัติแล้ว`);
    return;
  }

  await strapi.entityService.update('plugin::users-permissions.user', userId, {
    data: { is_approved: true },
  });

  if (originalMessage) {
    await editMessageReplyMarkup(botToken, chatId, originalMessage.message_id, null);
  }

  await sendMessage(botToken, chatId, [
    'อนุมัติพนักงานเรียบร้อย',
    `ชื่อ: *${target.display_name}*`,
  ].join('\n'));
  await strapi.service('api::task.task').notifyStaff({
    userId,
    title: 'เข้าใช้งานได้แล้ว',
    message: 'หัวหน้าอนุมัติแล้ว คุณสามารถเข้าใช้งานระบบได้เลย',
  });
}

async function rejectUserFromTelegram(
  userId: string,
  reason: string,
  strapi: any,
  botToken: string,
  chatId: number,
) {
  const target = await strapi.entityService.findOne(
    'plugin::users-permissions.user',
    userId,
  ) as any;

  if (!target) {
    await sendMessage(botToken, chatId, 'ไม่พบผู้ใช้นี้');
    return;
  }

  await strapi.service('api::task.task').notifyStaff({
    userId,
    title: 'คำขอเข้าใช้งานไม่ผ่าน',
    message: `คำขอเข้าใช้งานถูกปฏิเสธ\nเหตุผล: ${reason}`,
  });

  await strapi.entityService.delete('plugin::users-permissions.user', userId);

  await sendMessage(botToken, chatId, [
    'ปฏิเสธคำขอพนักงานเรียบร้อย',
    `ชื่อ: *${target.display_name}*`,
    '',
    `เหตุผล: ${reason}`,
  ].join('\n'));
}

async function sendMessage(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

async function editMessageReplyMarkup(
  botToken: string,
  chatId: number,
  messageId: number,
  replyMarkup: any,
) {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
  });
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: { id: number; type: string }
  text?: string
}

interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

interface TelegramUser {
  id: number
  first_name: string
  username?: string
}
