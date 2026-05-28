import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { userApi } from '../api'

type AuthUser = {
  id: number
  username: string
  email: string
  display_name: string
  role_app: 'manager' | 'staff'
  is_approved: boolean
}

const TEXT = {
  title: '\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a',
  identifierRequired:
    '\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e2b\u0e23\u0e37\u0e2d\u0e2d\u0e35\u0e40\u0e21\u0e25 \u0e41\u0e25\u0e30\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19',
  loginFailed: '\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08',
  identifierPlaceholder: '\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e2b\u0e23\u0e37\u0e2d\u0e2d\u0e35\u0e40\u0e21\u0e25',
  passwordPlaceholder: '\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19',
  loggingIn: '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a...',
  login: '\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a',
  noAccount: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1a\u0e31\u0e0d\u0e0a\u0e35?',
  register: '\u0e2a\u0e21\u0e31\u0e04\u0e23\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19',
} as const

export default function Login({ onLoggedIn }: { onLoggedIn: (token: string, user: AuthUser) => void }) {
  const [searchParams] = useSearchParams()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const autoSubmittedRef = useRef(false)

  useEffect(() => {
    const nextIdentifier = searchParams.get('identifier') ?? searchParams.get('username') ?? ''
    const nextPassword = searchParams.get('password') ?? ''

    if (nextIdentifier) setIdentifier(nextIdentifier)
    if (nextPassword) setPassword(nextPassword)
  }, [searchParams])

  useEffect(() => {
    const shouldAutoLogin = searchParams.get('autologin') === '1'
    if (!shouldAutoLogin || autoSubmittedRef.current) return
    if (!identifier.trim() || !password || loading) return

    autoSubmittedRef.current = true
    void handleLogin(identifier, password)
  }, [identifier, loading, password, searchParams])

  async function handleLogin(nextIdentifier = identifier, nextPassword = password) {
    if (!nextIdentifier.trim() || !nextPassword) {
      setError(TEXT.identifierRequired)
      return
    }

    setLoading(true)
    setError('')
    try {
      const { data } = await userApi.login({
        identifier: nextIdentifier.trim(),
        password: nextPassword,
      })
      onLoggedIn(data.jwt, data.user)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || TEXT.loginFailed)
      setLoading(false)
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
            placeholder={TEXT.identifierPlaceholder}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="auth-input w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white transition-colors"
          />
          <input
            type="password"
            placeholder={TEXT.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white transition-colors"
          />

          {error && <div className="text-sm text-red-400">{error}</div>}

          <button
            onClick={() => void handleLogin()}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 disabled:opacity-60"
          >
            {loading ? TEXT.loggingIn : TEXT.login}
          </button>

          <p className="text-sm text-slate-400 text-center">
            {TEXT.noAccount} <Link to="/register" className="text-blue-400">{TEXT.register}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
