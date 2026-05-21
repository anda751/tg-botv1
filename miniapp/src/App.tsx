import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'

import MyTasks from './pages/staff/MyTasks'
import CreateTask from './pages/staff/CreateTask'
import SubmitTask from './pages/staff/SubmitTask'
import HandoverTask from './pages/staff/HandoverTask'
import PickupTask from './pages/staff/PickupTask'

import Dashboard from './pages/manager/Dashboard'
import Projects from './pages/manager/Projects'
import Tasks from './pages/manager/Tasks'
import Staff from './pages/manager/Staff'
import Reports from './pages/manager/Reports'

import Register from './pages/Register'
import Loading from './components/Loading'

export type AppUser = {
  id: number
  display_name: string
  email: string
  telegram_id: string
  role_app: 'manager' | 'staff'
  is_approved: boolean
}

type RoleApp = 'manager' | 'staff'

axios.defaults.baseURL = import.meta.env.VITE_STRAPI_URL + '/api'

type AppState = 'loading' | 'no_telegram' | 'not_registered' | 'role_select' | 'error' | 'ready'

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [appState, setAppState] = useState<AppState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [availableRoles, setAvailableRoles] = useState<RoleApp[]>([])

  useEffect(() => {
    initTelegram()
  }, [])

  async function initTelegram() {
    setAppState('loading')

    const tg = (window as any).Telegram?.WebApp
    const initDataRaw = tg?.initData

    if (!initDataRaw) {
      setAppState('no_telegram')
      return
    }

    axios.defaults.headers.common['x-telegram-init-data'] = initDataRaw

    const savedRole = localStorage.getItem('tg-role-app')
    if (savedRole === 'manager' || savedRole === 'staff') {
      axios.defaults.headers.common['x-role-app'] = savedRole
    } else {
      delete axios.defaults.headers.common['x-role-app']
    }

    try {
      const { data } = await axios.get('/profile/me')
      setUser(data)
      setAvailableRoles([])
      setAppState('ready')
    } catch (err: any) {
      const status = err?.response?.status
      const roles = err?.response?.data?.error?.details?.availableRoles

      if (status === 404) {
        setAppState('not_registered')
      } else if (status === 409 && Array.isArray(roles) && roles.length > 0) {
        setAvailableRoles(roles)
        setAppState('role_select')
      } else if (status === 403) {
        setErrorMsg('บัญชียังไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ')
        setAppState('error')
      } else {
        setErrorMsg(`เกิดข้อผิดพลาด (${status ?? 'unknown'}) กรุณาลองใหม่อีกครั้ง`)
        setAppState('error')
      }
    }
  }

  async function selectRole(role: RoleApp) {
    localStorage.setItem('tg-role-app', role)
    axios.defaults.headers.common['x-role-app'] = role
    await initTelegram()
  }

  if (appState === 'loading') return <Loading />

  if (appState === 'no_telegram') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">Telegram</div>
          <p className="text-white font-semibold">กรุณาเปิดผ่าน Telegram</p>
        </div>
      </div>
    )
  }

  if (appState === 'not_registered') {
    return <Register onRegistered={() => initTelegram()} />
  }

  if (appState === 'role_select') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <p className="text-white text-lg font-bold mb-2">เลือกบทบาทที่ต้องการเข้าใช้</p>
          <p className="text-slate-400 text-sm mb-5">
            Telegram account นี้ถูกใช้กับหลายบทบาท เลือกก่อนว่าจะเข้าเป็นหัวหน้าหรือพนักงาน
          </p>
          <div className="space-y-3">
            {availableRoles.map((role) => (
              <button
                key={role}
                onClick={() => selectRole(role)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 transition"
              >
                {role === 'manager' ? 'เข้าเป็น Manager' : 'เข้าเป็น Staff'}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (appState === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <div className="text-5xl mb-4">Warning</div>
          <p className="text-white font-semibold mb-2">เกิดข้อผิดพลาด</p>
          <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
          <button
            onClick={initTelegram}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 transition"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    )
  }

  if (!user) return <Loading />

  return (
    <BrowserRouter>
      <Routes>
        {user.role_app === 'manager' ? (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        ) : (
          <>
            <Route path="/" element={<MyTasks />} />
            <Route path="/create" element={<CreateTask />} />
            <Route path="/submit/:taskId" element={<SubmitTask />} />
            <Route path="/handover/:taskId" element={<HandoverTask />} />
            <Route path="/pickup" element={<PickupTask />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}
