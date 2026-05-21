#!/usr/bin/env node
import 'dotenv/config';

const BASE = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD;

const MANAGER = {
  email: process.env.MANAGER_EMAIL,
  display_name: process.env.MANAGER_DISPLAY_NAME || 'หัวหน้า',
  telegram_id: process.env.MANAGER_TELEGRAM_ID,
  telegram_chat_id: process.env.MANAGER_TELEGRAM_CHAT_ID || process.env.MANAGER_TELEGRAM_ID,
};

async function main() {
  console.log(`\n🔗 Connecting to Strapi: ${BASE}`);

  // 1. Admin login
  const loginRes = await fetch(`${BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const loginData = await loginRes.json();
  const adminToken = loginData?.data?.token;

  if (!adminToken) {
    console.error('❌ Admin login ไม่สำเร็จ:', JSON.stringify(loginData));
    process.exit(1);
  }
  console.log('✅ Admin login สำเร็จ');

  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  // 2. หา authenticated role
  const rolesRes = await fetch(`${BASE}/users-permissions/roles`, { headers: adminHeaders });
  const rolesData = await rolesRes.json();
  const roles = Array.isArray(rolesData?.roles) ? rolesData.roles : [];
  const authRole = roles.find(r => r.type === 'authenticated');

  if (!authRole) {
    console.error('❌ ไม่พบ authenticated role');
    process.exit(1);
  }
  console.log(`✅ พบ authenticated role (id=${authRole.id})`);

  // 3. สร้าง user ผ่าน Users-Permissions register
  const password = Math.random().toString(36).slice(-10) + 'A1!';
  const regRes = await fetch(`${BASE}/api/auth/local/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: MANAGER.telegram_id,
      email: MANAGER.email,
      password,
    }),
  });
  const regData = await regRes.json();

  if (!regData.user) {
    console.error('❌ สร้าง user ไม่สำเร็จ:', JSON.stringify(regData));
    process.exit(1);
  }

  const userId = regData.user.id;
  console.log(`✅ สร้าง user สำเร็จ (id=${userId})`);

  // 4. อัปเดต custom fields ผ่าน Admin Content API
  const updateRes = await fetch(`${BASE}/admin/content-manager/collection-types/plugin::users-permissions.user/${userId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      display_name: MANAGER.display_name,
      telegram_id: MANAGER.telegram_id,
      telegram_chat_id: MANAGER.telegram_chat_id,
      role_app: 'manager',
      is_approved: true,
      confirmed: true,
      blocked: false,
    }),
  });

  if (updateRes.ok) {
    console.log('✅ อัปเดต custom fields สำเร็จ');
  } else {
    const err = await updateRes.text();
    console.warn('⚠️  อัปเดตผ่าน Admin API ไม่สำเร็จ:', err);
    console.log('\n📌 ต้องตั้งค่าด้วยมือใน Strapi Admin Panel:');
    console.log(`   Admin Panel → Content Manager → User → id=${userId}`);
    console.log(`   แก้: role_app = manager, is_approved = true`);
    console.log(`   แก้: telegram_id = ${MANAGER.telegram_id}`);
    console.log(`   แก้: display_name = ${MANAGER.display_name}`);
  }

  console.log('\n🎉 เสร็จสิ้น!');
  console.log(`   Email    : ${MANAGER.email}`);
  console.log(`   Password : ${password}  ← บันทึกไว้ด้วย!`);
  console.log(`   User ID  : ${userId}`);
}

main().catch(console.error);