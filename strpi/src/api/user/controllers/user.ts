import { factories } from '@strapi/strapi';

type RoleApp = 'manager' | 'staff';

export default factories.createCoreController('plugin::users-permissions.user', ({ strapi }) => ({
  async register(ctx) {
    const {
      username,
      email,
      password,
      display_name,
      role_app,
      telegram_id,
      telegram_chat_id,
    } = ctx.request.body ?? {};

    const normalizedUsername = String(username ?? '').trim().toLowerCase();
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedDisplayName = String(display_name ?? '').trim() || normalizedUsername;
    const selectedRole: RoleApp = role_app === 'manager' ? 'manager' : 'staff';
    const normalizedTelegramId = String(telegram_id ?? '').trim();
    const normalizedTelegramChatId = String(telegram_chat_id ?? '').trim();

    if (!normalizedUsername || !normalizedEmail || !password) {
      return ctx.badRequest('กรุณากรอก username, email และ password');
    }
    if (normalizedUsername.length < 3) {
      return ctx.badRequest('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
    }
    if (!normalizedEmail.includes('@')) {
      return ctx.badRequest('อีเมลไม่ถูกต้อง');
    }
    if (String(password).length < 6) {
      return ctx.badRequest('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    }

    const existingUsername = await strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: { username: normalizedUsername },
      limit: 1,
    }) as any[];

    const existingEmail = await strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: { email: normalizedEmail },
      limit: 1,
    }) as any[];

    if (existingUsername.length) {
      return ctx.badRequest('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
    }
    if (existingEmail.length) {
      return ctx.badRequest('อีเมลนี้ถูกใช้งานแล้ว');
    }

    const defaultRoles = await strapi.entityService.findMany('plugin::users-permissions.role', {
      filters: { type: 'authenticated' },
      limit: 1,
    }) as any[];

    const defaultRole = defaultRoles[0];

    if (!defaultRole) return ctx.internalServerError('ไม่พบบทบาท authenticated');

    const user = (await strapi.entityService.create('plugin::users-permissions.user', {
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        password: String(password),
        display_name: normalizedDisplayName,
        role_app: selectedRole,
        is_approved: true,
        telegram_id: selectedRole === 'manager' ? normalizedTelegramId || null : null,
        telegram_chat_id: selectedRole === 'manager' ? normalizedTelegramChatId || null : null,
        role: defaultRole.id,
        confirmed: true,
        blocked: false,
      },
    })) as any;

    await strapi.service('api::task.task').notifyManager({
      taskId: '',
      taskName: '',
      submittedBy: normalizedDisplayName,
      reportText: `มีผู้ใช้ใหม่เข้าระบบ\nUsername: ${normalizedUsername}\nEmail: ${normalizedEmail}\nRole: ${selectedRole}`,
      imageUrl: '',
    });

    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });

    return ctx.send({
      jwt,
      user: serializeUser(user),
    });
  },

  async login(ctx) {
    const { identifier, password } = ctx.request.body ?? {};
    const normalizedIdentifier = String(identifier ?? '').trim().toLowerCase();
    const rawPassword = String(password ?? '');

    if (!normalizedIdentifier || !rawPassword) {
      return ctx.badRequest('กรุณากรอกชื่อผู้ใช้หรืออีเมล และรหัสผ่าน');
    }

    const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: {
        $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
      },
      fields: ['id', 'username', 'email', 'password', 'display_name', 'role_app', 'is_approved', 'blocked', 'telegram_id', 'telegram_chat_id'],
      limit: 1,
    }) as any[];

    const user = users[0];

    if (!user) return ctx.unauthorized('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    if (user.blocked) return ctx.forbidden('บัญชีนี้ถูกระงับการใช้งาน');

    const isValidPassword = await strapi
      .plugin('users-permissions')
      .service('user')
      .validatePassword(rawPassword, user.password);

    if (!isValidPassword) return ctx.unauthorized('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');

    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });

    return ctx.send({
      jwt,
      user: serializeUser(user),
    });
  },

  async me(ctx) {
    const currentUser = ctx.state.user;
    if (!currentUser?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const fullUser = (await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      currentUser.id,
      { populate: [] },
    )) as any;

    if (!fullUser) return ctx.notFound('ไม่พบผู้ใช้งาน');

    return ctx.send(serializeUser(fullUser));
  },

  async updateMe(ctx) {
    const currentUser = ctx.state.user;
    if (!currentUser?.id) return ctx.unauthorized('กรุณาเข้าสู่ระบบ');

    const body = ctx.request.body ?? {};
    const displayName = String(body.display_name ?? '').trim();
    const telegramId = String(body.telegram_id ?? '').trim();
    const telegramChatId = String(body.telegram_chat_id ?? '').trim();
    const currentPassword = String(body.current_password ?? '');
    const newPassword = String(body.new_password ?? '');
    const confirmPassword = String(body.confirm_password ?? '');

    const fullUser = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      currentUser.id,
      {
        fields: ['id', 'username', 'email', 'password', 'display_name', 'role_app', 'is_approved', 'telegram_id', 'telegram_chat_id'],
      },
    ) as any;

    if (!fullUser) return ctx.notFound('ไม่พบผู้ใช้งาน');
    if (!displayName) return ctx.badRequest('กรุณากรอกชื่อที่แสดง');

    const wantsPasswordChange = !!currentPassword || !!newPassword || !!confirmPassword;
    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        return ctx.badRequest('กรุณากรอกรหัสผ่านปัจจุบัน รหัสผ่านใหม่ และยืนยันรหัสผ่านให้ครบ');
      }
      if (newPassword.length < 6) {
        return ctx.badRequest('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      }
      if (newPassword !== confirmPassword) {
        return ctx.badRequest('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      }

      const isValidPassword = await strapi
        .plugin('users-permissions')
        .service('user')
        .validatePassword(currentPassword, fullUser.password);

      if (!isValidPassword) {
        return ctx.badRequest('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      }
    }

    const data: Record<string, unknown> = {
      display_name: displayName,
    };

    if (fullUser.role_app === 'manager') {
      data.telegram_id = telegramId || null;
      data.telegram_chat_id = telegramChatId || null;
    }

    if (wantsPasswordChange) {
      data.password = newPassword;
    }

    const updated = (await strapi.entityService.update(
      'plugin::users-permissions.user',
      currentUser.id,
      { data },
    )) as any;

    return ctx.send({
      message: 'บันทึกข้อมูลเรียบร้อย',
      user: serializeUser(updated),
    });
  },
}));

function serializeUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    display_name: user.display_name,
    role_app: user.role_app,
    is_approved: user.is_approved,
    telegram_id: user.role_app === 'manager' ? user.telegram_id ?? '' : undefined,
    telegram_chat_id: user.role_app === 'manager' ? user.telegram_chat_id ?? '' : undefined,
  };
}
