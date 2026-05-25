import { useState } from 'react';
import { Link } from 'react-router-dom';
import { userApi } from '../api';

type RoleApp = 'manager' | 'staff';

type AuthUser = {
  id: number
  username: string
  email: string
  display_name: string
  role_app: RoleApp
  is_approved: boolean
}

export default function Register({ onRegistered }: { onRegistered: (token: string, user: AuthUser) => void }) {
  const [form, setForm] = useState({
    username: '',
    email: '',
    display_name: '',
    password: '',
    role_app: 'staff' as RoleApp,
  });
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (form.username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!form.email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setStatus('loading');
    try {
      const { data } = await userApi.register({
        username: form.username.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        display_name: form.display_name.trim() || form.username.trim(),
        password: form.password,
        role_app: form.role_app,
      });
      onRegistered(data.jwt, data.user);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Register failed');
      setStatus('idle');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-white">Create Account</h1>

          <input
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
          />
          <input
            type="text"
            placeholder="Display Name"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            {(['staff', 'manager'] as RoleApp[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setForm((f) => ({ ...f, role_app: role }))}
                className={`py-3 rounded-xl text-sm font-semibold border ${
                  form.role_app === role
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {role === 'staff' ? 'Staff' : 'Manager'}
              </button>
            ))}
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={status === 'loading'}
            className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 disabled:opacity-60"
          >
            {status === 'loading' ? 'Creating account...' : 'Sign Up'}
          </button>

          <p className="text-sm text-slate-400 text-center">
            Already have an account? <Link to="/login" className="text-blue-400">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
