export default {
  routes: [
    {
      method: 'POST',
      path: '/telegram/webhook',
      handler: 'telegram.webhook',
      config: {
        auth: false,        // Telegram ยิงมาโดยไม่มี JWT
        middlewares: [],    // ข้าม telegram-auth middleware ด้วย
      },
    },
  ],
};