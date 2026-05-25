import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import axios from 'axios';

import MyTasks from './pages/staff/MyTasks';
import CreateTask from './pages/staff/CreateTask';
import SubmitTask from './pages/staff/SubmitTask';
import ProgressTask from './pages/staff/ProgressTask';
import HandoverTask from './pages/staff/HandoverTask';
import PickupTask from './pages/staff/PickupTask';
import Dashboard from './pages/manager/Dashboard';
import Projects from './pages/manager/Projects';
import Tasks from './pages/manager/Tasks';
import Staff from './pages/manager/Staff';
import Reports from './pages/manager/Reports';
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

  return (
    <BrowserRouter>
      {!user ? (
        <Routes>
          <Route path="/login" element={<Login onLoggedIn={handleAuthSuccess} />} />
          <Route path="/register" element={<Register onRegistered={handleAuthSuccess} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <>
          <button
            onClick={handleLogout}
            className="fixed right-4 bottom-24 z-40 px-4 py-2 rounded-full text-xs font-semibold text-red-200 bg-red-950/90 border border-red-800 shadow-lg backdrop-blur active:bg-red-900 transition"
          >
            Logout
          </button>
          <Routes>
            {user.role_app === 'manager' ? (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/staff" element={<Staff />} />
                <Route path="/reports" element={<Reports />} />
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
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/register" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </>
      )}
    </BrowserRouter>
  );
}
