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

axios.defaults.baseURL = import.meta.env.VITE_STRAPI_URL + '/api'

type AppState = 'loading' | 'no_telegram' | 'not_registered' | 'ready'

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [appState, setAppState] = useState<AppState>('loading')

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

    try {
      const { data } = await axios.get('/users/me/profile')
      setUser(data)
      setAppState('ready')
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404) {
        setAppState('not_registered')
      } else {
        setAppState('not_registered')
      }
    }
  }

  if (appState === 'loading') return <Loading />

  if (appState === 'no_telegram') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">✈️</div>
          <p className="text-white font-semibold">กรุณาเปิดผ่าน Telegram</p>
        </div>
      </div>
    )
  }

  if (appState === 'not_registered') {
    return <Register onRegistered={() => initTelegram()} />
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