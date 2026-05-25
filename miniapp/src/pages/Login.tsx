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
      setError('กรุณากรอกชื่อผู้ใช้หรืออีเมล และรหัสผ่าน');
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
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-white">เข้าสู่ระบบ</h1>

          <input
            type="text"
            placeholder="ชื่อผู้ใช้หรืออีเมล"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
          />
          <input
            type="password"
            placeholder="รหัสผ่าน"
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
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>

          <p className="text-sm text-slate-400 text-center">
            ยังไม่มีบัญชี? <Link to="/register" className="text-blue-400">สมัครใช้งาน</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
