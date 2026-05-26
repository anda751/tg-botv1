import { factories } from '@strapi/strapi';

const notificationUid = 'api::notification.notification' as any;

export default factories.createCoreController(notificationUid, ({ strapi }) => ({
  async my(ctx) {
    const user = ctx.state.user;
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    await strapi.service('api::project.project').syncOverdueNotifications();

    const notifications = await strapi.entityService.findMany(notificationUid, {
      filters: {
        recipient: { id: user.id },
        is_hidden: false,
      },
      sort: ['createdAt:desc', 'id:desc'],
      limit: 20,
    }) as any[];

    return ctx.send(notifications.map(serializeNotification));
  },

  async hidden(ctx) {
    const user = ctx.state.user;
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const notifications = await strapi.entityService.findMany(notificationUid, {
      filters: {
        recipient: { id: user.id },
        is_hidden: true,
      },
      sort: ['hidden_at:desc', 'updatedAt:desc', 'id:desc'],
      limit: 20,
    }) as any[];

    return ctx.send(notifications.map(serializeNotification));
  },

  async markRead(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const notification = await strapi.entityService.findOne(notificationUid, id, {
      populate: ['recipient'],
    }) as any;

    if (!notification) return ctx.notFound('ไม่พบการแจ้งเตือน');
    if (notification.recipient?.id !== user.id) return ctx.forbidden('คุณไม่มีสิทธิ์เข้าถึงการแจ้งเตือนนี้');

    const updated = await strapi.entityService.update(notificationUid, id, {
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

    const notifications = await strapi.entityService.findMany(notificationUid, {
      filters: {
        recipient: { id: user.id },
        is_read: false,
        is_hidden: false,
      },
      fields: ['id'],
      limit: -1,
    }) as any[];

    await Promise.all(
      notifications.map((notification) =>
        strapi.entityService.update(notificationUid, notification.id, {
          data: {
            is_read: true,
            read_at: new Date(),
          },
        })),
    );

    return ctx.send({
      message: 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมดเรียบร้อย',
      count: notifications.length,
    });
  },

  async hide(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const notification = await strapi.entityService.findOne(notificationUid, id, {
      populate: ['recipient'],
    }) as any;

    if (!notification) return ctx.notFound('ไม่พบการแจ้งเตือน');
    if (notification.recipient?.id !== user.id) return ctx.forbidden('คุณไม่มีสิทธิ์เข้าถึงการแจ้งเตือนนี้');

    const updated = await strapi.entityService.update(notificationUid, id, {
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

    const notifications = await strapi.entityService.findMany(notificationUid, {
      filters: {
        recipient: { id: user.id },
        is_hidden: false,
        is_read: true,
      },
      fields: ['id'],
      limit: -1,
    }) as any[];

    await Promise.all(
      notifications.map((notification) =>
        strapi.entityService.update(notificationUid, notification.id, {
          data: {
            is_hidden: true,
            hidden_at: new Date(),
          },
        })),
    );

    return ctx.send({
      message: 'ซ่อนรายการที่อ่านแล้วเรียบร้อย',
      count: notifications.length,
    });
  },

  async restore(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const notification = await strapi.entityService.findOne(notificationUid, id, {
      populate: ['recipient'],
    }) as any;

    if (!notification) return ctx.notFound('ไม่พบการแจ้งเตือน');
    if (notification.recipient?.id !== user.id) return ctx.forbidden('คุณไม่มีสิทธิ์เข้าถึงการแจ้งเตือนนี้');

    const updated = await strapi.entityService.update(notificationUid, id, {
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

    const notifications = await strapi.entityService.findMany(notificationUid, {
      filters: {
        recipient: { id: user.id },
        is_hidden: true,
      },
      fields: ['id'],
      limit: -1,
    }) as any[];

    await Promise.all(
      notifications.map((notification) =>
        strapi.entityService.update(notificationUid, notification.id, {
          data: {
            is_hidden: false,
            hidden_at: null,
          },
        })),
    );

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
