import { factories } from '@strapi/strapi';
import { promises as fs } from 'node:fs';
import { resolveImageUrl, uploadProofImage } from '../../../services/supabase';

const taskUid = 'api::task.task' as any;
const taskLogUid = 'api::task-log.task-log' as any;
const proofImageUid = 'api::proof-image.proof-image' as any;
const notificationUid = 'api::notification.notification' as any;

export default factories.createCoreController(taskUid, ({ strapi }) => ({
  async home(ctx) {
    const user = ctx.state.user;
    if (!user?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const tasks = await fetchTasksForOwner(strapi, user.id, false);
    const hiddenTasks = await fetchTasksForOwner(strapi, user.id, true);
    const notifications = await fetchNotifications(strapi, user.id, false);
    const hiddenNotifications = await fetchNotifications(strapi, user.id, true);

    return ctx.send({
      tasks,
      hidden_tasks: hiddenTasks,
      notifications: notifications.map(serializeNotification),
      hidden_notifications: hiddenNotifications.map(serializeNotification),
    });
  },

  async my(ctx) {
    const user = ctx.state.user;
    const tasks = await fetchTasksForOwner(strapi, user.id, false);
    return ctx.send(tasks);
  },

  async hidden(ctx) {
    const user = ctx.state.user;
    const tasks = await fetchTasksForOwner(strapi, user.id, true);
    return ctx.send(tasks);
  },

  async waitingPickup(ctx) {
    const tasks = await strapi.db.query(taskUid).findMany({
      where: { status_task: 'waiting_pickup' },
      populate: {
        current_owner: true,
        task_log: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    return ctx.send(tasks);
  },

  async create(ctx) {
    const user = ctx.state.user;
    const bodyData = ctx.request.body?.data ?? {};
    const name = typeof bodyData.name === 'string' ? bodyData.name.trim() : '';
    const projectValue = bodyData.project;

    if (!/[A-Za-z0-9\u0E00-\u0E7F]/.test(name)) {
      return ctx.badRequest('ชื่องานต้องมีตัวอักษรหรือตัวเลขอย่างน้อย 1 ตัว');
    }
    if (name.length < 5) {
      return ctx.badRequest('ชื่องานต้องยาวอย่างน้อย 5 ตัวอักษร');
    }

    const projectId =
      projectValue === null || projectValue === undefined || projectValue === ''
        ? null
        : Number(projectValue);
    if (projectId !== null && Number.isNaN(projectId)) {
      return ctx.badRequest('รูปแบบโปรเจกต์ไม่ถูกต้อง');
    }

    const created = await strapi.db.query(taskUid).create({
      data: {
        ...bodyData,
        name,
        project: projectId,
        current_owner: user.id,
        creator: user.id,
        status_task: 'in_progress',
      },
    }) as any;

    await strapi.db.query(taskLogUid).create({
      data: {
        task: created.id,
        action: 'created',
        actor: user.id,
        note: `สร้างงาน: ${name}`,
      },
    });

    await strapi.service('api::task.task').notifyGroup({
      message: `งานใหม่: *${name}*\nผู้รับผิดชอบ: ${user.username}`,
    });

    return ctx.send(created);
  },

  async submit(ctx) {
    const user = ctx.state.user;
    const taskId = Number(ctx.params.id);
    const reportTextRaw = ctx.request.body?.report_text;
    const reportText = typeof reportTextRaw === 'string' ? reportTextRaw.trim() : '';
    const file = (ctx.request as any).files?.proof_image;

    const task = await getTaskWithOwner(strapi, taskId);
    const validationError = validateTaskMutation(task, user.id, 'submit', reportText, !!file);
    if (validationError) return validationError(ctx);

    const fileBuffer = await readUploadedFileBuffer(file);
    const imagePath = await uploadProofImage(
      fileBuffer,
      file.name || file.filename || file.originalFilename || 'proof',
      file.type,
    );
    const resolvedImageUrl = await resolveImageUrl(imagePath);

    await strapi.db.query(proofImageUid).create({
      data: {
        task: taskId,
        image_url: resolvedImageUrl,
        report_text: reportText,
        submitted_by: user.id,
        submitted_at: new Date(),
      },
    });

    await strapi.db.query(taskUid).update({
      where: { id: taskId },
      data: { status_task: 'under_review' },
    });

    await strapi.db.query(taskLogUid).create({
      data: {
        task: taskId,
        action: 'submitted',
        actor: user.id,
        note: reportText,
      },
    });

    await strapi.service('api::task.task').notifyManager({
      taskId: String(taskId),
      taskName: task.name,
      submittedBy: user.username,
      reportText,
      imageUrl: resolvedImageUrl,
      imageBuffer: fileBuffer,
      imageFilename: file.name || file.filename || file.originalFilename || 'proof',
      imageMimeType: file.type,
    });

    return ctx.send({ message: 'ส่งงานเรียบร้อย รอหัวหน้าตรวจสอบ' });
  },

  async progress(ctx) {
    const user = ctx.state.user;
    const taskId = Number(ctx.params.id);
    const reportTextRaw = ctx.request.body?.report_text;
    const reportText = typeof reportTextRaw === 'string' ? reportTextRaw.trim() : '';
    const file = (ctx.request as any).files?.proof_image;
    let fileBuffer: Buffer | null = null;
    let resolvedImageUrl = '';

    const task = await getTaskWithOwner(strapi, taskId);
    const validationError = validateTaskMutation(task, user.id, 'progress', reportText, true);
    if (validationError) return validationError(ctx);

    if (file) {
      fileBuffer = await readUploadedFileBuffer(file);
      const imagePath = await uploadProofImage(
        fileBuffer,
        file.name || file.filename || file.originalFilename || 'progress',
        file.type,
      );
      resolvedImageUrl = await resolveImageUrl(imagePath);

      await strapi.db.query(proofImageUid).create({
        data: {
          task: taskId,
          image_url: resolvedImageUrl,
          report_text: reportText,
          submitted_by: user.id,
          submitted_at: new Date(),
        },
      });
    }

    await strapi.db.query(taskLogUid).create({
      data: {
        task: taskId,
        action: 'progress_update',
        actor: user.id,
        note: reportText,
      },
    });

    await strapi.service('api::task.task').notifyManager({
      taskId: String(taskId),
      taskName: task.name,
      submittedBy: user.username,
      reportText: `อัปเดตความคืบหน้า:\n${reportText}`,
      imageUrl: resolvedImageUrl,
      imageBuffer: fileBuffer ?? undefined,
      imageFilename: file?.name || file?.filename || file?.originalFilename || 'progress',
      imageMimeType: file?.type,
    });

    return ctx.send({ message: 'อัปเดตความคืบหน้าเรียบร้อย' });
  },

  async approve(ctx) {
    const user = ctx.state.user;
    const taskId = Number(ctx.params.id);

    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const task = await getTaskWithOwner(strapi, taskId);
    if (!task) return ctx.notFound('ไม่พบงาน');
    if (task.status_task !== 'under_review') return ctx.badRequest('งานนี้ไม่ได้อยู่ในสถานะรอตรวจสอบ');

    await strapi.db.query(taskUid).update({
      where: { id: taskId },
      data: { status_task: 'done' },
    });

    await strapi.db.query(taskLogUid).create({
      data: {
        task: taskId,
        action: 'approved',
        actor: user.id,
      },
    });

    await strapi.service('api::task.task').notifyGroup({
      message: `งานเสร็จสมบูรณ์: *${task.name}*\nโดย: ${task.current_owner.username}`,
    });

    await strapi.service('api::task.task').notifyStaff({
      userId: task.current_owner.id,
      title: 'งานเสร็จแล้ว',
      message: `อนุมัติงานแล้ว\nงาน "${task.name}" ผ่านการตรวจสอบแล้ว`,
      type: 'task',
      link: '/',
    });

    return ctx.send({ message: 'อนุมัติงานเรียบร้อย' });
  },

  async reject(ctx) {
    const user = ctx.state.user;
    const taskId = Number(ctx.params.id);
    const reasonRaw = ctx.request.body?.reason;
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';

    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
    if (!reason || reason.length < 5) return ctx.badRequest('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร');

    const task = await getTaskWithOwner(strapi, taskId);
    if (!task) return ctx.notFound('ไม่พบงาน');

    await strapi.db.query(taskUid).update({
      where: { id: taskId },
      data: { status_task: 'in_progress' },
    });

    await strapi.db.query(taskLogUid).create({
      data: {
        task: taskId,
        action: 'rejected',
        actor: user.id,
        note: reason,
      },
    });

    await strapi.service('api::task.task').notifyStaff({
      userId: task.current_owner.id,
      title: 'งานถูกส่งกลับ',
      message: `งาน *${task.name}* ไม่ผ่านการตรวจสอบ\nเหตุผล: ${reason}`,
      type: 'task',
      link: '/',
    });

    return ctx.send({ message: 'ตีกลับงานเรียบร้อย' });
  },

  async hide(ctx) {
    const user = ctx.state.user;
    const taskId = Number(ctx.params.id);
    const task = await getTaskWithOwner(strapi, taskId);

    if (!task) return ctx.notFound('ไม่พบงาน');
    if (task.current_owner?.id !== user.id) return ctx.forbidden('คุณไม่มีสิทธิ์ซ่อนงานนี้');
    if (task.status_task !== 'done') return ctx.badRequest('ซ่อนได้เฉพาะงานที่เสร็จแล้ว');
    if (task.is_hidden_for_owner) return ctx.send({ message: 'งานนี้ถูกซ่อนไว้แล้ว' });

    await strapi.db.query(taskUid).update({
      where: { id: taskId },
      data: {
        is_hidden_for_owner: true,
        hidden_for_owner_at: new Date(),
      },
    });

    return ctx.send({ message: 'ซ่อนงานเรียบร้อย' });
  },

  async restore(ctx) {
    const user = ctx.state.user;
    const taskId = Number(ctx.params.id);
    const task = await getTaskWithOwner(strapi, taskId);

    if (!task) return ctx.notFound('ไม่พบงาน');
    if (task.current_owner?.id !== user.id) return ctx.forbidden('คุณไม่มีสิทธิ์กู้คืนงานนี้');

    await strapi.db.query(taskUid).update({
      where: { id: taskId },
      data: {
        is_hidden_for_owner: false,
        hidden_for_owner_at: null,
      },
    });

    return ctx.send({ message: 'กู้คืนงานเรียบร้อย' });
  },

  async restoreAll(ctx) {
    const user = ctx.state.user;

    const tasks = await strapi.db.query(taskUid).findMany({
      where: {
        current_owner: user.id,
        is_hidden_for_owner: true,
      },
      select: ['id'],
    }) as any[];

    for (const task of tasks) {
      await strapi.db.query(taskUid).update({
        where: { id: Number(task.id) },
        data: {
          is_hidden_for_owner: false,
          hidden_for_owner_at: null,
        },
      });
    }

    return ctx.send({
      message: 'กู้คืนงานที่ซ่อนไว้ทั้งหมดเรียบร้อย',
      count: tasks.length,
    });
  },
}));

async function fetchTasksForOwner(strapi: any, userId: number, hidden: boolean) {
  return strapi.db.query(taskUid).findMany({
    where: {
      current_owner: userId,
      is_hidden_for_owner: hidden,
    },
    populate: {
      project: true,
      task_log: true,
    },
    orderBy: hidden
      ? [{ hidden_for_owner_at: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }]
      : [{ updatedAt: 'desc' }, { id: 'desc' }],
  });
}

async function fetchNotifications(strapi: any, userId: number, hidden: boolean) {
  return strapi.db.query(notificationUid).findMany({
    where: {
      recipient: userId,
      is_hidden: hidden,
    },
    orderBy: hidden
      ? [{ hidden_at: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }]
      : [{ createdAt: 'desc' }, { id: 'desc' }],
    limit: 20,
  }) as Promise<any[]>;
}

async function getTaskWithOwner(strapi: any, taskId: number) {
  if (!Number.isFinite(taskId)) return null;
  return strapi.db.query(taskUid).findOne({
    where: { id: taskId },
    populate: { current_owner: true },
  }) as Promise<any>;
}

function validateTaskMutation(
  task: any,
  userId: number,
  mode: 'submit' | 'progress',
  reportText: string,
  allowWithoutFile: boolean,
) {
  return (ctx: any) => {
    if (!task) return ctx.notFound('ไม่พบงาน');
    if (task.current_owner?.id !== userId) return ctx.forbidden('คุณไม่ใช่ผู้รับผิดชอบงานนี้');
    if (task.status_task !== 'in_progress') {
      return ctx.badRequest(
        mode === 'submit'
          ? 'งานนี้ไม่ได้อยู่ระหว่างดำเนินการ'
          : 'อัปเดตความคืบหน้าได้เฉพาะงานที่กำลังดำเนินการอยู่',
      );
    }
    if (!allowWithoutFile) return ctx.badRequest('กรุณาแนบรูปหลักฐาน');
    if (!reportText || reportText.length < 5) {
      return ctx.badRequest(
        mode === 'submit'
          ? 'รายละเอียดงานต้องยาวอย่างน้อย 5 ตัวอักษร'
          : 'ข้อความอัปเดตต้องยาวอย่างน้อย 5 ตัวอักษร',
      );
    }
    return null;
  };
}

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

async function readUploadedFileBuffer(file: any): Promise<Buffer> {
  if (!file) throw new Error('proof_image is missing');
  if (Buffer.isBuffer(file.data)) return file.data;
  if (Buffer.isBuffer(file.buffer)) return file.buffer;
  if (file.data !== undefined && file.data !== null) return Buffer.from(file.data);
  if (file.buffer !== undefined && file.buffer !== null) return Buffer.from(file.buffer);

  const filePath = file.filepath || file.path || file.tempFilePath;
  if (typeof filePath === 'string' && filePath.length > 0) return fs.readFile(filePath);

  throw new Error('Cannot read uploaded proof image buffer');
}
