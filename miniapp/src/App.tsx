import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

// ตั้ง baseURL ครั้งเดียว
axios.defaults.baseURL = import.meta.env.VITE_STRAPI_URL + '/api'

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initTelegram()
  }, [])

  async function initTelegram() {
    try {
      // ดึง initData จาก window.Telegram.WebApp
      const tg = (window as any).Telegram?.WebApp
      const initDataRaw = tg?.initData

      if (!initDataRaw) {
        // ไม่ได้เปิดใน Telegram
        setUser(null)
        setLoading(false)
        return
      }

      // ตั้ง header สำหรับทุก request
      axios.defaults.headers.common['x-telegram-init-data'] = initDataRaw

      // เรียก /users/me/profile — ถ้า user มีอยู่แล้วจะ login อัตโนมัติ
      const { data } = await axios.get('/users/me/profile')
      setUser(data)
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 404) {
        // ยังไม่ได้สมัคร → ไปหน้า Register
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading />

  if (!user) return <Register onRegistered={() => initTelegram()} />

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