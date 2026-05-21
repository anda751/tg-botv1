"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
exports.default = (config, { strapi }) => {
    return async (ctx, next) => {
        if (!ctx.path.startsWith('/api/'))
            return next();
        const skipPaths = [
            '/api/auth/',
            '/api/telegram/webhook',
        ];
        if (skipPaths.some((p) => ctx.path.startsWith(p)))
            return next();
        if (ctx.state.isAuthenticatedRoute === false)
            return next();
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
        if (parsed === null || parsed === void 0 ? void 0 : parsed.user) {
            ctx.state.telegramUser = parsed.user;
            const requestedRole = normalizeRoleHeader(ctx.headers['x-role-app']);
            const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
                filters: { telegram_id: String(parsed.user.id) },
                sort: ['role_app:asc', 'id:asc'],
                limit: -1,
            });
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
            strapi.log.info(`[TelegramAuth] user found: id=${selectedUser.id} telegram_id=${selectedUser.telegram_id} is_approved=${selectedUser.is_approved} role_app=${selectedUser.role_app}`);
            if (!selectedUser.is_approved) {
                return ctx.forbidden('Account is not approved yet');
            }
            ctx.state.user = selectedUser;
        }
        return next();
    };
};
function normalizeRoleHeader(value) {
    if (value === 'manager' || value === 'staff')
        return value;
    return undefined;
}
function getAvailableRoles(users) {
    return users
        .map((user) => user.role_app)
        .filter((role) => role === 'manager' || role === 'staff');
}
function pickUserForRole(users, requestedRole) {
    var _a;
    if (requestedRole) {
        return (_a = users.find((user) => user.role_app === requestedRole)) !== null && _a !== void 0 ? _a : null;
    }
    if (users.length === 1) {
        return users[0];
    }
    return null;
}
function verifyTelegramInitData(initData, botToken) {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash)
            return false;
        const authDate = Number(params.get('auth_date'));
        const now = Math.floor(Date.now() / 1000);
        if (now - authDate > 86400)
            return 'expired';
        params.delete('hash');
        const dataCheckString = [...params.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
        const secretKey = crypto_1.default
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();
        const expectedHash = crypto_1.default
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');
        return crypto_1.default.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(hash, 'hex'));
    }
    catch {
        return false;
    }
}
function parseTelegramInitData(initData) {
    try {
        const params = new URLSearchParams(initData);
        const result = {};
        for (const [k, v] of params.entries()) {
            try {
                result[k] = JSON.parse(v);
            }
            catch {
                result[k] = v;
            }
        }
        return result;
    }
    catch {
        return null;
    }
}
