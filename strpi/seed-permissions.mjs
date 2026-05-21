#!/usr/bin/env node
/**
 * seed-permissions.mjs — Strapi 5 compatible
 *
 * Usage:
 *   node seed-permissions.mjs
 *
 * ต้องตั้งใน .env:
 *   STRAPI_URL=http://localhost:1337
 *   STRAPI_ADMIN_EMAIL=your@email.com
 *   STRAPI_ADMIN_PASSWORD=yourpassword
 */

import 'dotenv/config';

const BASE   = (process.env.STRAPI_URL || 'https://tg-botv1-production.up.railway.app').replace(/\/$/, '');
const EMAIL  = process.env.STRAPI_ADMIN_EMAIL;
const PASS   = process.env.STRAPI_ADMIN_PASSWORD;

if (!EMAIL || !PASS) {
  console.error('❌ กรุณาตั้ง STRAPI_ADMIN_EMAIL และ STRAPI_ADMIN_PASSWORD ใน .env');
  process.exit(1);
}

// ============================================================
// Permissions ที่ต้องการเปิดให้ Authenticated role
// ============================================================
const AUTHENTICATED = [
  // Tasks
  { plugin: 'api::task',                  controller: 'task',                action: 'find'            },
  { plugin: 'api::task',                  controller: 'task',                action: 'findOne'         },
  { plugin: 'api::task',                  controller: 'task',                action: 'create'          },
  { plugin: 'api::task',                  controller: 'task',                action: 'submit'          },
  { plugin: 'api::task',                  controller: 'task',                action: 'approve'         },
  { plugin: 'api::task',                  controller: 'task',                action: 'reject'          },
  // Handover
  { plugin: 'api::handover-request',      controller: 'handover-request',    action: 'handover'        },
  { plugin: 'api::handover-request',      controller: 'handover-request',    action: 'pickup'          },
  { plugin: 'api::handover-request',      controller: 'handover-request',    action: 'approveHandover' },
  { plugin: 'api::handover-request',      controller: 'handover-request',    action: 'cancelHandover'  },
  // Projects
  { plugin: 'api::project',               controller: 'project',             action: 'find'            },
  { plugin: 'api::project',               controller: 'project',             action: 'findOne'         },
  { plugin: 'api::project',               controller: 'project',             action: 'create'          },
  { plugin: 'api::project',               controller: 'project',             action: 'myProjects'      },
  { plugin: 'api::project',               controller: 'project',             action: 'closeProject'    },
  { plugin: 'api::project',               controller: 'project',             action: 'addMember'       },
  { plugin: 'api::project',               controller: 'project',             action: 'removeMember'    },
  // Dashboard
  { plugin: 'api::dashboard',             controller: 'dashboard',           action: 'summary'         },
  { plugin: 'api::dashboard',             controller: 'dashboard',           action: 'pendingTasks'    },
  { plugin: 'api::dashboard',             controller: 'dashboard',           action: 'underReview'     },
  { plugin: 'api::dashboard',             controller: 'dashboard',           action: 'staffOverview'   },
  { plugin: 'api::dashboard',             controller: 'dashboard',           action: 'pendingApproval' },
  // User
  { plugin: 'plugin::users-permissions',  controller: 'user',                action: 'me'              },
  { plugin: 'plugin::users-permissions',  controller: 'user',                action: 'approveUser'     },
  { plugin: 'plugin::users-permissions',  controller: 'user',                action: 'rejectUser'      },
];

const PUBLIC = [
  { plugin: 'api::user',                  controller: 'user',                action: 'register'        },
];

// ============================================================
async function main() {
  console.log(`\n🔗 Strapi: ${BASE}`);

  // 1. Admin login → JWT
  const loginRes = await fetch(`${BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const loginJson = await loginRes.json();
  const jwt = loginJson?.data?.token;

  if (!jwt) {
    console.error('❌ Login ไม่สำเร็จ:', JSON.stringify(loginJson, null, 2));
    process.exit(1);
  }
  console.log('✅ Admin login สำเร็จ');

  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };

  // 2. ดึง roles — Strapi 5 ใช้ /users-permissions/roles (ไม่มี /api/)
  const rolesRes  = await fetch(`${BASE}/users-permissions/roles`, { headers: h });
  const rolesJson = await rolesRes.json();

  // Strapi 5 คืน { roles: [...] } หรือ array ตรงๆ
  const roles = Array.isArray(rolesJson) ? rolesJson
              : Array.isArray(rolesJson?.roles) ? rolesJson.roles
              : [];

  if (!roles.length) {
    console.error('❌ ดึง roles ไม่ได้ response:', JSON.stringify(rolesJson, null, 2));
    console.log('\n💡 ลอง debug ด้วย:');
    console.log(`   curl -H "Authorization: Bearer ${jwt}" ${BASE}/users-permissions/roles`);
    process.exit(1);
  }

  console.log('📋 Roles พบ:', roles.map(r => `${r.name}(${r.type})`).join(', '));

  const authRole   = roles.find(r => r.type === 'authenticated');
  const publicRole = roles.find(r => r.type === 'public');

  if (!authRole)   { console.error('❌ ไม่พบ authenticated role'); process.exit(1); }
  if (!publicRole) { console.error('❌ ไม่พบ public role');        process.exit(1); }

  // 3. อัปเดต permissions
  await setPermissions(authRole.id,   'authenticated', AUTHENTICATED, h);
  await setPermissions(publicRole.id, 'public',        PUBLIC,        h);

  console.log('\n🎉 เสร็จสิ้น! ตรวจสอบที่ Admin Panel → Settings → Roles');
}

async function setPermissions(roleId, roleName, perms, h) {
  console.log(`\n⚙️  Updating [${roleName}] role (id=${roleId})...`);

  // ดึง role ปัจจุบันก่อน
  const currentRes  = await fetch(`${BASE}/users-permissions/roles/${roleId}`, { headers: h });
  const currentJson = await currentRes.json();

  // permissions อาจอยู่ใน .role.permissions หรือ .permissions ขึ้นกับ Strapi version
  const existing = currentJson?.role?.permissions ?? currentJson?.permissions ?? {};

  // Build updated tree
  const updated = JSON.parse(JSON.stringify(existing));

  for (const { plugin, controller, action } of perms) {
    // Strapi 5 key format ใน permissions object:
    // api:: → ตัด prefix เหลือแค่ชื่อ เช่น "task", "project"
    // plugin:: → ตัด "plugin::" เหลือ "users-permissions"
    let pluginKey;
    if (plugin.startsWith('api::')) {
      pluginKey = plugin.replace('api::', '');
    } else if (plugin.startsWith('plugin::')) {
      pluginKey = plugin.replace('plugin::', '');
    } else {
      pluginKey = plugin;
    }

    updated[pluginKey]                                    ??= { controllers: {} };
    updated[pluginKey].controllers                        ??= {};
    updated[pluginKey].controllers[controller]            ??= {};
    updated[pluginKey].controllers[controller][action]     = { enabled: true };
  }

  const putRes = await fetch(`${BASE}/users-permissions/roles/${roleId}`, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({ permissions: updated }),
  });

  if (putRes.ok) {
    console.log(`   ✅ ${perms.length} permissions เปิดแล้ว`);
  } else {
    const err = await putRes.text();
    console.error(`   ❌ ล้มเหลว:`, err);
  }
}

main().catch(err => { console.error('❌', err); process.exit(1); });
