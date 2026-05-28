import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { userApi } from '../api'

type RoleApp = 'manager' | 'staff'

type AuthUser = {
  id: number
  username: string
  email: string
  display_name: string
  role_app: RoleApp
  is_approved: boolean
}

const TEXT = {
  title: '\u0e2a\u0e21\u0e31\u0e04\u0e23\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19',
  usernameTooShort:
    '\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e15\u0e49\u0e2d\u0e07\u0e21\u0e35\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 3 \u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23',
  invalidEmail:
    '\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e43\u0e2b\u0e49\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07',
  passwordTooShort:
    '\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e15\u0e49\u0e2d\u0e07\u0e21\u0e35\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 6 \u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23',
  registerFailed:
    '\u0e2a\u0e21\u0e31\u0e04\u0e23\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08',
  usernamePlaceholder: '\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49',
  emailPlaceholder: '\u0e2d\u0e35\u0e40\u0e21\u0e25',
  displayNamePlaceholder: '\u0e0a\u0e37\u0e48\u0e2d\u0e17\u0e35\u0e48\u0e41\u0e2a\u0e14\u0e07',
  passwordPlaceholder: '\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19',
  managerTelegramHint:
    '\u0e01\u0e23\u0e2d\u0e01\u0e40\u0e09\u0e1e\u0e32\u0e30\u0e01\u0e23\u0e13\u0e35\u0e17\u0e35\u0e48\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e19\u0e35\u0e49\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e23\u0e31\u0e1a\u0e41\u0e08\u0e49\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e1c\u0e48\u0e32\u0e19 Telegram',
  staff: '\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19',
  manager: '\u0e2b\u0e31\u0e27\u0e2b\u0e19\u0e49\u0e32',
  registering: '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e21\u0e31\u0e04\u0e23...',
  register: '\u0e2a\u0e21\u0e31\u0e04\u0e23\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19',
  hasAccount: '\u0e21\u0e35\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e2d\u0e22\u0e39\u0e48\u0e41\u0e25\u0e49\u0e27?',
  login: '\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a',
} as const

function normalizeRole(value: string | null): RoleApp {
  return value === 'manager' ? 'manager' : 'staff'
}

export default function Register({ onRegistered }: { onRegistered: (token: string, user: AuthUser) => void }) {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    username: '',
    email: '',
    display_name: '',
    password: '',
    role_app: 'staff' as RoleApp,
    telegram_id: '',
    telegram_chat_id: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading'>('idle')
  const [error, setError] = useState('')
  const autoSubmittedRef = useRef(false)

  useEffect(() => {
    setForm((current) => ({
      ...current,
      username: searchParams.get('username') ?? current.username,
      email: searchParams.get('email') ?? current.email,
      display_name:
        searchParams.get('display_name') ??
        searchParams.get('displayName') ??
        current.display_name,
      password: searchParams.get('password') ?? current.password,
      role_app: normalizeRole(searchParams.get('role_app') ?? searchParams.get('role')),
      telegram_id: searchParams.get('telegram_id') ?? current.telegram_id,
      telegram_chat_id: searchParams.get('telegram_chat_id') ?? current.telegram_chat_id,
    }))
  }, [searchParams])

  useEffect(() => {
    const shouldAutoRegister = searchParams.get('autoregister') === '1'
    if (!shouldAutoRegister || autoSubmittedRef.current) return
    if (!form.username.trim() || !form.email.trim() || !form.password || status === 'loading') return

    autoSubmittedRef.current = true
    void handleSubmit()
  }, [form, searchParams, status])

  async function handleSubmit() {
    if (form.username.trim().length < 3) {
      setError(TEXT.usernameTooShort)
      return
    }
    if (!form.email.includes('@')) {
      setError(TEXT.invalidEmail)
      return
    }
    if (form.password.length < 6) {
      setError(TEXT.passwordTooShort)
      return
    }

    setError('')
    setStatus('loading')
    try {
      const { data } = await userApi.register({
        username: form.username.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        display_name: form.display_name.trim() || form.username.trim(),
        password: form.password,
        role_app: form.role_app,
        telegram_id: form.role_app === 'manager' ? form.telegram_id.trim() : undefined,
        telegram_chat_id: form.role_app === 'manager' ? form.telegram_chat_id.trim() : undefined,
      })
      onRegistered(data.jwt, data.user)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || TEXT.registerFailed)
      setStatus('idle')
    }
  }

  return (
    <div className="auth-shell min-h-screen flex flex-col bg-slate-950 transition-colors">
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="auth-card w-full max-w-sm space-y-4 rounded-3xl border border-slate-800 px-5 py-6 transition-colors">
          <h1 className="text-2xl font-bold text-white">{TEXT.title}</h1>

          <input
            type="text"
            placeholder={TEXT.usernamePlaceholder}
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            className="auth-input w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white transition-colors"
          />
          <input
            type="email"
            placeholder={TEXT.emailPlaceholder}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="auth-input w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white transition-colors"
          />
          <input
            type="text"
            placeholder={TEXT.displayNamePlaceholder}
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            className="auth-input w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white transition-colors"
          />
          <input
            type="password"
            placeholder={TEXT.passwordPlaceholder}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="auth-input w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white transition-colors"
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
                {role === 'staff' ? TEXT.staff : TEXT.manager}
              </button>
            ))}
          </div>

          {form.role_app === 'manager' && (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">{TEXT.managerTelegramHint}</p>
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
            onClick={() => void handleSubmit()}
            disabled={status === 'loading'}
            className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 disabled:opacity-60"
          >
            {status === 'loading' ? TEXT.registering : TEXT.register}
          </button>

          <p className="text-sm text-slate-400 text-center">
            {TEXT.hasAccount} <Link to="/login" className="text-blue-400">{TEXT.login}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
