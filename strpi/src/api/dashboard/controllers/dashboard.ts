import { factories } from '@strapi/strapi';
import { resolveImageUrl } from '../../../services/supabase';

export default factories.createCoreController('api::task.task', ({ strapi }) => ({
  async summary(ctx) {
    const user = ctx.state.user;
    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const [tasks, projects, staffList] = await Promise.all([
      strapi.entityService.findMany('api::task.task', {
        populate: ['current_owner'],
        limit: -1,
      }) as Promise<any[]>,
      strapi.entityService.findMany('api::project.project', {
        limit: -1,
      }) as Promise<any[]>,
      strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: { role_app: 'staff', is_approved: true },
        limit: -1,
      }) as Promise<any[]>,
    ]);

    const tasksByStatus = tasks.reduce((acc: Record<string, number>, t: any) => {
      acc[t.status_task] = (acc[t.status_task] ?? 0) + 1;
      return acc;
    }, {});

    const now = new Date();
    const overdueProjects = projects.filter(
      (p: any) => p.status_project === 'active' && new Date(p.deadline) < now,
    );

    return ctx.send({
      tasks: {
        total: tasks.length,
        in_progress: tasksByStatus.in_progress ?? 0,
        under_review: tasksByStatus.under_review ?? 0,
        waiting_pickup: tasksByStatus.waiting_pickup ?? 0,
        done: tasksByStatus.done ?? 0,
      },
      projects: {
        total: projects.length,
        active: projects.filter((p: any) => p.status_project === 'active').length,
        overdue: overdueProjects.length,
      },
      staff: {
        total: staffList.length,
      },
    });
  },

  async pendingTasks(ctx) {
    const user = ctx.state.user;
    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const tasks = await strapi.entityService.findMany('api::task.task', {
      filters: { status_task: { $ne: 'done' } },
      populate: ['current_owner', 'task_log'],
      sort: { createdAt: 'asc' },
      limit: -1,
    }) as any[];

    return ctx.send(
      tasks.map((t) => ({
        id: t.id,
        name: t.name,
        status_task: t.status_task,
        current_owner: t.current_owner
          ? { id: t.current_owner.id, display_name: t.current_owner.display_name, username: t.current_owner.username }
          : null,
        created_at: t.createdAt,
        log_count: t.task_log?.length ?? 0,
      })),
    );
  },

  async underReview(ctx) {
    const user = ctx.state.user;
    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const tasks = await strapi.entityService.findMany('api::task.task', {
      filters: { status_task: 'under_review' },
      populate: ['current_owner', 'proof_images'],
      sort: { updatedAt: 'asc' },
      limit: -1,
    }) as any[];

    const result = await Promise.all(
      tasks.map(async (t) => {
        const latestProof = t.proof_images?.sort(
          (a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
        )[0] ?? null;

        let imageUrl: string | null = null;
        if (latestProof?.image_url) {
          try {
            imageUrl = await resolveImageUrl(latestProof.image_url);
          } catch {
            imageUrl = null;
          }
        }

        return {
          id: t.id,
          name: t.name,
          current_owner: t.current_owner
            ? { id: t.current_owner.id, display_name: t.current_owner.display_name }
            : null,
          latest_proof: latestProof ? {
            image_url: imageUrl,
            report_text: latestProof.report_text,
            submitted_at: latestProof.submitted_at,
          } : null,
        };
      }),
    );

    return ctx.send(result);
  },

  async staffOverview(ctx) {
    const user = ctx.state.user;
    if (user.role_app !== 'manager') return ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');

    const [staffList, activeTasks] = await Promise.all([
      strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: { role_app: 'staff', is_approved: true },
        limit: -1,
      }) as Promise<any[]>,
      strapi.entityService.findMany('api::task.task', {
        filters: { status_task: { $ne: 'done' } },
        populate: ['current_owner'],
        limit: -1,
      }) as Promise<any[]>,
    ]);

    const taskCount: Record<number, number> = {};
    for (const t of activeTasks as any[]) {
      if (t.current_owner) {
        taskCount[t.current_owner.id] = (taskCount[t.current_owner.id] ?? 0) + 1;
      }
    }

    return ctx.send(
      (staffList as any[]).map((s) => ({
        id: s.id,
        display_name: s.display_name,
        username: s.username,
        telegram_id: s.telegram_id,
        active_tasks: taskCount[s.id] ?? 0,
      })),
    );
  },
}));
