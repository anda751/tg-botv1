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

const BASE  = (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/$/, '');
const EMAIL = process.env.STRAPI_ADMIN_EMAIL;
const PASS  = process.env.STRAPI_ADMIN_PASSWORD;

if (!EMAIL || !PASS) {
  console.error('❌ กรุณาตั้ง STRAPI_ADMIN_EMAIL และ STRAPI_ADMIN_PASSWORD ใน .env');
  process.exit(1);
}

// ============================================================
// Authenticated role permissions
// ============================================================
const AUTHENTICATED = [
  // Tasks
  { plugin: 'api::task',             controller: 'task',             action: 'find'            },
  { plugin: 'api::task',             controller: 'task',             action: 'findOne'         },
  { plugin: 'api::task',             controller: 'task',             action: 'create'          },
  { plugin: 'api::task',             controller: 'task',             action: 'submit'          },
  { plugin: 'api::task',             controller: 'task',             action: 'approve'         },
  { plugin: 'api::task',             controller: 'task',             action: 'reject'          },
  // Handover
  { plugin: 'api::handover-request', controller: 'handover-request', action: 'handover'        },
  { plugin: 'api::handover-request', controller: 'handover-request', action: 'pickup'          },
  { plugin: 'api::handover-request', controller: 'handover-request', action: 'approveHandover' },
  { plugin: 'api::handover-request', controller: 'handover-request', action: 'cancelHandover'  },
  // Projects
  { plugin: 'api::project',          controller: 'project',          action: 'find'            },
  { plugin: 'api::project',          controller: 'project',          action: 'findOne'         },
  { plugin: 'api::project',          controller: 'project',          action: 'create'          },
  { plugin: 'api::project',          controller: 'project',          action: 'myProjects'      },
  { plugin: 'api::project',          controller: 'project',          action: 'closeProject'    },
  { plugin: 'api::project',          controller: 'project',          action: 'addMember'       },
  { plugin: 'api::project',          controller: 'project',          action: 'removeMember'    },
  // Dashboard
  { plugin: 'api::dashboard',        controller: 'dashboard',        action: 'summary'         },
  { plugin: 'api::dashboard',        controller: 'dashboard',        action: 'pendingTasks'    },
  { plugin: 'api::dashboard',        controller: 'dashboard',        action: 'underReview'     },
  { plugin: 'api::dashboard',        controller: 'dashboard',        action: 'staffOverview'   },
  { plugin: 'api::dashboard',        controller: 'dashboard',        action: 'pendingApproval' },
  // User (api::user — custom controller ใน src/api/user/)
  { plugin: 'api::user',             controller: 'user',             action: 'me'              },
  { plugin: 'api::user',             controller: 'user',             action: 'approveUser'     },
  { plugin: 'api::user',             controller: 'user',             action: 'rejectUser'      },
]

// Public role permissions (ไม่ต้อง login)
const PUBLIC = [
  // register ไม่ต้อง auth — auth: false ใน route แล้ว แต่ seed ไว้ด้วยกันเพื่อความชัดเจน
  { plugin: 'api::user', controller: 'user', action: 'register' },
]

// ============================================================
async function main() {
  console.log(`\n🔗 Strapi: ${BASE}`)

  // 1. Admin login → JWT
  const loginRes  = await fetch(`${BASE}/admin/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: EMAIL, password: PASS }),
  })
  const loginJson = await loginRes.json()
  const jwt       = loginJson?.data?.token

  if (!jwt) {
    console.error('❌ Login ไม่สำเร็จ:', JSON.stringify(loginJson, null, 2))
    process.exit(1)
  }
  console.log('✅ Admin login สำเร็จ')

  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }

  // 2. ดึง roles
  const rolesRes  = await fetch(`${BASE}/users-permissions/roles`, { headers: h })
  const rolesJson = await rolesRes.json()
  const roles     = Array.isArray(rolesJson)         ? rolesJson
                  : Array.isArray(rolesJson?.roles)   ? rolesJson.roles
                  : []

  if (!roles.length) {
    console.error('❌ ดึง roles ไม่ได้:', JSON.stringify(rolesJson, null, 2))
    process.exit(1)
  }
  console.log('📋 Roles:', roles.map(r => `${r.name}(${r.type})`).join(', '))

  const authRole   = roles.find(r => r.type === 'authenticated')
  const publicRole = roles.find(r => r.type === 'public')

  if (!authRole)   { console.error('❌ ไม่พบ authenticated role'); process.exit(1) }
  if (!publicRole) { console.error('❌ ไม่พบ public role');        process.exit(1) }

  // 3. อัปเดต permissions
  await setPermissions(authRole.id,   'authenticated', AUTHENTICATED, h)
  await setPermissions(publicRole.id, 'public',        PUBLIC,        h)

  console.log('\n🎉 เสร็จสิ้น!')
  console.log('   ตรวจสอบที่ Admin Panel → Settings → Roles')
}

async function setPermissions(roleId, roleName, perms, h) {
  console.log(`\n⚙️  Updating [${roleName}] (id=${roleId})...`)

  // ดึง role ปัจจุบัน
  const currentRes  = await fetch(`${BASE}/users-permissions/roles/${roleId}`, { headers: h })
  const currentJson = await currentRes.json()
  const existing    = currentJson?.role?.permissions ?? currentJson?.permissions ?? {}
  const updated     = JSON.parse(JSON.stringify(existing))

  for (const { plugin, controller, action } of perms) {
    /*
     * Strapi 5 permissions key format:
     *
     *   api::task             → 'task'
     *   api::handover-request → 'handover-request'
     *   api::user             → 'user'           ← custom controller
     *   api::dashboard        → 'dashboard'
     *   plugin::users-permissions → 'users-permissions'  (ถ้าจะ override built-in)
     *
     * ตัด prefix api:: หรือ plugin:: ออก เหลือแค่ชื่อ
     */
    const pluginKey = plugin.startsWith('api::')    ? plugin.replace('api::', '')
                    : plugin.startsWith('plugin::') ? plugin.replace('plugin::', '')
                    : plugin

    updated[pluginKey]                              ??= { controllers: {} }
    updated[pluginKey].controllers                  ??= {}
    updated[pluginKey].controllers[controller]      ??= {}
    updated[pluginKey].controllers[controller][action] = { enabled: true }
  }

  const putRes = await fetch(`${BASE}/users-permissions/roles/${roleId}`, {
    method:  'PUT',
    headers: h,
    body:    JSON.stringify({ permissions: updated }),
  })

  if (putRes.ok) {
    console.log(`   ✅ ${perms.length} permissions เปิดแล้ว`)
  } else {
    const err = await putRes.text()
    console.error(`   ❌ ล้มเหลว:`, err)
  }
}

main().catch(err => { console.error('❌', err); process.exit(1) })
