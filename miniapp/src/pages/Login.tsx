import { useState } from 'react';
import { Link } from 'react-router-dom';
import { userApi } from '../api';

type AuthUser = {
  id: number
  username: string
  email: string
  display_name: string
  role_app: 'manager' | 'staff'
  is_approved: boolean
}

export default function Login({ onLoggedIn }: { onLoggedIn: (token: string, user: AuthUser) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!identifier.trim() || !password) {
      setError('Please enter username/email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await userApi.login({
        identifier: identifier.trim(),
        password,
      });
      onLoggedIn(data.jwt, data.user);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Login failed');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-white">Login</h1>

          <input
            type="text"
            placeholder="Username or Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
          />

          {error && <div className="text-sm text-red-400">{error}</div>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <p className="text-sm text-slate-400 text-center">
            No account yet? <Link to="/register" className="text-blue-400">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
