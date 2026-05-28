import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::handover-request.handover-request', ({ strapi }) => ({
  async handover(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    const { reason } = ctx.request.body;

    if (!reason || reason.trim().length < 5) {
      return ctx.badRequest('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร');
    }

    const task = await strapi.entityService.findOne('api::task.task', id, {
      populate: ['current_owner'],
    }) as any;

    if (!task) return ctx.notFound('ไม่พบงานนี้');
    if (task.current_owner?.id !== user.id) return ctx.forbidden('คุณไม่ใช่เจ้าของงานนี้');
    if (task.status_task !== 'in_progress') return ctx.badRequest('งานนี้ยังไม่สามารถส่งต่อได้');

    await strapi.entityService.update('api::task.task', id, {
      data: { status_task: 'waiting_pickup' },
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    const handover = await strapi.entityService.create('api::handover-request.handover-request', {
      data: {
        task: id,
        requested_by: user.id,
        reason: reason.trim(),
        status_handover: 'pending',
        expires_at: expiresAt,
      },
    }) as any;

    await strapi.entityService.create('api::task-log.task-log', {
      data: {
        task: id,
        action: 'handover',
        actor: user.id,
        note: reason.trim(),
      },
    });

    await strapi.service('api::task.task').notifyGroup({
      message: [
        '🔁 *มีงานรอรับช่วงต่อ*',
        `งาน: *${task.name}*`,
        `ผู้ส่งต่องาน: ${user.username}`,
        `เหตุผล: ${reason.trim()}`,
        '',
        'เข้า Mini App เพื่อขอรับงานต่อได้เลย',
      ].join('\n'),
    });

    return ctx.send({ message: 'ส่งต่องานเรียบร้อย', handoverId: handover.id });
  },

  async pickup(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    const task = await strapi.entityService.findOne('api::task.task', id, {
      populate: ['current_owner'],
    }) as any;

    if (!task) return ctx.notFound('ไม่พบงานนี้');
    if (task.status_task !== 'waiting_pickup') return ctx.badRequest('งานนี้ไม่ได้อยู่ในสถานะรอรับช่วงต่อ');
    if (task.current_owner?.id === user.id) return ctx.badRequest('คุณเป็นเจ้าของงานเดิมอยู่แล้ว');

    const handovers = await strapi.entityService.findMany('api::handover-request.handover-request', {
      filters: { task: id, status_handover: 'pending' },
      populate: ['picked_up_by'],
    }) as any[];

    if (!handovers.length) return ctx.notFound('ไม่พบคำขอส่งต่องาน');

    const handover = handovers[0];

    if (new Date() > new Date(handover.expires_at)) {
      await strapi.entityService.update('api::handover-request.handover-request', handover.id, {
        data: { status_handover: 'timeout' },
      });
      return ctx.badRequest('คำขอนี้หมดเวลาแล้ว');
    }

    if (handover.picked_up_by) {
      return ctx.badRequest('มีคนขอรับงานนี้แล้ว กรุณารอหัวหน้าตรวจสอบ');
    }

    await strapi.entityService.update('api::handover-request.handover-request', handover.id, {
      data: { picked_up_by: user.id },
    });

    await strapi.service('api::task.task').notifyManagerHandover({
      handoverId: String(handover.id),
      taskName: task.name,
      pickedUpBy: user.username,
    });

    await strapi.service('api::task.task').notifyManagersInApp({
      title: 'มีคำขอรับช่วงต่องาน',
      message: `${user.username} ขอรับช่วงต่องาน "${task.name}" จาก ${task.current_owner.username}`,
      type: 'handover',
      link: '/',
    });

    return ctx.send({ message: 'ส่งคำขอรับงานแล้ว รอหัวหน้าอนุมัติ' });
  },

  async approveHandover(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const handover = await strapi.entityService.findOne('api::handover-request.handover-request', id, {
      populate: ['task', 'requested_by', 'picked_up_by'],
    }) as any;

    if (!handover) return ctx.notFound('ไม่พบคำขอ');
    if (handover.status_handover !== 'pending') return ctx.badRequest('คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ');
    if (!handover.picked_up_by) return ctx.badRequest('ยังไม่มีผู้ขอรับงานนี้');

    await strapi.entityService.update('api::task.task', handover.task.id, {
      data: {
        current_owner: handover.picked_up_by.id,
        status_task: 'in_progress',
      },
    });

    await strapi.entityService.update('api::handover-request.handover-request', id, {
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

    await strapi.service('api::task.task').notifyStaff({
      userId: handover.picked_up_by.id,
      title: 'ได้รับงานต่อแล้ว',
      message: `หัวหน้าอนุมัติแล้ว งาน "${handover.task.name}" เป็นของคุณแล้ว`,
      type: 'handover',
      link: '/',
    });

    await strapi.service('api::task.task').notifyGroup({
      message: `✅ *อนุมัติการรับช่วงต่องานแล้ว*\nงาน: *${handover.task.name}*\nผู้รับงาน: ${handover.picked_up_by.username}`,
    });

    return ctx.send({ message: 'อนุมัติการส่งต่องานเรียบร้อย' });
  },

  async rejectHandover(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    const { reason } = ctx.request.body || {};

    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const handover = await strapi.entityService.findOne('api::handover-request.handover-request', id, {
      populate: ['task', 'requested_by', 'picked_up_by'],
    }) as any;

    if (!handover) return ctx.notFound('ไม่พบคำขอ');
    if (handover.status_handover !== 'pending') return ctx.badRequest('คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ');
    if (!handover.picked_up_by) return ctx.badRequest('ยังไม่มีผู้ขอรับงานนี้');

    await strapi.entityService.update('api::handover-request.handover-request', id, {
      data: {
        picked_up_by: null,
      },
    });

    await strapi.entityService.create('api::task-log.task-log', {
      data: {
        task: handover.task.id,
        action: 'handover',
        actor: user.id,
        note: reason?.trim()
          ? `ปฏิเสธการรับช่วงต่อของ ${handover.picked_up_by.username}: ${reason.trim()}`
          : `ปฏิเสธการรับช่วงต่อของ ${handover.picked_up_by.username}`,
      },
    });

    await strapi.service('api::task.task').notifyStaff({
      userId: handover.picked_up_by.id,
      title: 'คำขอรับช่วงต่องานยังไม่ผ่าน',
      message: reason?.trim()
        ? `หัวหน้าปฏิเสธคำขอรับช่วงต่องาน "${handover.task.name}"\nเหตุผล: ${reason.trim()}`
        : `หัวหน้าปฏิเสธคำขอรับช่วงต่องาน "${handover.task.name}"`,
      type: 'handover',
      link: '/pickup',
    });

    return ctx.send({ message: 'ปฏิเสธคำขอรับช่วงต่องานเรียบร้อย' });
  },

  async cancelHandover(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    const handover = await strapi.entityService.findOne('api::handover-request.handover-request', id, {
      populate: ['task', 'requested_by'],
    }) as any;

    if (!handover) return ctx.notFound('ไม่พบคำขอ');
    if (handover.requested_by.id !== user.id) return ctx.forbidden('คุณไม่ใช่เจ้าของคำขอนี้');
    if (handover.status_handover !== 'pending') return ctx.badRequest('คำขอนี้ไม่สามารถยกเลิกได้');

    await strapi.entityService.update('api::handover-request.handover-request', id, {
      data: { status_handover: 'cancelled' },
    });

    await strapi.entityService.update('api::task.task', handover.task.id, {
      data: {
        status_task: 'in_progress',
        current_owner: handover.requested_by.id,
      },
    });

    await strapi.entityService.create('api::task-log.task-log', {
      data: {
        task: handover.task.id,
        action: 'handover',
        actor: user.id,
        note: 'ยกเลิกการส่งต่องานและคืนงานให้เจ้าของเดิม',
      },
    });

    await strapi.service('api::task.task').notifyGroup({
      message: `↩️ *ยกเลิกการส่งต่องาน*\nงาน: *${handover.task.name}*\nงานกลับไปอยู่กับ ${user.username} แล้ว`,
    });

    return ctx.send({ message: 'ยกเลิกคำขอเรียบร้อย งานกลับมาเป็นของคุณแล้ว' });
  },
}));
