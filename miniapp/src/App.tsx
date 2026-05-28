import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import axios from 'axios'

import MyTasks from './pages/staff/MyTasks'
import CreateTask from './pages/staff/CreateTask'
import SubmitTask from './pages/staff/SubmitTask'
import ProgressTask from './pages/staff/ProgressTask'
import HandoverTask from './pages/staff/HandoverTask'
import PickupTask from './pages/staff/PickupTask'
import StaffSettings from './pages/staff/Settings'
import Dashboard from './pages/manager/Dashboard'
import Projects from './pages/manager/Projects'
import Tasks from './pages/manager/Tasks'
import Staff from './pages/manager/Staff'
import Kpi from './pages/manager/Kpi'
import History from './pages/manager/History'
import Reports from './pages/manager/Reports'
import Settings from './pages/manager/Settings'
import Register from './pages/Register'
import Loading from './components/Loading'
import Login from './pages/Login'

type RoleApp = 'manager' | 'staff'
type ThemeMode = 'dark' | 'light'

export type AppUser = {
  id: number
  username: string
  display_name: string
  email: string
  role_app: RoleApp
  is_approved: boolean
  telegram_id?: string
  telegram_chat_id?: string
}

const AUTH_TOKEN_KEY = 'auth-token'
const THEME_KEY = 'app-theme'

axios.defaults.baseURL = `${import.meta.env.VITE_STRAPI_URL}/api`

export default function App() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AppUser | null>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    void initAuth()
  }, [])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
    document.body.classList.remove('theme-dark', 'theme-light')
    document.body.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  async function initAuth() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) {
      delete axios.defaults.headers.common.Authorization
      setUser(null)
      setLoading(false)
      return
    }

    axios.defaults.headers.common.Authorization = `Bearer ${token}`
    try {
      const { data } = await axios.get('/profile/me')
      setUser(data)
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      delete axios.defaults.headers.common.Authorization
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  function handleAuthSuccess(token: string, authUser: AppUser) {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    axios.defaults.headers.common.Authorization = `Bearer ${token}`
    setUser(authUser)
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    delete axios.defaults.headers.common.Authorization
    setUser(null)
    setConfirmLogout(false)
  }

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  if (loading) return <Loading />

  const roleLabel = user?.role_app === 'manager' ? 'หัวหน้า' : 'ลูกน้อง'
  const shellClass = theme === 'light'
    ? 'min-h-screen bg-slate-50 text-slate-900 transition-colors'
    : 'min-h-screen bg-slate-950 text-slate-100 transition-colors'
  const topBarClass = theme === 'light'
    ? 'sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur'
    : 'sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur'
  const eyebrowClass = theme === 'light'
    ? 'text-[11px] font-semibold uppercase tracking-widest text-slate-500'
    : 'text-[11px] font-semibold uppercase tracking-widest text-slate-500'
  const identityClass = theme === 'light'
    ? 'truncate text-sm font-semibold text-slate-900'
    : 'truncate text-sm font-semibold text-slate-100'
  const themeButtonClass = theme === 'light'
    ? 'interactive-press flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-sm font-semibold text-slate-700'
    : 'interactive-press flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-200'
  const cancelButtonClass = theme === 'light'
    ? 'shrink-0 rounded-full border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition active:bg-slate-200'
    : 'shrink-0 rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition active:bg-slate-700'
  const logoutButtonClass = theme === 'light'
    ? 'shrink-0 rounded-full border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition active:bg-red-100'
    : 'shrink-0 rounded-full border border-red-800 bg-red-950/80 px-3 py-2 text-xs font-semibold text-red-200 transition active:bg-red-900'
  const logoutIconClass = theme === 'light'
    ? 'shrink-0 flex h-10 w-10 items-center justify-center rounded-full border border-red-300 bg-red-50 text-base font-semibold text-red-700 transition active:bg-red-100'
    : 'shrink-0 flex h-10 w-10 items-center justify-center rounded-full border border-red-800 bg-red-950/80 text-base font-semibold text-red-200 transition active:bg-red-900'

  return (
    <BrowserRouter>
      {!user ? (
        <Routes>
          <Route path="/login" element={<Login onLoggedIn={handleAuthSuccess} />} />
          <Route path="/register" element={<Register onRegistered={handleAuthSuccess} />} />
          <Route path="/logout" element={<Navigate to="/login" replace />} />
          <Route path="/test/logout" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <div className={shellClass}>
          <div className={topBarClass}>
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className={eyebrowClass}>ระบบติดตามงาน</p>
                <p className={identityClass}>
                  {user.display_name || user.username} · {roleLabel}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className={themeButtonClass}
                  title={theme === 'dark' ? 'เปิดโหมดสว่าง' : 'เปิดโหมดมืด'}
                  aria-label={theme === 'dark' ? 'เปิดโหมดสว่าง' : 'เปิดโหมดมืด'}
                >
                  {theme === 'dark' ? '☀' : '☾'}
                </button>

                {confirmLogout ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmLogout(false)}
                      className={cancelButtonClass}
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleLogout}
                      className={logoutButtonClass}
                    >
                      ออก
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmLogout(true)}
                    className={logoutIconClass}
                    title="ออกจากระบบ"
                    aria-label="ออกจากระบบ"
                  >
                    ⎋
                  </button>
                )}
              </div>
            </div>
          </div>

          <Routes>
            {user.role_app === 'manager' ? (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/staff" element={<Staff />} />
                <Route path="/kpi" element={<Kpi />} />
                <Route path="/history" element={<History />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/logout" element={<LogoutRoute onLogout={handleLogout} />} />
                <Route path="/test/logout" element={<LogoutRoute onLogout={handleLogout} />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/register" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={<MyTasks />} />
                <Route path="/create" element={<CreateTask />} />
                <Route path="/submit/:taskId" element={<SubmitTask />} />
                <Route path="/progress/:taskId" element={<ProgressTask />} />
                <Route path="/handover/:taskId" element={<HandoverTask />} />
                <Route path="/pickup" element={<PickupTask />} />
                <Route path="/settings" element={<StaffSettings />} />
                <Route path="/logout" element={<LogoutRoute onLogout={handleLogout} />} />
                <Route path="/test/logout" element={<LogoutRoute onLogout={handleLogout} />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/register" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </div>
      )}
    </BrowserRouter>
  )
}

function LogoutRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()

  useEffect(() => {
    onLogout()
    navigate('/login', { replace: true })
  }, [navigate, onLogout])

  return <Loading />
}
