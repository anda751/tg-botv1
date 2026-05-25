"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
exports.default = (config, { strapi }) => {
    return async (ctx, next) => {
        var _a, _b, _c, _d;
        if (!ctx.path.startsWith('/api/'))
            return next();
        const skipPaths = [
            '/api/auth/',
            '/api/telegram/webhook',
        ];
        if (skipPaths.some((p) => ctx.path.startsWith(p)))
            return next();
        const bearerToken = getBearerToken(ctx.headers.authorization);
        if (bearerToken) {
            try {
                const payload = await strapi.plugin('users-permissions').service('jwt').verify(bearerToken);
                const userId = Number(payload === null || payload === void 0 ? void 0 : payload.id);
                if (!Number.isFinite(userId))
                    return ctx.unauthorized('Invalid auth token');
                const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId);
                if (!user)
                    return ctx.unauthorized('User not found');
                if (user.blocked)
                    return ctx.forbidden('Account is blocked');
                ctx.state.user = user;
                return next();
            }
            catch {
                return ctx.unauthorized('Invalid auth token');
            }
        }
        const isTestMode = isTruthy(process.env.TEST_MODE);
        if (isTestMode) {
            const requestedRole = (_a = normalizeRoleHeader(ctx.headers['x-role-app'])) !== null && _a !== void 0 ? _a : 'staff';
            const testUserIdHeader = String((_b = ctx.headers['x-test-user-id']) !== null && _b !== void 0 ? _b : '').trim();
            const testUserId = Number(testUserIdHeader);
            const hasValidTestUserId = testUserIdHeader !== '' && Number.isFinite(testUserId);
            const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
                filters: {
                    ...(hasValidTestUserId ? { id: testUserId } : {}),
                    is_approved: true,
                },
                sort: ['id:asc'],
                limit: -1,
            });
            if (!users.length) {
                return ctx.unauthorized('TEST_MODE enabled but no approved users found');
            }
            const selectedUser = (_d = (_c = users.find((user) => user.role_app === requestedRole)) !== null && _c !== void 0 ? _c : users.find((user) => user.role_app === 'manager')) !== null && _d !== void 0 ? _d : users[0];
            if (!selectedUser) {
                return ctx.unauthorized('TEST_MODE could not select user');
            }
            ctx.state.user = selectedUser;
            ctx.state.telegramUser = {
                id: selectedUser.telegram_id || `test:${selectedUser.id}`,
                first_name: selectedUser.display_name || selectedUser.username || 'Test User',
            };
            strapi.log.info(`[TelegramAuth][TEST_MODE] using user id=${selectedUser.id} role_app=${selectedUser.role_app}`);
            return next();
        }
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            return ctx.unauthorized('Missing auth token');
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
function getBearerToken(authorization) {
    if (typeof authorization !== 'string')
        return null;
    const [scheme, token] = authorization.trim().split(/\s+/, 2);
    if (!scheme || !token)
        return null;
    if (scheme.toLowerCase() !== 'bearer')
        return null;
    return token.trim() || null;
}
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
function isTruthy(value) {
    if (!value)
        return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}
