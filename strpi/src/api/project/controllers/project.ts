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

    if (!name || !deadline) {
      return ctx.badRequest('กรุณากรอกชื่อโปรเจกต์และกำหนดวันครบกำหนด');
    }

    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) {
      return ctx.badRequest('รูปแบบวันครบกำหนดไม่ถูกต้อง');
    }

    const created = await strapi.entityService.create('api::project.project', {
      data: {
        ...bodyData,
        name,
        deadline: deadlineDate.toISOString(),
        creator: user.id,
        status_project: 'active',
      } as any,
    }) as any;

    await strapi.service('api::task.task').notifyGroup({
      message: `โปรเจกต์ใหม่: *${name}*\nกำหนดส่ง: ${deadlineDate.toLocaleDateString('th-TH')}\nสร้างโดย: ${user.username}`,
    });

    return ctx.send(created);
  },

  async closeProject(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const project = await strapi.entityService.findOne('api::project.project', id) as any;
    if (!project) return ctx.notFound('ไม่พบโปรเจกต์นี้');
    if (project.status_project === 'closed') return ctx.badRequest('โปรเจกต์นี้ถูกปิดแล้ว');

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
      message: `โปรเจกต์ *${project.name}* ปิดเรียบร้อยแล้ว`,
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

    if (!target) return ctx.notFound('ไม่พบผู้ใช้งานนี้');
    if (!target.is_approved) return ctx.badRequest('ผู้ใช้งานนี้ยังไม่พร้อมใช้งาน');

    const alreadyMember = project.members?.some((m: any) => m.id === Number(userId));
    if (alreadyMember) return ctx.badRequest('ผู้ใช้งานนี้เป็นสมาชิกโปรเจกต์อยู่แล้ว');

    const currentMembers = project.members?.map((m: any) => m.id) ?? [];
    await strapi.entityService.update('api::project.project', id, {
      data: { members: [...currentMembers, userId] } as any,
    });

    await strapi.service('api::task.task').notifyStaff({
      userId,
      title: 'ถูกเพิ่มเข้าโปรเจกต์',
      message: `คุณถูกเพิ่มเข้าโปรเจกต์ *${project.name}*`,
      type: 'project',
      link: '/create',
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

  async requestJoin(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    const { note } = ctx.request.body ?? {};

    if (user.role_app !== 'staff') return ctx.forbidden('เฉพาะพนักงานเท่านั้น');

    const project = await strapi.entityService.findOne('api::project.project', id, {
      populate: ['members'],
    }) as any;

    if (!project) return ctx.notFound('ไม่พบโปรเจกต์');
    if (project.status_project !== 'active') return ctx.badRequest('โปรเจกต์นี้ยังไม่เปิดใช้งาน');

    const alreadyMember = project.members?.some((m: any) => m.id === user.id);
    if (alreadyMember) return ctx.badRequest('คุณเป็นสมาชิกของโปรเจกต์นี้อยู่แล้ว');

    const existingPending = await (strapi.entityService as any).findMany(
      'api::project-join-request.project-join-request',
      {
        filters: {
          project: { id: { $eq: id } },
          requested_by: { id: { $eq: user.id } },
          status_request: 'pending',
        },
        limit: 1,
      },
    ) as any[];
    if (existingPending.length) return ctx.badRequest('คุณส่งคำขอเข้าร่วมโปรเจกต์นี้ไว้แล้ว');

    const request = await (strapi.entityService as any).create(
      'api::project-join-request.project-join-request',
      {
        data: {
          project: Number(id),
          requested_by: user.id,
          note: typeof note === 'string' ? note.trim() : '',
          status_request: 'pending',
        },
      },
    ) as any;

    await strapi.service('api::task.task').notifyManager({
      taskId: '',
      taskName: '',
      submittedBy: user.display_name || user.username,
      reportText: `คำขอเข้าร่วมโปรเจกต์\nโปรเจกต์: ${project.name}\nพนักงาน: ${user.display_name || user.username}\nหมายเหตุ: ${request.note || '-'}`,
      imageUrl: '',
    });

    return ctx.send({ message: 'ส่งคำขอเข้าร่วมโปรเจกต์แล้ว', request });
  },

  async pendingJoinRequests(ctx) {
    const user = ctx.state.user;
    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const requests = await (strapi.entityService as any).findMany(
      'api::project-join-request.project-join-request',
      {
        filters: { status_request: 'pending' },
        populate: ['project', 'requested_by'],
        sort: ['createdAt:asc'],
        limit: -1,
      },
    ) as any[];

    return ctx.send(requests);
  },

  async approveJoinRequest(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const request = await (strapi.entityService as any).findOne(
      'api::project-join-request.project-join-request',
      id,
      { populate: ['project', 'requested_by', 'project.members'] },
    ) as any;
    if (!request) return ctx.notFound('ไม่พบคำขอเข้าร่วมโปรเจกต์');
    if (request.status_request !== 'pending') return ctx.badRequest('คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ');

    const members = request.project?.members?.map((m: any) => m.id) ?? [];
    const alreadyMember = members.includes(request.requested_by.id);
    if (!alreadyMember) {
      await strapi.entityService.update('api::project.project', request.project.id, {
        data: { members: [...members, request.requested_by.id] } as any,
      });
    }

    await (strapi.entityService as any).update('api::project-join-request.project-join-request', id, {
      data: {
        status_request: 'approved',
        reviewed_by: user.id,
      },
    });

    await strapi.service('api::task.task').notifyStaff({
      userId: String(request.requested_by.id),
      title: 'คำขอเข้าโปรเจกต์ได้รับอนุมัติ',
      message: `คำขอได้รับอนุมัติแล้ว คุณเข้าร่วมโปรเจกต์ *${request.project.name}* ได้แล้ว`,
      type: 'project',
      link: '/create',
    });

    return ctx.send({ message: 'อนุมัติคำขอเข้าร่วมโปรเจกต์แล้ว' });
  },

  async rejectJoinRequest(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    const { reason } = ctx.request.body ?? {};
    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const request = await (strapi.entityService as any).findOne(
      'api::project-join-request.project-join-request',
      id,
      { populate: ['project', 'requested_by'] },
    ) as any;
    if (!request) return ctx.notFound('ไม่พบคำขอเข้าร่วมโปรเจกต์');
    if (request.status_request !== 'pending') return ctx.badRequest('คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ');

    await (strapi.entityService as any).update('api::project-join-request.project-join-request', id, {
      data: {
        status_request: 'rejected',
        reviewed_by: user.id,
        review_note: typeof reason === 'string' ? reason.trim() : '',
      },
    });

    await strapi.service('api::task.task').notifyStaff({
      userId: String(request.requested_by.id),
      title: 'คำขอเข้าโปรเจกต์ไม่ผ่าน',
      message: `คำขอเข้าร่วมโปรเจกต์ *${request.project.name}* ไม่ได้รับการอนุมัติ`,
      type: 'project',
      link: '/create',
    });

    return ctx.send({ message: 'ปฏิเสธคำขอเข้าร่วมโปรเจกต์แล้ว' });
  },
}));
