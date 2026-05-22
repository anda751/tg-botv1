import crypto from 'crypto';

type RoleApp = 'manager' | 'staff';

export default (config, { strapi }) => {
  return async (ctx, next) => {
    if (!ctx.path.startsWith('/api/')) return next();

    const skipPaths = [
      '/api/auth/',
      '/api/telegram/webhook',
    ];
    if (skipPaths.some((p) => ctx.path.startsWith(p))) return next();

    if (ctx.state.isAuthenticatedRoute === false) return next();

    const isTestMode = isTruthy(process.env.TEST_MODE);
    if (isTestMode) {
      const requestedRole = normalizeRoleHeader(ctx.headers['x-role-app']) ?? 'staff';
      const testUserIdHeader = String(ctx.headers['x-test-user-id'] ?? '').trim();
      const testUserId = Number(testUserIdHeader);
      const hasValidTestUserId = testUserIdHeader !== '' && Number.isFinite(testUserId);

      const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: {
          ...(hasValidTestUserId ? { id: testUserId } : {}),
          is_approved: true,
        },
        sort: ['id:asc'],
        limit: -1,
      }) as any[];

      if (!users.length) {
        return ctx.unauthorized('TEST_MODE enabled but no approved users found');
      }

      const selectedUser =
        users.find((user) => user.role_app === requestedRole) ??
        users.find((user) => user.role_app === 'manager') ??
        users[0];

      if (!selectedUser) {
        return ctx.unauthorized('TEST_MODE could not select user');
      }

      ctx.state.user = selectedUser;
      ctx.state.telegramUser = {
        id: selectedUser.telegram_id || `test:${selectedUser.id}`,
        first_name: selectedUser.display_name || selectedUser.username || 'Test User',
      };

      strapi.log.info(
        `[TelegramAuth][TEST_MODE] using user id=${selectedUser.id} role_app=${selectedUser.role_app}`,
      );

      return next();
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      strapi.log.warn('[TelegramAuth] TELEGRAM_BOT_TOKEN not set - skipping');
      return next();
    }

    const initData = ctx.headers['x-telegram-init-data'];
    if (!initData) {
      return ctx.unauthorized('Missing X-Telegram-Init-Data header');
    }

    const verifyResult = verifyTelegramInitData(initData, botToken);

    if (verifyResult === 'expired') {
      return ctx.unauthorized('Telegram initData expired');
    }

    if (!verifyResult) {
      return ctx.unauthorized('Invalid Telegram initData');
    }

    const parsed = parseTelegramInitData(initData);
    if (parsed?.user) {
      ctx.state.telegramUser = parsed.user;

      const requestedRole = normalizeRoleHeader(ctx.headers['x-role-app']);
      const users = await strapi.entityService.findMany(
        'plugin::users-permissions.user',
        {
          filters: { telegram_id: String(parsed.user.id) },
          sort: ['role_app:asc', 'id:asc'],
          limit: -1,
        },
      ) as any[];

      if (!users.length) {
        return ctx.notFound('Telegram user not registered');
      }

      const selectedUser = pickUserForRole(users, requestedRole);

      if (!selectedUser) {
        ctx.status = 409;
        ctx.body = {
          error: {
            status: 409,
            name: 'RoleSelectionRequired',
            message: 'Multiple accounts found for this Telegram account',
            details: {
              availableRoles: getAvailableRoles(users),
            },
          },
        };
        return;
      }

      strapi.log.info(
        `[TelegramAuth] user found: id=${selectedUser.id} telegram_id=${selectedUser.telegram_id} is_approved=${selectedUser.is_approved} role_app=${selectedUser.role_app}`,
      );

      if (!selectedUser.is_approved) {
        return ctx.forbidden('Account is not approved yet');
      }

      ctx.state.user = selectedUser;
    }

    return next();
  };
};

function normalizeRoleHeader(value: unknown): RoleApp | undefined {
  if (value === 'manager' || value === 'staff') return value;
  return undefined;
}

function getAvailableRoles(users: any[]): RoleApp[] {
  return users
    .map((user) => user.role_app)
    .filter((role): role is RoleApp => role === 'manager' || role === 'staff');
}

function pickUserForRole(users: any[], requestedRole?: RoleApp) {
  if (requestedRole) {
    return users.find((user) => user.role_app === requestedRole) ?? null;
  }

  if (users.length === 1) {
    return users[0];
  }

  return null;
}

function verifyTelegramInitData(initData: string, botToken: string): boolean | 'expired' {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

    const authDate = Number(params.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return 'expired';

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(hash, 'hex'),
    );
  } catch {
    return false;
  }
}

function parseTelegramInitData(initData: string): Record<string, any> | null {
  try {
    const params = new URLSearchParams(initData);
    const result: Record<string, any> = {};
    for (const [k, v] of params.entries()) {
      try {
        result[k] = JSON.parse(v);
      } catch {
        result[k] = v;
      }
    }
    return result;
  } catch {
    return null;
  }
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}
