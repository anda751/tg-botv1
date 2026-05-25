import { factories } from '@strapi/strapi';

type RoleApp = 'manager' | 'staff';

export default factories.createCoreController('plugin::users-permissions.user', ({ strapi }) => ({
  async register(ctx) {
    const { email, display_name, telegram_id, telegram_chat_id, role_app } = ctx.request.body;

    const selectedRole: RoleApp = role_app === 'manager' ? 'manager' : 'staff';
    const requiresApproval = false;

    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedDisplayName = String(display_name ?? '').trim();
    const telegramFromInitData = String(ctx.state?.telegramUser?.id ?? '').trim();

    // Testing-friendly fallback: registration no longer requires Telegram ID in request body.
    const resolvedTelegramId = String(
      telegram_id || telegramFromInitData || `test:${normalizedEmail}`,
    ).trim();
    const resolvedTelegramChatId = String(telegram_chat_id || resolvedTelegramId).trim();

    if (!normalizedEmail || !normalizedDisplayName) {
      return ctx.badRequest('Please provide all required fields');
    }
    if (normalizedDisplayName.length < 2) {
      return ctx.badRequest('Display name must be at least 2 characters');
    }

    const existingEmail = (await strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: {
        email: normalizedEmail,
        role_app: selectedRole,
      },
      limit: 1,
    })) as any[];
    if (existingEmail.length) {
      return ctx.badRequest(`Email is already registered for role ${selectedRole}`);
    }

    const defaultRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });

    if (!defaultRole) return ctx.internalServerError('Authenticated role not found');

    const user = (await strapi.entityService.create('plugin::users-permissions.user', {
      data: {
        email: normalizedEmail,
        username: `${normalizedEmail}:${selectedRole}`,
        display_name: normalizedDisplayName,
        telegram_id: resolvedTelegramId,
        telegram_chat_id: resolvedTelegramChatId,
        role_app: selectedRole,
        is_approved: true,
        role: defaultRole.id,
        confirmed: true,
        blocked: false,
      },
    })) as any;

    await strapi.service('api::task.task').notifyManager({
      taskId: '',
      taskName: '',
      submittedBy: normalizedDisplayName,
      reportText: `New user joined\nName: ${normalizedDisplayName}\nEmail: ${normalizedEmail}\nRole: ${selectedRole}\nTelegram ID: ${resolvedTelegramId}`,
      imageUrl: '',
    });

    return ctx.send({
      message: 'Registration completed',
      userId: user.id,
      requiresApproval,
      role_app: selectedRole,
    });
  },

  async approveUser(ctx) {
    const currentUser = ctx.state.user;
    const { id } = ctx.params;

    if (currentUser.role_app !== 'manager') return ctx.forbidden('Manager role required');

    const target = (await strapi.entityService.findOne('plugin::users-permissions.user', id)) as any;
    if (!target) return ctx.notFound('User not found');
    if (target.is_approved) return ctx.badRequest('User is already approved');

    await strapi.entityService.update('plugin::users-permissions.user', id, {
      data: { is_approved: true },
    });

    await strapi.service('api::task.task').notifyStaff({
      userId: id,
      message: 'Your account has been approved.',
    });

    return ctx.send({ message: 'User approved successfully' });
  },

  async rejectUser(ctx) {
    const currentUser = ctx.state.user;
    const { id } = ctx.params;
    const { reason } = ctx.request.body;

    if (currentUser.role_app !== 'manager') return ctx.forbidden('Manager role required');
    if (!reason || reason.length < 5) return ctx.badRequest('Reason must be at least 5 characters');

    const target = (await strapi.entityService.findOne('plugin::users-permissions.user', id)) as any;
    if (!target) return ctx.notFound('User not found');

    await strapi.service('api::task.task').notifyStaff({
      userId: id,
      message: `Registration rejected\nReason: ${reason}`,
    });

    await strapi.entityService.delete('plugin::users-permissions.user', id);

    return ctx.send({ message: 'User rejected successfully' });
  },

  async me(ctx) {
    const currentUser = ctx.state.user;

    const fullUser = (await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      currentUser.id,
      { populate: [] },
    )) as any;

    if (!fullUser) return ctx.notFound('User not found');

    return ctx.send({
      id: fullUser.id,
      email: fullUser.email,
      display_name: fullUser.display_name,
      telegram_id: fullUser.telegram_id,
      role_app: fullUser.role_app,
      is_approved: fullUser.is_approved,
    });
  },
}));
