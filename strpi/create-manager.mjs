#!/usr/bin/env node
/**
 * create-manager.mjs
 * สร้าง Manager account คนแรกในระบบ
 * (เพราะ register API สร้างได้แค่ staff)
 *
 * Usage:
 *   node create-manager.mjs
 */

import 'dotenv/config';

const BASE = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD;

// ===== ตั้งค่า Manager ที่ต้องการสร้าง =====
const MANAGER = {
  email: process.env.MANAGER_EMAIL || 'anda.jehuma@gmail.com',
  display_name: process.env.MANAGER_DISPLAY_NAME || 'หัวหน้า',
  telegram_id: process.env.MANAGER_TELEGRAM_ID || '1312085039',       // ← ใส่ Telegram User ID จริง
  telegram_chat_id: process.env.MANAGER_TELEGRAM_CHAT_ID || '1312085039', // ← ใส่ Chat ID จริง
};

if (!MANAGER.telegram_id) {
  console.error('❌ กรุณาตั้ง MANAGER_TELEGRAM_ID ใน .env');
  console.log('   วิธีหา Telegram ID: ส่งข้อความหา @userinfobot ใน Telegram');
  process.exit(1);
}

async function main() {
  console.log(`\n🔗 Connecting to Strapi: ${BASE}`);

  // Login รับ JWT
  const loginRes = await fetch(`${BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const loginData = await loginRes.json();
  const token = loginData?.data?.token;

  if (!token) {
    console.error('❌ Login ไม่สำเร็จ');
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // หา authenticated role
  const rolesRes = await fetch(`${BASE}/api/users-permissions/roles`, { headers });
  const rolesData = await rolesRes.json();
  const authRole = rolesData.roles?.find(r => r.type === 'authenticated');

  if (!authRole) {
    console.error('❌ ไม่พบ authenticated role');
    process.exit(1);
  }

  // สร้าง Manager user ผ่าน Admin API
  const createRes = await fetch(`${BASE}/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: MANAGER.email,
      firstname: MANAGER.display_name,
      lastname: '',
      roles: [authRole.id],
      isActive: true,
    }),
  });

  if (!createRes.ok) {
    // ถ้าใช้ Users-Permissions แทน Admin
    console.log('ลองสร้างผ่าน Users-Permissions API...');

    const upRes = await fetch(`${BASE}/api/auth/local/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: MANAGER.telegram_id,
        email: MANAGER.email,
        password: Math.random().toString(36).slice(-12) + 'A1!', // random password
      }),
    });

    const upData = await upRes.json();

    if (!upData.user) {
      console.error('❌ สร้าง user ไม่สำเร็จ:', upData);
      process.exit(1);
    }

    const userId = upData.user.id;

    // อัปเดต custom fields ผ่าน Admin
    await fetch(`${BASE}/admin/users/${userId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        display_name: MANAGER.display_name,
        telegram_id: MANAGER.telegram_id,
        telegram_chat_id: MANAGER.telegram_chat_id,
        role_app: 'manager',
        is_approved: true,
      }),
    });

    console.log(`✅ สร้าง Manager เรียบร้อย (id=${userId})`);
    console.log(`   Email: ${MANAGER.email}`);
    console.log(`   Telegram ID: ${MANAGER.telegram_id}`);
    console.log('\n⚠️  ต้องตั้ง role_app และ is_approved ผ่าน Strapi Admin Panel ด้วยมือ:');
    console.log('   Admin Panel → Content Manager → User → แก้ role_app=manager, is_approved=true');
    return;
  }

  const createData = await createRes.json();
  console.log('✅ สร้าง Manager สำเร็จ:', createData);
}

main().catch(console.error);
