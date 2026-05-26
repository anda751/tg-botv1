import { factories } from '@strapi/strapi';

const notificationUid = 'api::notification.notification' as any;

export default factories.createCoreController(notificationUid, ({ strapi }) => ({
  async my(ctx) {
    const user = ctx.state.user;
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const notifications = await strapi.db.query(notificationUid).findMany({
      where: {
        recipient: user.id,
        is_hidden: false,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      limit: 20,
    }) as any[];

    return ctx.send(notifications.map(serializeNotification));
  },

  async hidden(ctx) {
    const user = ctx.state.user;
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const notifications = await strapi.db.query(notificationUid).findMany({
      where: {
        recipient: user.id,
        is_hidden: true,
      },
      orderBy: [{ hidden_at: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      limit: 20,
    }) as any[];

    return ctx.send(notifications.map(serializeNotification));
  },

  async markRead(ctx) {
    const user = ctx.state.user;
    const notificationId = Number(ctx.params.id);
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');
    if (!Number.isFinite(notificationId)) return ctx.badRequest('รูปแบบการแจ้งเตือนไม่ถูกต้อง');

    const notification = await strapi.db.query(notificationUid).findOne({
      where: { id: notificationId },
      populate: { recipient: true },
    }) as any;

    if (!notification) return ctx.notFound('ไม่พบการแจ้งเตือน');
    if (notification.recipient?.id !== user.id) return ctx.forbidden('คุณไม่มีสิทธิ์เข้าถึงการแจ้งเตือนนี้');

    const updated = await strapi.db.query(notificationUid).update({
      where: { id: notificationId },
      data: {
        is_read: true,
        read_at: notification.read_at ?? new Date(),
      },
    }) as any;

    return ctx.send({
      message: 'อัปเดตสถานะการแจ้งเตือนแล้ว',
      notification: serializeNotification(updated),
    });
  },

  async markAllRead(ctx) {
    const user = ctx.state.user;
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const notifications = await strapi.db.query(notificationUid).findMany({
      where: {
        recipient: user.id,
        is_read: false,
        is_hidden: false,
      },
      select: ['id'],
    }) as any[];

    for (const notification of notifications) {
      await strapi.db.query(notificationUid).update({
        where: { id: Number(notification.id) },
        data: {
          is_read: true,
          read_at: new Date(),
        },
      });
    }

    return ctx.send({
      message: 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมดเรียบร้อย',
      count: notifications.length,
    });
  },

  async hide(ctx) {
    const user = ctx.state.user;
    const notificationId = Number(ctx.params.id);
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');
    if (!Number.isFinite(notificationId)) return ctx.badRequest('รูปแบบการแจ้งเตือนไม่ถูกต้อง');

    const notification = await strapi.db.query(notificationUid).findOne({
      where: { id: notificationId },
      populate: { recipient: true },
    }) as any;

    if (!notification) return ctx.notFound('ไม่พบการแจ้งเตือน');
    if (notification.recipient?.id !== user.id) return ctx.forbidden('คุณไม่มีสิทธิ์เข้าถึงการแจ้งเตือนนี้');

    const updated = await strapi.db.query(notificationUid).update({
      where: { id: notificationId },
      data: {
        is_hidden: true,
        hidden_at: notification.hidden_at ?? new Date(),
      },
    }) as any;

    return ctx.send({
      message: 'ซ่อนการแจ้งเตือนเรียบร้อย',
      notification: serializeNotification(updated),
    });
  },

  async hideRead(ctx) {
    const user = ctx.state.user;
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const notifications = await strapi.db.query(notificationUid).findMany({
      where: {
        recipient: user.id,
        is_hidden: false,
        is_read: true,
      },
      select: ['id'],
    }) as any[];

    for (const notification of notifications) {
      await strapi.db.query(notificationUid).update({
        where: { id: Number(notification.id) },
        data: {
          is_hidden: true,
          hidden_at: new Date(),
        },
      });
    }

    return ctx.send({
      message: 'ซ่อนรายการที่อ่านแล้วเรียบร้อย',
      count: notifications.length,
    });
  },

  async restore(ctx) {
    const user = ctx.state.user;
    const notificationId = Number(ctx.params.id);
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');
    if (!Number.isFinite(notificationId)) return ctx.badRequest('รูปแบบการแจ้งเตือนไม่ถูกต้อง');

    const notification = await strapi.db.query(notificationUid).findOne({
      where: { id: notificationId },
      populate: { recipient: true },
    }) as any;

    if (!notification) return ctx.notFound('ไม่พบการแจ้งเตือน');
    if (notification.recipient?.id !== user.id) return ctx.forbidden('คุณไม่มีสิทธิ์เข้าถึงการแจ้งเตือนนี้');

    const updated = await strapi.db.query(notificationUid).update({
      where: { id: notificationId },
      data: {
        is_hidden: false,
        hidden_at: null,
      },
    }) as any;

    return ctx.send({
      message: 'กู้คืนการแจ้งเตือนเรียบร้อย',
      notification: serializeNotification(updated),
    });
  },

  async restoreAll(ctx) {
    const user = ctx.state.user;
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const notifications = await strapi.db.query(notificationUid).findMany({
      where: {
        recipient: user.id,
        is_hidden: true,
      },
      select: ['id'],
    }) as any[];

    for (const notification of notifications) {
      await strapi.db.query(notificationUid).update({
        where: { id: Number(notification.id) },
        data: {
          is_hidden: false,
          hidden_at: null,
        },
      });
    }

    return ctx.send({
      message: 'กู้คืนการแจ้งเตือนทั้งหมดเรียบร้อย',
      count: notifications.length,
    });
  },
}));

function serializeNotification(notification: any) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    link: notification.link || '',
    is_read: !!notification.is_read,
    is_hidden: !!notification.is_hidden,
    read_at: notification.read_at,
    hidden_at: notification.hidden_at,
    createdAt: notification.createdAt,
  };
}
