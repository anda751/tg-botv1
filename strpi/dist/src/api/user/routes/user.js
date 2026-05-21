"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        // สมัครสมาชิก (ไม่ต้อง login)
        {
            method: 'POST',
            path: '/auth/telegram/register',
            handler: 'user.register',
            config: { auth: false },
        },
        // ดึงข้อมูลตัวเอง
        {
            method: 'GET',
            path: '/users/me/profile',
            handler: 'user.me',
        },
        // Manager อนุมัติ
        {
            method: 'POST',
            path: '/users/:id/approve',
            handler: 'user.approveUser',
        },
        // Manager ปฏิเสธ
        {
            method: 'POST',
            path: '/users/:id/reject',
            handler: 'user.rejectUser',
        },
    ],
};
