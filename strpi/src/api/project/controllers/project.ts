import { factories } from '@strapi/strapi';

const projectUid = 'api::project.project' as any;
const taskUid = 'api::task.task' as any;
const userUid = 'plugin::users-permissions.user' as any;
const joinRequestUid = 'api::project-join-request.project-join-request' as any;

export default factories.createCoreController(projectUid, ({ strapi }) => ({
  async home(ctx) {
    ensureManager(ctx);

    const [projects, requests] = await Promise.all([
      buildAllProjects(strapi),
      buildPendingJoinRequests(strapi),
    ]);

    return ctx.send({
      projects,
      requests,
    });
  },

  async all(ctx) {
    return ctx.send(await buildAllProjects(strapi));
  },

  async detail(ctx) {
    ensureManager(ctx);
    const projectId = Number(ctx.params.id);
    if (!Number.isFinite(projectId)) return ctx.badRequest('รูปแบบโปรเจกต์ไม่ถูกต้อง');

    const project = await strapi.db.query(projectUid).findOne({
      where: { id: projectId },
      populate: {
        creator: {
          select: ['id', 'display_name', 'username'],
        },
        members: {
          select: ['id', 'display_name', 'username'],
        },
      },
    }) as any;

    if (!project) return ctx.notFound('ไม่พบโปรเจกต์นี้');

    const tasks = await strapi.db.query(taskUid).findMany({
      where: { project: projectId },
      select: ['id', 'name', 'status_task', 'createdAt', 'updatedAt'],
      populate: {
        current_owner: {
          select: ['id', 'display_name', 'username'],
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    }) as any[];

    const counts = {
      total: tasks.length,
      in_progress: tasks.filter((task) => task.status_task === 'in_progress').length,
      under_review: tasks.filter((task) => task.status_task === 'under_review').length,
      waiting_pickup: tasks.filter((task) => task.status_task === 'waiting_pickup').length,
      done: tasks.filter((task) => task.status_task === 'done').length,
    };

    return ctx.send({
      project,
      summary: counts,
      tasks,
    });
  },

  async create(ctx) {
    const user = ctx.state.user;
    ensureManager(ctx);

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

    const created = await strapi.db.query(projectUid).create({
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
    ensureManager(ctx);
    const projectId = Number(ctx.params.id);

    const project = await strapi.db.query(projectUid).findOne({
      where: { id: projectId },
    }) as any;
    if (!project) return ctx.notFound('ไม่พบโปรเจกต์นี้');
    if (project.status_project === 'closed') return ctx.badRequest('โปรเจกต์นี้ถูกปิดแล้ว');

    const pendingTasks = await strapi.db.query(taskUid).findMany({
      where: {
        project: projectId,
        status_task: { $ne: 'done' },
      },
      select: ['id'],
    }) as any[];

    if (pendingTasks.length) {
      return ctx.badRequest(`ยังมีงานค้างอยู่ ${pendingTasks.length} งาน กรุณาปิดงานให้ครบก่อน`);
    }

    await strapi.db.query(projectUid).update({
      where: { id: projectId },
      data: { status_project: 'closed' },
    });

    await strapi.service('api::task.task').notifyGroup({
      message: `โปรเจกต์ *${project.name}* ปิดเรียบร้อยแล้ว`,
    });

    return ctx.send({ message: 'ปิดโปรเจกต์เรียบร้อย' });
  },

  async addMember(ctx) {
    ensureManager(ctx);
    const projectId = Number(ctx.params.id);
    const memberId = Number(ctx.request.body?.userId);

    const project = await strapi.db.query(projectUid).findOne({
      where: { id: projectId },
      populate: {
        members: {
          select: ['id'],
        },
      },
    }) as any;

    if (!project) return ctx.notFound('ไม่พบโปรเจกต์นี้');

    const target = await strapi.db.query(userUid).findOne({
      where: { id: memberId },
      select: ['id', 'is_approved'],
    }) as any;

    if (!target) return ctx.notFound('ไม่พบผู้ใช้งานนี้');
    if (!target.is_approved) return ctx.badRequest('ผู้ใช้งานนี้ยังไม่พร้อมใช้งาน');

    const alreadyMember = project.members?.some((member: any) => Number(member.id) === memberId);
    if (alreadyMember) return ctx.badRequest('ผู้ใช้งานนี้เป็นสมาชิกโปรเจกต์อยู่แล้ว');

    const currentMembers = project.members?.map((member: any) => Number(member.id)) ?? [];
    await strapi.db.query(projectUid).update({
      where: { id: projectId },
      data: { members: [...currentMembers, memberId] } as any,
    });

    await strapi.service('api::task.task').notifyStaff({
      userId: memberId,
      title: 'ถูกเพิ่มเข้าโปรเจกต์',
      message: `คุณถูกเพิ่มเข้าโปรเจกต์ *${project.name}*`,
      type: 'project',
      link: '/create',
    });

    return ctx.send({ message: 'เพิ่มสมาชิกเรียบร้อย' });
  },

  async removeMember(ctx) {
    ensureManager(ctx);
    const projectId = Number(ctx.params.id);
    const memberId = Number(ctx.params.userId);

    const project = await strapi.db.query(projectUid).findOne({
      where: { id: projectId },
      populate: {
        members: {
          select: ['id'],
        },
      },
    }) as any;

    if (!project) return ctx.notFound('ไม่พบโปรเจกต์นี้');

    const updatedMembers = (project.members?.map((member: any) => Number(member.id)) ?? [])
      .filter((id: number) => id !== memberId);

    await strapi.db.query(projectUid).update({
      where: { id: projectId },
      data: { members: updatedMembers } as any,
    });

    return ctx.send({ message: 'ลบสมาชิกเรียบร้อย' });
  },

  async myProjects(ctx) {
    const user = ctx.state.user;

    const projects = await strapi.db.query(projectUid).findMany({
      where: {
        members: { id: user.id },
        status_project: 'active',
      },
      populate: {
        creator: {
          select: ['id', 'display_name', 'username'],
        },
        members: {
          select: ['id', 'display_name', 'username'],
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    }) as any[];

    return ctx.send(projects);
  },

  async requestJoin(ctx) {
    const user = ctx.state.user;
    const projectId = Number(ctx.params.id);
    const note = typeof ctx.request.body?.note === 'string' ? ctx.request.body.note.trim() : '';

    if (user.role_app !== 'staff') return ctx.forbidden('เฉพาะพนักงานเท่านั้น');

    const project = await strapi.db.query(projectUid).findOne({
      where: { id: projectId },
      populate: {
        members: {
          select: ['id'],
        },
      },
    }) as any;

    if (!project) return ctx.notFound('ไม่พบโปรเจกต์');
    if (project.status_project !== 'active') return ctx.badRequest('โปรเจกต์นี้ยังไม่เปิดใช้งาน');

    const alreadyMember = project.members?.some((member: any) => Number(member.id) === user.id);
    if (alreadyMember) return ctx.badRequest('คุณเป็นสมาชิกของโปรเจกต์นี้อยู่แล้ว');

    const existingPending = await strapi.db.query(joinRequestUid).findMany({
      where: {
        project: projectId,
        requested_by: user.id,
        status_request: 'pending',
      },
      select: ['id'],
      limit: 1,
    }) as any[];
    if (existingPending.length) return ctx.badRequest('คุณส่งคำขอเข้าร่วมโปรเจกต์นี้ไว้แล้ว');

    const request = await strapi.db.query(joinRequestUid).create({
      data: {
        project: projectId,
        requested_by: user.id,
        note,
        status_request: 'pending',
      },
    }) as any;

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
    ensureManager(ctx);
    return ctx.send(await buildPendingJoinRequests(strapi));
  },

  async approveJoinRequest(ctx) {
    const user = ctx.state.user;
    ensureManager(ctx);
    const requestId = Number(ctx.params.id);

    const request = await strapi.db.query(joinRequestUid).findOne({
      where: { id: requestId },
      populate: {
        project: {
          populate: {
            members: {
              select: ['id'],
            },
          },
        },
        requested_by: {
          select: ['id', 'display_name', 'username'],
        },
      },
    }) as any;

    if (!request) return ctx.notFound('ไม่พบคำขอเข้าร่วมโปรเจกต์');
    if (request.status_request !== 'pending') return ctx.badRequest('คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ');

    const memberIds = request.project?.members?.map((member: any) => Number(member.id)) ?? [];
    if (!memberIds.includes(Number(request.requested_by.id))) {
      await strapi.db.query(projectUid).update({
        where: { id: request.project.id },
        data: { members: [...memberIds, request.requested_by.id] } as any,
      });
    }

    await strapi.db.query(joinRequestUid).update({
      where: { id: requestId },
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
    ensureManager(ctx);
    const requestId = Number(ctx.params.id);
    const reason = typeof ctx.request.body?.reason === 'string' ? ctx.request.body.reason.trim() : '';

    const request = await strapi.db.query(joinRequestUid).findOne({
      where: { id: requestId },
      populate: {
        project: {
          select: ['id', 'name'],
        },
        requested_by: {
          select: ['id'],
        },
      },
    }) as any;

    if (!request) return ctx.notFound('ไม่พบคำขอเข้าร่วมโปรเจกต์');
    if (request.status_request !== 'pending') return ctx.badRequest('คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ');

    await strapi.db.query(joinRequestUid).update({
      where: { id: requestId },
      data: {
        status_request: 'rejected',
        reviewed_by: user.id,
        review_note: reason,
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

function ensureManager(ctx: any) {
  if (ctx.state.user.role_app !== 'manager') {
    throw ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
  }
}

async function buildAllProjects(strapi: any) {
  return strapi.db.query(projectUid).findMany({
    populate: {
      creator: {
        select: ['id', 'display_name', 'username'],
      },
      members: {
        select: ['id', 'display_name', 'username'],
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });
}

async function buildPendingJoinRequests(strapi: any) {
  return strapi.db.query(joinRequestUid).findMany({
    where: { status_request: 'pending' },
    populate: {
      project: {
        select: ['id', 'name'],
      },
      requested_by: {
        select: ['id', 'display_name', 'username'],
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}
