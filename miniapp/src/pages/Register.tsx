import { useState } from 'react'
import { userApi } from '../api'

export default function Register({ onRegistered }: { onRegistered: () => void }) {
  const [form, setForm] = useState({ email: '', display_name: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (form.display_name.length < 2) {
      setError('ชื่อต้องมีอย่างน้อย 2 ตัวอักษร')
      return
    }
    if (!form.email.includes('@')) {
      setError('กรุณากรอก Email ให้ถูกต้อง')
      return
    }

    const tg = (window as any).Telegram?.WebApp
    const telegramUser = tg?.initDataUnsafe?.user
    const telegramId = String(telegramUser?.id ?? '')

    if (!telegramId) {
      setError('ไม่พบข้อมูล Telegram กรุณาเปิดผ่าน Telegram')
      return
    }

    setError('')
    setStatus('loading')
    try {
      await userApi.register({
        email: form.email,
        display_name: form.display_name,
        telegram_id: telegramId,
        telegram_chat_id: telegramId,
      })
      setStatus('done')
      setTimeout(onRegistered, 1500)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-white text-lg font-semibold">สมัครเรียบร้อย!</p>
          <p className="text-slate-400 text-sm mt-1">กำลังเข้าสู่ระบบ...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="mb-8 text-center">
          <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-4xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-900/40">
            📋
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Task Manager</h1>
          <p className="text-slate-500 text-sm mt-1">ระบบบริหารจัดการงาน</p>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">
              ชื่อ-นามสกุล
            </label>
            <input
              type="text"
              placeholder="กรอกชื่อของคุณ"
              value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">
              อีเมล
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {error && (
            <div className="bg-red-950/60 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={status === 'loading'}
            className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 active:scale-95 transition-transform disabled:opacity-60"
          >
            {status === 'loading' ? 'กำลังสมัคร...' : 'สมัครใช้งาน'}
          </button>

          <p className="text-center text-xs text-slate-600">
            สมัครแล้วเข้าใช้งานได้เลย
          </p>
        </div>
      </div>
    </div>
  )
}