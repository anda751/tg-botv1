import { factories } from '@strapi/strapi';
import { uploadProofImage } from '../../../services/supabase';

export default factories.createCoreController('api::task.task', ({ strapi }) => ({
  // ===== สร้างงานใหม่ =====
  async create(ctx) {
    const user = ctx.state.user;
    const { name, project } = ctx.request.body.data;

    if (!/[a-zA-Zก-๙]/.test(name)) {
      return ctx.badRequest('ชื่องานต้องมีตัวอักษรภาษาไทยหรืออังกฤษอย่างน้อย 1 ตัว');
    }

    ctx.request.body.data = {
      ...ctx.request.body.data,
      current_owner: user.id,
      creator: user.id,
      status_task: 'in_progress',
    };

    const response = await super.create(ctx);

    await strapi.entityService.create('api::task-log.task-log', {
      data: {
        task: response.data.id,
        action: 'created',
        actor: user.id,
        note: `สร้างงาน: ${name}`,
      },
    });

    await strapi.service('api::task.task').notifyGroup({
      message: `📋 งานใหม่: *${name}*\nผู้รับผิดชอบ: ${user.username}`,
    });

    return response;
  },

  // ===== ส่งงาน (Under Review) =====
  async submit(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    const { report_text } = ctx.request.body;
    const file = (ctx.request as any).files?.proof_image;

    const task = await strapi.entityService.findOne('api::task.task', id, {
      populate: ['current_owner'],
    }) as any;

    if (!task) return ctx.notFound('ไม่พบงานนี้');
    if (task.current_owner.id !== user.id) return ctx.forbidden('คุณไม่ใช่เจ้าของงานนี้');
    if (task.status_task !== 'in_progress') return ctx.badRequest('งานนี้ไม่ได้อยู่ในสถานะ In Progress');

    if (!file) return ctx.badRequest('กรุณาแนบรูปหลักฐาน');
    if (!report_text || report_text.length < 5) return ctx.badRequest('รายงานต้องมีอย่างน้อย 5 ตัวอักษร');

    // อัปโหลดขึ้น Supabase Storage
    const imagePath = await uploadProofImage(
      file.data,
      file.name,
      file.type,
    );

    await strapi.entityService.create('api::proof-image.proof-image', {
      data: {
        task: id,
        image_url: imagePath,  // เก็บ path ไว้ใน DB
        report_text,
        submitted_by: user.id,
        submitted_at: new Date(),
      },
    });

    await strapi.entityService.update('api::task.task', id, {
      data: { status_task: 'under_review' },
    });

    await strapi.entityService.create('api::task-log.task-log', {
      data: {
        task: id,
        action: 'submitted',
        actor: user.id,
        note: report_text,
      },
    });

    await strapi.service('api::task.task').notifyManager({
      taskId: id,
      taskName: task.name,
      submittedBy: user.username,
      reportText: report_text,
      imageUrl: imagePath,
    });

    return ctx.send({ message: 'ส่งงานเรียบร้อย รอหัวหน้าตรวจสอบ' });
  },
  // ===== อนุมัติงาน (Manager) =====
  async approve(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const task = await strapi.entityService.findOne('api::task.task', id, {
      populate: ['current_owner'],
    }) as any;  // ← cast as any

    if (!task) return ctx.notFound('ไม่พบงานนี้');
    if (task.status_task !== 'under_review') return ctx.badRequest('งานนี้ไม่ได้รอการตรวจ');

    await strapi.entityService.update('api::task.task', id, {
      data: { status_task: 'done' },
    });

    await strapi.entityService.create('api::task-log.task-log', {
      data: {
        task: id,
        action: 'approved',
        actor: user.id,
      },
    });

    await strapi.service('api::task.task').notifyGroup({
      message: `✅ งานเสร็จสมบูรณ์: *${task.name}*\nโดย: ${task.current_owner.username}`,
    });

    return ctx.send({ message: 'อนุมัติงานเรียบร้อย' });
  },

  // ===== ปฏิเสธงาน (Manager) =====
  async reject(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    const { reason } = ctx.request.body;

    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
    if (!reason || reason.length < 5) return ctx.badRequest('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร');

    const task = await strapi.entityService.findOne('api::task.task', id, {
      populate: ['current_owner'],
    }) as any;  // ← cast as any

    if (!task) return ctx.notFound('ไม่พบงานนี้');

    await strapi.entityService.update('api::task.task', id, {
      data: { status_task: 'in_progress' },
    });

    await strapi.entityService.create('api::task-log.task-log', {
      data: {
        task: id,
        action: 'rejected',
        actor: user.id,
        note: reason,
      },
    });

    await strapi.service('api::task.task').notifyStaff({
      userId: task.current_owner.id,
      message: `⚠️ งาน *${task.name}* ถูกส่งกลับ\nเหตุผล: ${reason}`,
    });

    return ctx.send({ message: 'ส่งกลับงานเรียบร้อย' });
  },

}));