import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::project.project', ({ strapi }) => ({
  async all(ctx) {
    const projects = await strapi.entityService.findMany('api::project.project', {
      populate: ['creator', 'members'],
      sort: ['updatedAt:desc', 'id:desc'],
    }) as any[];

    return ctx.send(projects);
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const bodyData = ctx.request.body?.data ?? {};
    const name = typeof bodyData.name === 'string' ? bodyData.name.trim() : '';
    const deadline = bodyData.deadline;

    if (!name || !deadline) return ctx.badRequest('กรุณากรอกชื่อและเดดไลน์');

    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) return ctx.badRequest('รูปแบบเดดไลน์ไม่ถูกต้อง');

    ctx.request.body.data = {
      ...bodyData,
      name,
      deadline: deadlineDate.toISOString(),
      creator: user.id,
      status_project: 'active',
    };

    const response = await super.create(ctx);

    await strapi.service('api::task.task').notifyGroup({
      message: `📁 โปรเจกต์ใหม่: *${name}*\nเดดไลน์: ${deadlineDate.toLocaleDateString('th-TH')}\nสร้างโดย: ${user.username}`,
    });

    return response;
  },

  async closeProject(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const project = await strapi.entityService.findOne('api::project.project', id) as any;
    if (!project) return ctx.notFound('ไม่พบโปรเจกต์นี้');
    if (project.status_project === 'closed') return ctx.badRequest('โปรเจกต์นี้ปิดแล้ว');

    const pendingTasks = await strapi.entityService.findMany('api::task.task', {
      filters: {
        project: { id: { $eq: id } },
        status_task: { $ne: 'done' },
      },
    }) as any[];

    if (pendingTasks.length) {
      return ctx.badRequest(`ยังมีงานค้างอยู่ ${pendingTasks.length} งาน กรุณาปิดงานให้ครบก่อน`);
    }

    await strapi.entityService.update('api::project.project', id, {
      data: { status_project: 'closed' },
    });

    await strapi.service('api::task.task').notifyGroup({
      message: `🏁 โปรเจกต์ *${project.name}* ปิดเรียบร้อยแล้ว`,
    });

    return ctx.send({ message: 'ปิดโปรเจกต์เรียบร้อย' });
  },

  async addMember(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    const { userId } = ctx.request.body;

    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const project = await strapi.entityService.findOne('api::project.project', id, {
      populate: ['members'],
    }) as any;

    if (!project) return ctx.notFound('ไม่พบโปรเจกต์นี้');

    const target = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      userId,
    ) as any;

    if (!target) return ctx.notFound('ไม่พบผู้ใช้นี้');
    if (!target.is_approved) return ctx.badRequest('พนักงานคนนี้ยังไม่ได้รับการอนุมัติ');

    const alreadyMember = project.members?.some((m: any) => m.id === Number(userId));
    if (alreadyMember) return ctx.badRequest('เป็นสมาชิกโปรเจกต์นี้แล้ว');

    const currentMembers = project.members?.map((m: any) => m.id) ?? [];
    await strapi.entityService.update('api::project.project', id, {
      data: { members: [...currentMembers, userId] } as any,
    });

    await strapi.service('api::task.task').notifyStaff({
      userId,
      message: `📁 คุณได้รับมอบหมายให้เข้าร่วมโปรเจกต์ *${project.name}*`,
    });

    return ctx.send({ message: 'เพิ่มสมาชิกเรียบร้อย' });
  },

  async removeMember(ctx) {
    const user = ctx.state.user;
    const { id, userId } = ctx.params;

    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const project = await strapi.entityService.findOne('api::project.project', id, {
      populate: ['members'],
    }) as any;

    if (!project) return ctx.notFound('ไม่พบโปรเจกต์นี้');

    const currentMembers = project.members?.map((m: any) => m.id) ?? [];
    const updated = currentMembers.filter((mId: number) => mId !== Number(userId));

    await strapi.entityService.update('api::project.project', id, {
      data: { members: updated },
    });

    return ctx.send({ message: 'ลบสมาชิกเรียบร้อย' });
  },

  async myProjects(ctx) {
    const user = ctx.state.user;

    const projects = await strapi.entityService.findMany('api::project.project', {
      filters: {
        members: { id: { $eq: user.id } },
        status_project: 'active',
      },
      populate: ['creator', 'members'],
      sort: ['updatedAt:desc', 'id:desc'],
    }) as any[];

    return ctx.send(projects);
  },
}));
