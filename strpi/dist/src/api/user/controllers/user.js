"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('plugin::users-permissions.user', ({ strapi }) => ({
    async register(ctx) {
        var _a;
        const { username, email, password, display_name, role_app, telegram_id, telegram_chat_id, } = (_a = ctx.request.body) !== null && _a !== void 0 ? _a : {};
        const normalizedUsername = String(username !== null && username !== void 0 ? username : '').trim().toLowerCase();
        const normalizedEmail = String(email !== null && email !== void 0 ? email : '').trim().toLowerCase();
        const normalizedDisplayName = String(display_name !== null && display_name !== void 0 ? display_name : '').trim() || normalizedUsername;
        const selectedRole = role_app === 'manager' ? 'manager' : 'staff';
        const normalizedTelegramId = String(telegram_id !== null && telegram_id !== void 0 ? telegram_id : '').trim();
        const normalizedTelegramChatId = String(telegram_chat_id !== null && telegram_chat_id !== void 0 ? telegram_chat_id : '').trim();
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
        const [existingUsername, existingEmail] = await Promise.all([
            strapi.entityService.findMany('plugin::users-permissions.user', {
                filters: { username: normalizedUsername },
                limit: 1,
            }),
            strapi.entityService.findMany('plugin::users-permissions.user', {
                filters: { email: normalizedEmail },
                limit: 1,
            }),
        ]);
        if (existingUsername.length) {
            return ctx.badRequest('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
        }
        if (existingEmail.length) {
            return ctx.badRequest('อีเมลนี้ถูกใช้งานแล้ว');
        }
        const defaultRole = await strapi
            .query('plugin::users-permissions.role')
            .findOne({ where: { type: 'authenticated' } });
        if (!defaultRole)
            return ctx.internalServerError('ไม่พบบทบาท authenticated');
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
        }));
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
            user: serializeUser(user),
        });
    },
    async login(ctx) {
        var _a;
        const { identifier, password } = (_a = ctx.request.body) !== null && _a !== void 0 ? _a : {};
        const normalizedIdentifier = String(identifier !== null && identifier !== void 0 ? identifier : '').trim().toLowerCase();
        const rawPassword = String(password !== null && password !== void 0 ? password : '');
        if (!normalizedIdentifier || !rawPassword) {
            return ctx.badRequest('กรุณากรอกชื่อผู้ใช้หรืออีเมล และรหัสผ่าน');
        }
        const user = await strapi.query('plugin::users-permissions.user').findOne({
            where: {
                $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
            },
            select: ['id', 'username', 'email', 'password', 'display_name', 'role_app', 'is_approved', 'blocked', 'telegram_id', 'telegram_chat_id'],
        });
        if (!user)
            return ctx.unauthorized('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        if (user.blocked)
            return ctx.forbidden('บัญชีนี้ถูกระงับการใช้งาน');
        const isValidPassword = await strapi
            .plugin('users-permissions')
            .service('user')
            .validatePassword(rawPassword, user.password);
        if (!isValidPassword)
            return ctx.unauthorized('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });
        return ctx.send({
            jwt,
            user: serializeUser(user),
        });
    },
    async me(ctx) {
        const currentUser = ctx.state.user;
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.id))
            return ctx.unauthorized('unauthorized');
        const fullUser = (await strapi.entityService.findOne('plugin::users-permissions.user', currentUser.id, { populate: [] }));
        if (!fullUser)
            return ctx.notFound('ไม่พบผู้ใช้งาน');
        return ctx.send(serializeUser(fullUser));
    },
    async updateMe(ctx) {
        var _a, _b, _c, _d, _e, _f, _g;
        const currentUser = ctx.state.user;
        if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.id))
            return ctx.unauthorized('unauthorized');
        const body = (_a = ctx.request.body) !== null && _a !== void 0 ? _a : {};
        const displayName = String((_b = body.display_name) !== null && _b !== void 0 ? _b : '').trim();
        const telegramId = String((_c = body.telegram_id) !== null && _c !== void 0 ? _c : '').trim();
        const telegramChatId = String((_d = body.telegram_chat_id) !== null && _d !== void 0 ? _d : '').trim();
        const currentPassword = String((_e = body.current_password) !== null && _e !== void 0 ? _e : '');
        const newPassword = String((_f = body.new_password) !== null && _f !== void 0 ? _f : '');
        const confirmPassword = String((_g = body.confirm_password) !== null && _g !== void 0 ? _g : '');
        const fullUser = await strapi.query('plugin::users-permissions.user').findOne({
            where: { id: currentUser.id },
            select: ['id', 'username', 'email', 'password', 'display_name', 'role_app', 'is_approved', 'telegram_id', 'telegram_chat_id'],
        });
        if (!fullUser)
            return ctx.notFound('ไม่พบผู้ใช้งาน');
        if (!displayName)
            return ctx.badRequest('กรุณากรอกชื่อที่แสดง');
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
        const data = {
            display_name: displayName,
        };
        if (fullUser.role_app === 'manager') {
            data.telegram_id = telegramId || null;
            data.telegram_chat_id = telegramChatId || null;
        }
        if (wantsPasswordChange) {
            data.password = newPassword;
        }
        const updated = (await strapi.entityService.update('plugin::users-permissions.user', currentUser.id, { data }));
        return ctx.send({
            message: 'บันทึกข้อมูลเรียบร้อย',
            user: serializeUser(updated),
        });
    },
}));
function serializeUser(user) {
    var _a, _b;
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        role_app: user.role_app,
        is_approved: user.is_approved,
        telegram_id: user.role_app === 'manager' ? (_a = user.telegram_id) !== null && _a !== void 0 ? _a : '' : undefined,
        telegram_chat_id: user.role_app === 'manager' ? (_b = user.telegram_chat_id) !== null && _b !== void 0 ? _b : '' : undefined,
    };
}
