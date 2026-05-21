import crypto from 'crypto';

export default (config, { strapi }) => {
  return async (ctx, next) => {
    if (!ctx.path.startsWith('/api/')) return next();

    const skipPaths = [
      '/api/auth/',
      '/api/telegram/webhook',
    ];
    if (skipPaths.some(p => ctx.path.startsWith(p))) return next();

    if (ctx.state.isAuthenticatedRoute === false) return next();

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      strapi.log.warn('[TelegramAuth] TELEGRAM_BOT_TOKEN not set — skipping');
      return next();
    }

    const initData = ctx.headers['x-telegram-init-data'];
    if (!initData) {
      return ctx.unauthorized('Missing X-Telegram-Init-Data header');
    }

    const verifyResult = verifyTelegramInitData(initData, botToken);

    if (verifyResult === 'expired') {
      // หมดอายุ — ส่ง 401 พิเศษให้ frontend รู้ว่าต้อง refresh ไม่ใช่ไปสมัครใหม่
      return ctx.unauthorized('Telegram initData expired');
    }

    if (!verifyResult) {
      return ctx.unauthorized('Invalid Telegram initData');
    }

    const parsed = parseTelegramInitData(initData);
    if (parsed?.user) {
      ctx.state.telegramUser = parsed.user;

      const users = await strapi.entityService.findMany(
        'plugin::users-permissions.user',
        { filters: { telegram_id: String(parsed.user.id) }, limit: 1 },
      ) as any[];

      if (!users.length) {
        // ไม่มี user → 404 เพื่อให้ frontend รู้ว่ายังไม่สมัคร
        return ctx.notFound('Telegram user not registered');
      }

      const user = users[0];
      strapi.log.info(`[TelegramAuth] user found: id=${user.id} is_approved=${user.is_approved} role_app=${user.role_app}`);
      if (!user.is_approved) {
        return ctx.forbidden('บัญชียังไม่ได้รับการอนุมัติ');
      }

      ctx.state.user = user;
    }

    return next();
  };
};

function verifyTelegramInitData(initData: string, botToken: string): boolean | 'expired' {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

    // เช็ค expired ก่อน
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
      try { result[k] = JSON.parse(v); } catch { result[k] = v; }
    }
    return result;
  } catch {
    return null;
  }
}