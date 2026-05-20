import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { retrieveLaunchParams } from '@telegram-apps/sdk'
import axios from 'axios'

// Staff Pages
import MyTasks from './pages/staff/MyTasks'
import CreateTask from './pages/staff/CreateTask'
import SubmitTask from './pages/staff/SubmitTask'
import HandoverTask from './pages/staff/HandoverTask'
import PickupTask from './pages/staff/PickupTask'

// Manager Pages
import Dashboard from './pages/manager/Dashboard'
import Projects from './pages/manager/Projects'
import Tasks from './pages/manager/Tasks'
import Staff from './pages/manager/Staff'
import Reports from './pages/manager/Reports'

// Shared
import Register from './pages/Register'
import Loading from './components/Loading'
import PendingApproval from './pages/PendingApproval'

export type AppUser = {
  id: number
  display_name: string
  email: string
  telegram_id: string
  role_app: 'manager' | 'staff'
  is_approved: boolean
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initTelegram()
  }, [])

async function initTelegram() {
  try {
    if (import.meta.env.DEV) {
      axios.defaults.baseURL = import.meta.env.VITE_STRAPI_URL + '/api'

      // จำลอง user เพื่อทดสอบ เปลี่ยน role_app เป็น 'manager' หรือ 'staff' ได้
      setUser({
        id: 1,
        display_name: 'ทดสอบ',
        email: 'test@test.com',
        telegram_id: '123456',
        role_app: 'staff', // ← เปลี่ยนเป็น 'manager' เพื่อทดสอบ Dashboard
        is_approved: true,
      })

      setLoading(false)
      return
    }

    const { initDataRaw } = retrieveLaunchParams()
    if (!initDataRaw) throw new Error('No initData')

    // ลบ setInitData ออก ไม่ต้องเก็บ state
    axios.defaults.baseURL = import.meta.env.VITE_STRAPI_URL + '/api'
    axios.defaults.headers.common['x-telegram-init-data'] = initDataRaw as string

    const { data } = await axios.get('/users/me/profile')
    setUser(data)
  } catch (err: any) {
    if (err?.response?.status === 401) {
      setUser(null)
    }
  } finally {
    setLoading(false)
  }
}

  if (loading) return <Loading />

  // ยังไม่ได้ลงทะเบียน
  if (!user) return <Register onRegistered={() => initTelegram()} />

  // ลงทะเบียนแล้วแต่รออนุมัติ
  if (!user.is_approved) return <PendingApproval />

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