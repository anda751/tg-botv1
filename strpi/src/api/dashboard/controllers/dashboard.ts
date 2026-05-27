import { factories } from '@strapi/strapi';
import { resolveImageUrl } from '../../../services/supabase';

const userUid = 'plugin::users-permissions.user' as any;
const taskUid = 'api::task.task' as any;
const taskLogUid = 'api::task-log.task-log' as any;
const projectLogUid = 'api::project-log.project-log' as any;
const projectUid = 'api::project.project' as any;
const proofImageUid = 'api::proof-image.proof-image' as any;
const notificationUid = 'api::notification.notification' as any;
const joinRequestUid = 'api::project-join-request.project-join-request' as any;
const handoverRequestUid = 'api::handover-request.handover-request' as any;

type TaskLog = {
  id: number
  action: 'created' | 'submitted' | 'approved' | 'rejected' | 'handover' | 'picked_up' | 'progress_update'
  note?: string
  createdAt?: string
  task?: { id: number } | null
}

type TaskEntity = {
  id: number
  name: string
  status_task: 'in_progress' | 'under_review' | 'waiting_pickup' | 'done'
  createdAt?: string
  updatedAt?: string
  current_owner?: { id: number; display_name?: string; username?: string } | null
  project?: { id: number; name: string; deadline?: string | null; status_project?: string } | null
}

type StaffEntity = {
  id: number
  display_name?: string
  username?: string
  telegram_id?: string
}

export default factories.createCoreController('api::task.task', ({ strapi }) => ({
  async home(ctx) {
    ensureManager(ctx);

    const [summary, underReview, notifications, pendingHandover] = await Promise.all([
      buildSummary(strapi),
      buildUnderReview(strapi),
      buildNotifications(strapi, ctx.state.user.id),
      buildPendingHandovers(strapi),
    ]);

    return ctx.send({
      summary,
      under_review: underReview,
      notifications,
      pending_handover: pendingHandover,
    });
  },

  async reports(ctx) {
    ensureManager(ctx);

    const [summary, staff] = await Promise.all([
      buildSummary(strapi),
      buildStaffOverview(strapi),
    ]);

    return ctx.send({
      summary,
      staff,
    });
  },

  async summary(ctx) {
    ensureManager(ctx);
    return ctx.send(await buildSummary(strapi));
  },

  async pendingTasks(ctx) {
    ensureManager(ctx);

    const tasks = await strapi.db.query(taskUid).findMany({
      where: { status_task: { $ne: 'done' } },
      populate: {
        current_owner: {
          select: ['id', 'display_name', 'username'],
        },
        task_log: {
          select: ['id'],
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }) as any[];

    return ctx.send(
      tasks.map((task) => ({
        id: task.id,
        name: task.name,
        status_task: task.status_task,
        current_owner: task.current_owner
          ? {
              id: task.current_owner.id,
              display_name: task.current_owner.display_name,
              username: task.current_owner.username,
            }
          : null,
        created_at: task.createdAt,
        log_count: task.task_log?.length ?? 0,
      })),
    );
  },

  async underReview(ctx) {
    ensureManager(ctx);
    return ctx.send(await buildUnderReview(strapi));
  },

  async staffOverview(ctx) {
    ensureManager(ctx);
    return ctx.send(await buildStaffOverview(strapi));
  },

  async staffKpi(ctx) {
    ensureManager(ctx);

    const days = normalizeRangeDays(ctx.request.query?.days);
    const now = new Date();
    const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const recentActivityStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const staffList = await strapi.db.query(userUid).findMany({
      where: { role_app: 'staff', is_approved: true },
      select: ['id', 'display_name', 'username', 'telegram_id'],
      orderBy: [{ display_name: 'asc' }, { username: 'asc' }],
    }) as StaffEntity[];

    const tasks = await strapi.db.query(taskUid).findMany({
      select: ['id', 'name', 'status_task', 'createdAt', 'updatedAt'],
      populate: {
        current_owner: {
          select: ['id', 'display_name', 'username'],
        },
        project: {
          select: ['id', 'name', 'deadline', 'status_project'],
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    }) as TaskEntity[];

    const taskLogs = await strapi.db.query(taskLogUid).findMany({
      select: ['id', 'action', 'note', 'createdAt'],
      populate: {
        task: {
          select: ['id'],
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }) as TaskLog[];

    const logsByTaskId = new Map<number, TaskLog[]>();
    for (const log of taskLogs) {
      const taskId = Number(log.task?.id);
      if (!Number.isFinite(taskId)) continue;
      const bucket = logsByTaskId.get(taskId) ?? [];
      bucket.push(log);
      logsByTaskId.set(taskId, bucket);
    }

    const staffMap = new Map<number, ReturnType<typeof createEmptyKpi>>();
    for (const member of staffList) {
      staffMap.set(member.id, createEmptyKpi(member));
    }

    for (const task of tasks) {
      const ownerId = Number(task.current_owner?.id);
      if (!staffMap.has(ownerId)) continue;

      const entry = staffMap.get(ownerId)!;
      entry.tasks_total += 1;

      const logs = logsByTaskId.get(task.id) ?? [];

      if (task.status_task === 'in_progress') entry.active_in_progress += 1;
      if (task.status_task === 'under_review') entry.active_under_review += 1;
      if (task.status_task === 'waiting_pickup') entry.active_waiting_pickup += 1;
      if (task.status_task !== 'done') entry.active_tasks += 1;

      const lastActivityAt = getLastActivityAt(task, logs);
      if (task.status_task !== 'done') {
        if (lastActivityAt && lastActivityAt >= recentActivityStart) {
          entry.active_updated_recently += 1;
        } else {
          entry.stale_active_tasks += 1;
        }
      }

      const progressUpdates = logs.filter(
        (log) => log.action === 'progress_update' && isWithinRange(log.createdAt, windowStart, now),
      );
      entry.progress_updates += progressUpdates.length;

      const approvedLogs = logs.filter(
        (log) => log.action === 'approved' && isWithinRange(log.createdAt, windowStart, now),
      );
      const rejectedLogs = logs.filter(
        (log) => log.action === 'rejected' && isWithinRange(log.createdAt, windowStart, now),
      );

      entry.review_cycles += approvedLogs.length + rejectedLogs.length;
      entry.rejected_cycles += rejectedLogs.length;
      entry.completed_tasks += approvedLogs.length;

      for (const approvedLog of approvedLogs) {
        const approvedAt = new Date(String(approvedLog.createdAt));
        const createdAt = new Date(String(task.createdAt || approvedLog.createdAt));
        if (!Number.isNaN(createdAt.getTime()) && !Number.isNaN(approvedAt.getTime())) {
          entry.total_completion_hours += Math.max(0, (approvedAt.getTime() - createdAt.getTime()) / 36e5);
          entry.completion_samples += 1;
        }

        const deadline = task.project?.deadline ? new Date(task.project.deadline) : null;
        if (deadline && !Number.isNaN(deadline.getTime())) {
          entry.deadline_tracked_completed += 1;
          if (approvedAt.getTime() <= deadline.getTime()) {
            entry.on_time_completed += 1;
          }
        }
      }
    }

    const outputTarget = Math.max(2, Math.round((days / 30) * 8));
    const result = Array.from(staffMap.values())
      .map((entry) => finalizeKpi(entry, { outputTarget }))
      .sort((a, b) => b.total_score - a.total_score || a.display_name.localeCompare(b.display_name, 'th'));

    return ctx.send({
      window_days: days,
      generated_at: now.toISOString(),
      formula_guide: buildFormulaGuide(days, outputTarget),
      staff: result,
    });
  },

  async history(ctx) {
    ensureManager(ctx);
    const days = normalizeRangeDays(ctx.request.query?.days);
    const items = await buildActionHistory(strapi, days);

    return ctx.send({
      window_days: days,
      generated_at: new Date().toISOString(),
      total: items.length,
      items,
    });
  },
}));

function ensureManager(ctx: any) {
  if (ctx.state.user.role_app !== 'manager') {
    throw ctx.forbidden('เฉพาะหัวหน้าเท่านั้น');
  }
}

async function buildSummary(strapi: any) {
  const [tasks, projects, staffList] = await Promise.all([
    strapi.db.query(taskUid).findMany({
      select: ['id', 'status_task'],
    }),
    strapi.db.query(projectUid).findMany({
      select: ['id', 'deadline', 'status_project'],
    }),
    strapi.db.query(userUid).findMany({
      where: { role_app: 'staff', is_approved: true },
      select: ['id'],
    }),
  ]) as [any[], any[], any[]];

  const tasksByStatus = tasks.reduce((acc: Record<string, number>, task: any) => {
    acc[task.status_task] = (acc[task.status_task] ?? 0) + 1;
    return acc;
  }, {});

  const now = new Date();
  const overdueProjects = projects.filter(
    (project: any) => project.status_project === 'active' && new Date(project.deadline) < now,
  );

  return {
    tasks: {
      total: tasks.length,
      in_progress: tasksByStatus.in_progress ?? 0,
      under_review: tasksByStatus.under_review ?? 0,
      waiting_pickup: tasksByStatus.waiting_pickup ?? 0,
      done: tasksByStatus.done ?? 0,
    },
    projects: {
      total: projects.length,
      active: projects.filter((project: any) => project.status_project === 'active').length,
      overdue: overdueProjects.length,
    },
    staff: {
      total: staffList.length,
    },
  };
}

async function buildUnderReview(strapi: any) {
  const tasks = await strapi.db.query(taskUid).findMany({
    where: { status_task: 'under_review' },
    populate: {
      current_owner: {
        select: ['id', 'display_name'],
      },
    },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
  }) as any[];

  const proofs = await strapi.db.query(proofImageUid).findMany({
    select: ['id', 'image_url', 'report_text', 'submitted_at'],
    populate: {
      task: {
        select: ['id'],
      },
    },
    orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }],
  }) as any[];

  const latestProofByTaskId = new Map<number, any>();
  for (const proof of proofs) {
    const taskId = Number(proof.task?.id);
    if (!Number.isFinite(taskId) || latestProofByTaskId.has(taskId)) continue;
    latestProofByTaskId.set(taskId, proof);
  }

  const result = [];
  for (const task of tasks) {
    const latestProof = latestProofByTaskId.get(task.id) ?? null;
    let imageUrl: string | null = null;

    if (latestProof?.image_url) {
      try {
        imageUrl = await resolveImageUrl(latestProof.image_url);
      } catch {
        imageUrl = null;
      }
    }

    result.push({
      id: task.id,
      name: task.name,
      current_owner: task.current_owner
        ? { id: task.current_owner.id, display_name: task.current_owner.display_name }
        : null,
      latest_proof: latestProof
        ? {
            image_url: imageUrl,
            report_text: latestProof.report_text,
            submitted_at: latestProof.submitted_at,
          }
        : null,
    });
  }

  return result;
}

async function buildStaffOverview(strapi: any) {
  const [staffList, activeTasks] = await Promise.all([
    strapi.db.query(userUid).findMany({
      where: { role_app: 'staff', is_approved: true },
      select: ['id', 'display_name', 'username', 'telegram_id'],
      orderBy: [{ display_name: 'asc' }, { username: 'asc' }],
    }),
    strapi.db.query(taskUid).findMany({
      where: { status_task: { $ne: 'done' } },
      populate: {
        current_owner: {
          select: ['id'],
        },
      },
      select: ['id'],
    }),
  ]) as [any[], any[]];

  const taskCount: Record<number, number> = {};
  for (const task of activeTasks) {
    const ownerId = Number(task.current_owner?.id);
    if (Number.isFinite(ownerId)) {
      taskCount[ownerId] = (taskCount[ownerId] ?? 0) + 1;
    }
  }

  return staffList.map((member: any) => ({
    id: member.id,
    display_name: member.display_name,
    username: member.username,
    telegram_id: member.telegram_id,
    active_tasks: taskCount[member.id] ?? 0,
  }));
}

async function buildNotifications(strapi: any, userId: number) {
  const notifications = await strapi.db.query(notificationUid).findMany({
    where: {
      recipient: userId,
      is_hidden: false,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    limit: 5,
  }) as any[];

  return notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    link: notification.link || '',
    is_read: !!notification.is_read,
    createdAt: notification.createdAt,
  }));
}

async function buildPendingHandovers(strapi: any) {
  const requests = await strapi.db.query(handoverRequestUid).findMany({
    where: {
      status_handover: 'pending',
    },
    select: ['id', 'reason', 'expires_at', 'createdAt'],
    populate: {
      task: {
        select: ['id', 'name'],
        populate: {
          project: { select: ['id', 'name'] },
          current_owner: { select: ['id', 'display_name', 'username'] },
        },
      },
      requested_by: { select: ['id', 'display_name', 'username'] },
      picked_up_by: { select: ['id', 'display_name', 'username'] },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    limit: 20,
  }) as any[];

  const now = Date.now();

  return requests
    .filter((item) => item.picked_up_by)
    .map((item) => ({
      id: item.id,
      reason: item.reason || '',
      expires_at: item.expires_at,
      is_expired: item.expires_at ? new Date(item.expires_at).getTime() <= now : false,
      task: item.task
        ? {
            id: item.task.id,
            name: item.task.name,
            project: item.task.project
              ? {
                  id: item.task.project.id,
                  name: item.task.project.name,
                }
              : null,
            current_owner: item.task.current_owner
              ? {
                  id: item.task.current_owner.id,
                  display_name: item.task.current_owner.display_name,
                  username: item.task.current_owner.username,
                }
              : null,
          }
        : null,
      requested_by: item.requested_by
        ? {
            id: item.requested_by.id,
            display_name: item.requested_by.display_name,
            username: item.requested_by.username,
          }
        : null,
      picked_up_by: item.picked_up_by
        ? {
            id: item.picked_up_by.id,
            display_name: item.picked_up_by.display_name,
            username: item.picked_up_by.username,
          }
        : null,
      createdAt: item.createdAt,
    }));
}

async function buildActionHistory(strapi: any, days: number) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [taskLogs, joinRequests, projectLogs] = await Promise.all([
    strapi.db.query(taskLogUid).findMany({
      where: {
        action: {
          $in: ['approved', 'rejected', 'handover', 'picked_up', 'submitted', 'progress_update'],
        },
        createdAt: { $gte: windowStart.toISOString() },
      },
      select: ['id', 'action', 'note', 'createdAt'],
      populate: {
        actor: { select: ['id', 'display_name', 'username'] },
        task: {
          select: ['id', 'name', 'status_task'],
          populate: {
            project: { select: ['id', 'name'] },
            current_owner: { select: ['id', 'display_name', 'username'] },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      limit: 200,
    }) as Promise<any[]>,
    strapi.db.query(joinRequestUid).findMany({
      where: {
        status_request: { $in: ['approved', 'rejected'] },
        updatedAt: { $gte: windowStart.toISOString() },
      },
      select: ['id', 'status_request', 'note', 'review_note', 'createdAt', 'updatedAt'],
      populate: {
        project: { select: ['id', 'name'] },
        requested_by: { select: ['id', 'display_name', 'username'] },
        reviewed_by: { select: ['id', 'display_name', 'username'] },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      limit: 200,
    }) as Promise<any[]>,
    strapi.db.query(projectLogUid).findMany({
      where: {
        createdAt: { $gte: windowStart.toISOString() },
      },
      select: ['id', 'action', 'note', 'createdAt'],
      populate: {
        actor: { select: ['id', 'display_name', 'username'] },
        project: { select: ['id', 'name', 'status_project'] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      limit: 200,
    }) as Promise<any[]>,
  ]);

  const taskItems = taskLogs.map((log) => {
    const action = String(log.action || '');
    const actorName = getUserLabel(log.actor);
    const ownerName = getUserLabel(log.task?.current_owner);
    const taskName = log.task?.name || 'งานไม่ระบุชื่อ';
    const projectName = log.task?.project?.name || '';

    return {
      id: 'task-log-' + log.id,
      category: 'task',
      action,
      tone: getHistoryTone(action),
      occurred_at: log.createdAt,
      title: getTaskHistoryTitle(action),
      summary: getTaskHistorySummary(action, taskName, actorName, ownerName),
      detail: log.note || '',
      actor: actorName,
      subject_user: ownerName,
      task: log.task
        ? {
            id: log.task.id,
            name: taskName,
            status_task: log.task.status_task,
          }
        : null,
      project: log.task?.project
        ? {
            id: log.task.project.id,
            name: projectName,
          }
        : null,
    };
  });

  const requestItems = joinRequests.map((request) => {
    const approved = request.status_request === 'approved';
    const actorName = getUserLabel(request.reviewed_by);
    const requesterName = getUserLabel(request.requested_by);
    const projectName = request.project?.name || 'โปรเจกต์ไม่ระบุชื่อ';

    return {
      id: 'join-request-' + request.id,
      category: 'project_join',
      action: request.status_request,
      tone: approved ? 'green' : 'red',
      occurred_at: request.updatedAt || request.createdAt,
      title: approved ? 'อนุมัติคำขอเข้าโปรเจกต์' : 'ปฏิเสธคำขอเข้าโปรเจกต์',
      summary: approved
        ? actorName + ' อนุมัติให้ ' + requesterName + ' เข้าโปรเจกต์ ' + projectName
        : actorName + ' ปฏิเสธคำขอของ ' + requesterName + ' สำหรับโปรเจกต์ ' + projectName,
      detail: request.review_note || request.note || '',
      actor: actorName,
      subject_user: requesterName,
      task: null,
      project: request.project
        ? {
            id: request.project.id,
            name: projectName,
          }
        : null,
    };
  });

  const projectItems = projectLogs.map((log) => {
    const actorName = getUserLabel(log.actor);
    const projectName = log.project?.name || 'โปรเจกต์ไม่ระบุชื่อ';
    const action = String(log.action || '');

    return {
      id: 'project-log-' + log.id,
      category: 'project',
      action,
      tone: getProjectHistoryTone(action),
      occurred_at: log.createdAt,
      title: getProjectHistoryTitle(action),
      summary: getProjectHistorySummary(action, actorName, projectName),
      detail: log.note || '',
      actor: actorName,
      subject_user: '',
      task: null,
      project: log.project
        ? {
            id: log.project.id,
            name: projectName,
          }
        : null,
    };
  });

  return [...taskItems, ...requestItems, ...projectItems]
    .sort((a, b) => toTime(b.occurred_at) - toTime(a.occurred_at))
    .slice(0, 200);
}

function getProjectHistoryTitle(action: string) {
  switch (action) {
    case 'closed':
      return 'ปิดโปรเจกต์';
    case 'member_added':
      return 'เพิ่มสมาชิก';
    case 'member_removed':
      return 'ลบสมาชิก';
    default:
      return 'สร้างโปรเจกต์';
  }
}

function getProjectHistorySummary(action: string, actorName: string, projectName: string) {
  switch (action) {
    case 'closed':
      return actorName + ' ปิดโปรเจกต์ ' + projectName;
    case 'member_added':
      return actorName + ' เพิ่มสมาชิกในโปรเจกต์ ' + projectName;
    case 'member_removed':
      return actorName + ' ลบสมาชิกออกจากโปรเจกต์ ' + projectName;
    default:
      return actorName + ' สร้างโปรเจกต์ ' + projectName;
  }
}

function getProjectHistoryTone(action: string) {
  switch (action) {
    case 'closed':
      return 'red';
    case 'member_added':
    case 'member_removed':
      return 'blue';
    default:
      return 'green';
  }
}
function normalizeRangeDays(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(90, Math.max(7, Math.round(parsed)));
}

function getUserLabel(user: any) {
  if (!user) return 'ไม่ระบุผู้ใช้';
  return user.display_name || user.username || `User #${user.id}`;
}

function getTaskHistoryTitle(action: string) {
  switch (action) {
    case 'approved':
      return 'อนุมัติงาน';
    case 'rejected':
      return 'ส่งงานกลับ';
    case 'handover':
      return 'ส่งต่องาน';
    case 'picked_up':
      return 'รับงานช่วงต่อ';
    case 'submitted':
      return 'ส่งงานเข้าตรวจ';
    case 'progress_update':
      return 'อัปเดตความคืบหน้า';
    default:
      return 'อัปเดตงาน';
  }
}

function getTaskHistorySummary(action: string, taskName: string, actorName: string, ownerName: string) {
  switch (action) {
    case 'approved':
      return `${actorName} อนุมัติงาน ${taskName} ของ ${ownerName}`;
    case 'rejected':
      return `${actorName} ส่งงาน ${taskName} กลับไปให้ ${ownerName} แก้ไข`;
    case 'handover':
      return `${actorName} ส่งต่องาน ${taskName}`;
    case 'picked_up':
      return `${actorName} รับช่วงต่องาน ${taskName}`;
    case 'submitted':
      return `${actorName} ส่งงาน ${taskName} เข้าตรวจ`;
    case 'progress_update':
      return `${actorName} อัปเดตความคืบหน้าของงาน ${taskName}`;
    default:
      return `${actorName} อัปเดตงาน ${taskName}`;
  }
}

function getHistoryTone(action: string) {
  switch (action) {
    case 'approved':
    case 'picked_up':
      return 'green';
    case 'rejected':
      return 'red';
    case 'handover':
      return 'amber';
    default:
      return 'blue';
  }
}

function toTime(value?: string) {
  const time = new Date(String(value || '')).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isWithinRange(value: string | undefined, start: Date, end: Date) {
  const time = toTime(value);
  return time >= start.getTime() && time <= end.getTime();
}

function getLastActivityAt(task: TaskEntity, logs: TaskLog[]) {
  const latestLog = logs[logs.length - 1]?.createdAt;
  if (latestLog) {
    const date = new Date(latestLog);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const fallback = task.updatedAt || task.createdAt;
  if (!fallback) return null;
  const date = new Date(fallback);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createEmptyKpi(member: StaffEntity) {
  return {
    id: member.id,
    display_name: member.display_name || member.username || `Staff #${member.id}`,
    username: member.username || '',
    telegram_id: member.telegram_id || '',
    tasks_total: 0,
    completed_tasks: 0,
    review_cycles: 0,
    rejected_cycles: 0,
    active_tasks: 0,
    active_in_progress: 0,
    active_under_review: 0,
    active_waiting_pickup: 0,
    active_updated_recently: 0,
    stale_active_tasks: 0,
    progress_updates: 0,
    on_time_completed: 0,
    deadline_tracked_completed: 0,
    total_completion_hours: 0,
    completion_samples: 0,
  };
}

function finalizeKpi(
  entry: ReturnType<typeof createEmptyKpi>,
  config: { outputTarget: number },
) {
  const rejectionRate = entry.review_cycles > 0
    ? round((entry.rejected_cycles / entry.review_cycles) * 100)
    : 0;

  const onTimeRate = entry.deadline_tracked_completed > 0
    ? round((entry.on_time_completed / entry.deadline_tracked_completed) * 100)
    : null;

  const avgCompletionHours = entry.completion_samples > 0
    ? round(entry.total_completion_hours / entry.completion_samples)
    : null;

  const updateRate = entry.active_tasks > 0
    ? round((entry.active_updated_recently / entry.active_tasks) * 100)
    : 100;

  const outputScore = Math.min(100, round((entry.completed_tasks / config.outputTarget) * 100));
  const qualityScore = scoreQuality(rejectionRate, entry.review_cycles);
  const onTimeScore = scoreOnTime(onTimeRate, entry.deadline_tracked_completed);
  const speedScore = scoreSpeed(avgCompletionHours, entry.completion_samples);
  const updateScore = scoreUpdate(updateRate, entry.active_tasks);

  const totalScore = round(
    outputScore * 0.2
    + qualityScore * 0.3
    + onTimeScore * 0.2
    + speedScore * 0.15
    + updateScore * 0.15,
  );

  return {
    ...entry,
    rejection_rate: rejectionRate,
    on_time_rate: onTimeRate,
    avg_completion_hours: avgCompletionHours,
    update_rate: updateRate,
    output_target: config.outputTarget,
    output_score: outputScore,
    quality_score: qualityScore,
    on_time_score: onTimeScore,
    speed_score: speedScore,
    update_score: updateScore,
    total_score: totalScore,
    status: getKpiStatus(totalScore),
    focus_note: buildFocusNote({
      rejectionRate,
      onTimeRate,
      avgCompletionHours,
      updateRate,
      activeTasks: entry.active_tasks,
      staleActiveTasks: entry.stale_active_tasks,
      completedTasks: entry.completed_tasks,
      outputTarget: config.outputTarget,
    }),
  };
}

function scoreQuality(rejectionRate: number, reviewedCount: number) {
  if (reviewedCount === 0) return 80;
  if (rejectionRate <= 10) return 100;
  if (rejectionRate <= 20) return 85;
  if (rejectionRate <= 30) return 70;
  return 50;
}

function scoreOnTime(onTimeRate: number | null, trackedCount: number) {
  if (trackedCount === 0 || onTimeRate === null) return 80;
  if (onTimeRate >= 90) return 100;
  if (onTimeRate >= 75) return 85;
  if (onTimeRate >= 60) return 70;
  return 50;
}

function scoreSpeed(avgHours: number | null, sampleCount: number) {
  if (sampleCount === 0 || avgHours === null) return 75;
  if (avgHours <= 48) return 100;
  if (avgHours <= 96) return 85;
  if (avgHours <= 168) return 70;
  return 50;
}

function scoreUpdate(updateRate: number, activeTasks: number) {
  if (activeTasks === 0) return 100;
  if (updateRate >= 90) return 100;
  if (updateRate >= 75) return 85;
  if (updateRate >= 60) return 70;
  return 45;
}

function getKpiStatus(totalScore: number) {
  if (totalScore >= 85) return { label: 'ดีมาก', tone: 'green' as const };
  if (totalScore >= 70) return { label: 'ดี', tone: 'blue' as const };
  if (totalScore >= 55) return { label: 'เฝ้าดู', tone: 'amber' as const };
  return { label: 'เร่งติดตาม', tone: 'red' as const };
}

function buildFocusNote(input: {
  rejectionRate: number
  onTimeRate: number | null
  avgCompletionHours: number | null
  updateRate: number
  activeTasks: number
  staleActiveTasks: number
  completedTasks: number
  outputTarget: number
}) {
  if (input.rejectionRate > 20) return 'งานถูกส่งกลับค่อนข้างบ่อย ควรช่วยดูคุณภาพก่อนส่ง';
  if (input.onTimeRate !== null && input.onTimeRate < 75) return 'งานเสร็จไม่ค่อยทันเวลา ควรช่วยจัดลำดับความสำคัญ';
  if (input.activeTasks > 0 && input.updateRate < 75) return 'งานที่เปิดอยู่ยังอัปเดตไม่สม่ำเสมอ ควรติดตามความคืบหน้า';
  if (input.avgCompletionHours !== null && input.avgCompletionHours > 168) return 'ใช้เวลาปิดงานค่อนข้างนาน ควรช่วยปลด blocker';
  if (input.completedTasks < input.outputTarget * 0.5) return 'จำนวนงานที่ปิดได้ยังต่ำกว่าเป้าช่วงนี้';
  if (input.staleActiveTasks > 0) return 'ยังมีงานค้างที่ไม่ค่อยขยับ ควรเปิดดูงานค้างล่าสุด';
  return 'ภาพรวมค่อนข้างนิ่ง ทำงานต่อเนื่องดี';
}

function buildFormulaGuide(days: number, outputTarget: number) {
  return {
    window_label: `ย้อนหลัง ${days} วัน`,
    weights: [
      { key: 'output', label: 'ปริมาณงานปิดสำเร็จ', weight: 20, formula: `งานที่อนุมัติแล้ว / เป้า ${outputTarget} งาน` },
      { key: 'quality', label: 'คุณภาพงาน', weight: 30, formula: '100 - อัตรางานตีกลับตามช่วง threshold' },
      { key: 'on_time', label: 'ตรงเวลา', weight: 20, formula: 'งานที่อนุมัติก่อน deadline / งานที่มี deadline' },
      { key: 'speed', label: 'ความเร็วเฉลี่ย', weight: 15, formula: 'เวลาตั้งแต่สร้างงานจนอนุมัติ (ชั่วโมงเฉลี่ย)' },
      { key: 'update', label: 'ความสม่ำเสมอในการอัปเดต', weight: 15, formula: 'งาน active ที่มีความเคลื่อนไหวใน 7 วัน / งาน active ทั้งหมด' },
    ],
    thresholds: {
      quality: [
        'ตีกลับ <= 10% = 100 คะแนน',
        'ตีกลับ 11-20% = 85 คะแนน',
        'ตีกลับ 21-30% = 70 คะแนน',
        'ตีกลับ > 30% = 50 คะแนน',
      ],
      on_time: [
        'ตรงเวลา >= 90% = 100 คะแนน',
        '75-89% = 85 คะแนน',
        '60-74% = 70 คะแนน',
        '< 60% = 50 คะแนน',
      ],
      speed: [
        'ปิดงานเฉลี่ย <= 48 ชม. = 100 คะแนน',
        '49-96 ชม. = 85 คะแนน',
        '97-168 ชม. = 70 คะแนน',
        '> 168 ชม. = 50 คะแนน',
      ],
      update: [
        'อัปเดตงาน active ใน 7 วัน >= 90% = 100 คะแนน',
        '75-89% = 85 คะแนน',
        '60-74% = 70 คะแนน',
        '< 60% = 45 คะแนน',
      ],
      total: [
        'รวม >= 85 = ดีมาก',
        '70-84 = ดี',
        '55-69 = เฝ้าดู',
        '< 55 = เร่งติดตาม',
      ],
    },
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
