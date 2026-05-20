#!/usr/bin/env node
/**
 * setup-webhook.mjs
 * รันครั้งเดียวหลังจาก deploy หรือเปลี่ยน URL
 *
 * Usage:
 *   node setup-webhook.mjs                        # ดู webhook ปัจจุบัน
 *   node setup-webhook.mjs set https://your.domain # ตั้งค่า webhook ใหม่
 *   node setup-webhook.mjs delete                  # ลบ webhook
 */

import 'dotenv/config';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

const BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const [,, command, arg] = process.argv;

async function tg(method, body = {}) {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getInfo() {
  const [webhook, me] = await Promise.all([
    tg('getWebhookInfo'),
    tg('getMe'),
  ]);
  console.log('\n🤖 Bot info:');
  console.log(`   Name     : ${me.result?.first_name}`);
  console.log(`   Username : @${me.result?.username}`);
  console.log(`   ID       : ${me.result?.id}`);
  console.log('\n🔗 Webhook info:');
  console.log(`   URL               : ${webhook.result?.url || '(ไม่ได้ตั้งค่า)'}`);
  console.log(`   Pending updates   : ${webhook.result?.pending_update_count}`);
  console.log(`   Last error        : ${webhook.result?.last_error_message || '-'}`);
  console.log(`   Last error date   : ${webhook.result?.last_error_date
    ? new Date(webhook.result.last_error_date * 1000).toLocaleString('th-TH')
    : '-'}`);
}

async function setWebhook(baseUrl) {
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  console.log(`\n⚙️  Setting webhook to: ${webhookUrl}`);

  const result = await tg('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });

  if (result.ok) {
    console.log('✅ Webhook set successfully');
  } else {
    console.error('❌ Failed:', result.description);
  }
  await getInfo();
}

async function deleteWebhook() {
  const result = await tg('deleteWebhook', { drop_pending_updates: true });
  if (result.ok) {
    console.log('✅ Webhook deleted');
  } else {
    console.error('❌ Failed:', result.description);
  }
}

// ===== Main =====
if (!command || command === 'info') {
  await getInfo();
} else if (command === 'set') {
  if (!arg) {
    console.error('❌ กรุณาระบุ URL เช่น: node setup-webhook.mjs set https://your.domain');
    process.exit(1);
  }
  await setWebhook(arg.replace(/\/$/, '')); // ตัด trailing slash
} else if (command === 'delete') {
  await deleteWebhook();
} else {
  console.error(`❌ Unknown command: ${command}`);
  console.log('Commands: info | set <url> | delete');
  process.exit(1);
}
