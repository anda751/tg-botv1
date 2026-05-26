import { factories } from '@strapi/strapi';

const projectUid = 'api::project.project' as any;
const notificationUid = 'api::notification.notification' as any;

export default factories.createCoreService(projectUid, ({ strapi }) => ({
  async syncOverdueNotifications() {
    const now = new Date();

    const projects = await strapi.entityService.findMany(projectUid, {
      filters: {
        status_project: 'active',
      },
      populate: ['creator', 'members'],
      limit: -1,
      sort: ['deadline:asc', 'id:asc'],
    }) as any[];

    const overdueProjects = projects.filter((project) => {
      const deadline = new Date(project.deadline);
      return !Number.isNaN(deadline.getTime()) && deadline < now;
    });

    for (const project of overdueProjects) {
      const deadlineText = formatDeadline(project.deadline);
      const recipients = new Map<number, { title: string; message: string; link: string }>();

      if (project.creator?.id) {
        recipients.set(Number(project.creator.id), {
          title: 'โปรเจกต์เกินกำหนด',
          message: `โปรเจกต์ "${project.name}" เลยกำหนดแล้วตั้งแต่ ${deadlineText} กรุณาตรวจสอบและติดตามงานในโปรเจกต์นี้`,
          link: '/projects',
        });
      }

      for (const member of project.members ?? []) {
        if (!member?.id) continue;
        recipients.set(Number(member.id), {
          title: 'โปรเจกต์ที่คุณอยู่เกินกำหนด',
          message: `โปรเจกต์ "${project.name}" เลยกำหนดแล้วตั้งแต่ ${deadlineText} กรุณาอัปเดตงานหรือประสานกับหัวหน้าโปรเจกต์`,
          link: '/create',
        });
      }

      for (const [recipientId, payload] of recipients.entries()) {
        const existing = await strapi.entityService.findMany(notificationUid, {
          filters: {
            recipient: { id: recipientId },
            type: 'project',
            title: payload.title,
            message: payload.message,
            link: payload.link,
          },
          fields: ['id'],
          limit: 1,
        }) as any[];

        if (existing.length > 0) continue;

        await strapi.entityService.create(notificationUid, {
          data: {
            recipient: recipientId,
            title: payload.title,
            message: payload.message,
            type: 'project',
            link: payload.link,
            is_read: false,
            is_hidden: false,
          },
        });
      }
    }
  },
}));

function formatDeadline(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'วันที่ไม่ระบุ';
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
