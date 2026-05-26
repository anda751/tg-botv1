import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import axios from 'axios';

import MyTasks from './pages/staff/MyTasks';
import CreateTask from './pages/staff/CreateTask';
import SubmitTask from './pages/staff/SubmitTask';
import ProgressTask from './pages/staff/ProgressTask';
import HandoverTask from './pages/staff/HandoverTask';
import PickupTask from './pages/staff/PickupTask';
import StaffSettings from './pages/staff/Settings';
import Dashboard from './pages/manager/Dashboard';
import Projects from './pages/manager/Projects';
import Tasks from './pages/manager/Tasks';
import Staff from './pages/manager/Staff';
import Kpi from './pages/manager/Kpi';
import Reports from './pages/manager/Reports';
import Settings from './pages/manager/Settings';
import Register from './pages/Register';
import Loading from './components/Loading';
import Login from './pages/Login';

type RoleApp = 'manager' | 'staff';

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

const AUTH_TOKEN_KEY = 'auth-token';
axios.defaults.baseURL = `${import.meta.env.VITE_STRAPI_URL}/api`;

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      delete axios.defaults.headers.common.Authorization;
      setUser(null);
      setLoading(false);
      return;
    }

    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    try {
      const { data } = await axios.get('/profile/me');
      setUser(data);
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      delete axios.defaults.headers.common.Authorization;
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  function handleAuthSuccess(token: string, authUser: AppUser) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    setUser(authUser);
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    delete axios.defaults.headers.common.Authorization;
    setUser(null);
  }

  if (loading) return <Loading />;

  const roleLabel = user?.role_app === 'manager' ? 'หัวหน้า' : 'ลูกน้อง';

  return (
    <BrowserRouter>
      {!user ? (
        <Routes>
          <Route path="/login" element={<Login onLoggedIn={handleAuthSuccess} />} />
          <Route path="/register" element={<Register onRegistered={handleAuthSuccess} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <div className="min-h-screen bg-slate-950">
          <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Task Tracker
                </p>
                <p className="truncate text-sm font-semibold text-slate-100">
                  {user.display_name || user.username} · {roleLabel}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full border border-red-800 bg-red-950/80 text-base font-semibold text-red-200 transition active:bg-red-900"
                title="ออกจากระบบ"
                aria-label="ออกจากระบบ"
              >
                ⎋
              </button>
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
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
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
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/register" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </div>
      )}
    </BrowserRouter>
  );
}
