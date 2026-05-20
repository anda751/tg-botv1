import crypto from 'crypto';

/**
 * Telegram initData verification middleware
 * ใช้เฉพาะ route ที่ขึ้นต้นด้วย /api/ เท่านั้น
 * ข้าม /admin, /upload, และ route ที่ auth: false
 */
export default (config, { strapi }) => {
  return async (ctx, next) => {
    // ข้ามทุก route ที่ไม่ใช่ /api/
    if (!ctx.path.startsWith('/api/')) {
      return next();
    }

    // ข้าม route ที่ config: { auth: false } เช่น register
    if (ctx.state.isAuthenticatedRoute === false) {
      return next();
    }

    // ถ้ายังไม่ได้ใส่ BOT_TOKEN (dev mode) — ข้ามไปก่อน แต่ warn
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      strapi.log.warn('[TelegramAuth] TELEGRAM_BOT_TOKEN not set — skipping verification');
      return next();
    }

    const initData = ctx.headers['x-telegram-init-data'];
    if (!initData) {
      return ctx.unauthorized('Missing X-Telegram-Init-Data header');
    }

    const isValid = verifyTelegramInitData(initData, botToken);
    if (!isValid) {
      return ctx.unauthorized('Invalid Telegram initData');
    }

    // Parse และแนบ telegram user เข้า ctx.state
    const parsed = parseTelegramInitData(initData);
    if (parsed?.user) {
      ctx.state.telegramUser = parsed.user;

      const users = await strapi.entityService.findMany(
        'plugin::users-permissions.user',
        {
          filters: { telegram_id: String(parsed.user.id) },
          limit: 1,
        },
      ) as any[];

      if (!users.length) {
        return ctx.unauthorized('Telegram user not registered');
      }

      const user = users[0];

      if (!user.is_approved) {
        return ctx.forbidden('บัญชีของคุณยังไม่ได้รับการอนุมัติ กรุณารอหัวหน้าตรวจสอบ');
      }

      ctx.state.user = user;
    }

    return next();
  };
};

function verifyTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

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

    const authDate = Number(params.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return false;

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