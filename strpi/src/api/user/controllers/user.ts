import { factories } from '@strapi/strapi';

type RoleApp = 'manager' | 'staff';

export default factories.createCoreController('plugin::users-permissions.user', ({ strapi }) => ({
  async register(ctx) {
    const { username, email, password, display_name, role_app } = ctx.request.body ?? {};

    const normalizedUsername = String(username ?? '').trim().toLowerCase();
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedDisplayName = String(display_name ?? '').trim() || normalizedUsername;
    const selectedRole: RoleApp = role_app === 'manager' ? 'manager' : 'staff';

    if (!normalizedUsername || !normalizedEmail || !password) {
      return ctx.badRequest('username, email and password are required');
    }
    if (normalizedUsername.length < 3) {
      return ctx.badRequest('username must be at least 3 characters');
    }
    if (!normalizedEmail.includes('@')) {
      return ctx.badRequest('invalid email');
    }
    if (String(password).length < 6) {
      return ctx.badRequest('password must be at least 6 characters');
    }

    const [existingUsername, existingEmail] = await Promise.all([
      strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: { username: normalizedUsername },
        limit: 1,
      }) as Promise<any[]>,
      strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: { email: normalizedEmail },
        limit: 1,
      }) as Promise<any[]>,
    ]);

    if (existingUsername.length) {
      return ctx.badRequest('username is already used');
    }
    if (existingEmail.length) {
      return ctx.badRequest('email is already used');
    }

    const defaultRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });

    if (!defaultRole) return ctx.internalServerError('authenticated role not found');

    const user = (await strapi.entityService.create('plugin::users-permissions.user', {
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        password: String(password),
        display_name: normalizedDisplayName,
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
      reportText: `New user joined\nUsername: ${normalizedUsername}\nEmail: ${normalizedEmail}\nRole: ${selectedRole}`,
      imageUrl: '',
    });

    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });

    return ctx.send({
      jwt,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        role_app: user.role_app,
        is_approved: user.is_approved,
      },
    });
  },

  async login(ctx) {
    const { identifier, password } = ctx.request.body ?? {};
    const normalizedIdentifier = String(identifier ?? '').trim().toLowerCase();
    const rawPassword = String(password ?? '');

    if (!normalizedIdentifier || !rawPassword) {
      return ctx.badRequest('identifier and password are required');
    }

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: {
        $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
      },
      select: ['id', 'username', 'email', 'password', 'display_name', 'role_app', 'is_approved', 'blocked'],
    }) as any;

    if (!user) return ctx.unauthorized('invalid credentials');
    if (user.blocked) return ctx.forbidden('account is blocked');

    const isValidPassword = await strapi
      .plugin('users-permissions')
      .service('user')
      .validatePassword(rawPassword, user.password);

    if (!isValidPassword) return ctx.unauthorized('invalid credentials');

    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });

    return ctx.send({
      jwt,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        role_app: user.role_app,
        is_approved: user.is_approved,
      },
    });
  },

  async me(ctx) {
    const currentUser = ctx.state.user;
    if (!currentUser?.id) return ctx.unauthorized('unauthorized');

    const fullUser = (await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      currentUser.id,
      { populate: [] },
    )) as any;

    if (!fullUser) return ctx.notFound('user not found');

    return ctx.send({
      id: fullUser.id,
      username: fullUser.username,
      email: fullUser.email,
      display_name: fullUser.display_name,
      role_app: fullUser.role_app,
      is_approved: fullUser.is_approved,
    });
  },
}));
