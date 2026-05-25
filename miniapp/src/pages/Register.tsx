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
    telegram_id: '',
    telegram_chat_id: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (form.username.trim().length < 3) {
      setError('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (!form.email.includes('@')) {
      setError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }
    if (form.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
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
        telegram_id: form.role_app === 'manager' ? form.telegram_id.trim() : undefined,
        telegram_chat_id: form.role_app === 'manager' ? form.telegram_chat_id.trim() : undefined,
      });
      onRegistered(data.jwt, data.user);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'สมัครใช้งานไม่สำเร็จ');
      setStatus('idle');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-white">สมัครใช้งาน</h1>

          <input
            type="text"
            placeholder="ชื่อผู้ใช้"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
          />
          <input
            type="email"
            placeholder="อีเมล"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
          />
          <input
            type="text"
            placeholder="ชื่อที่แสดง"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
          />
          <input
            type="password"
            placeholder="รหัสผ่าน"
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
                {role === 'staff' ? 'พนักงาน' : 'หัวหน้า'}
              </button>
            ))}
          </div>

          {form.role_app === 'manager' && (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">กรอกเฉพาะกรณีที่บัญชีนี้ต้องการรับแจ้งเตือนผ่าน Telegram</p>
              <input
                type="text"
                placeholder="Telegram ID"
                value={form.telegram_id}
                onChange={(e) => setForm((f) => ({ ...f, telegram_id: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
              />
              <input
                type="text"
                placeholder="Telegram Chat ID"
                value={form.telegram_chat_id}
                onChange={(e) => setForm((f) => ({ ...f, telegram_chat_id: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
              />
            </div>
          )}

          {error && <div className="text-sm text-red-400">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={status === 'loading'}
            className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 disabled:opacity-60"
          >
            {status === 'loading' ? 'กำลังสมัคร...' : 'สมัครใช้งาน'}
          </button>

          <p className="text-sm text-slate-400 text-center">
            มีบัญชีอยู่แล้ว? <Link to="/login" className="text-blue-400">เข้าสู่ระบบ</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
