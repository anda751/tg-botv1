import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerNav from '../../components/ManagerNav'
import { dashboardApi, userApi } from '../../api'

type StaffMember = {
  id: number
  display_name: string
  username: string
  telegram_id: string
  active_tasks: number
}

type PendingUser = {
  id: number
  display_name: string
  email: string
  telegram_id: string
  registered_at: string
}

export default function Staff() {
  const navigate = useNavigate()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [pending, setPending] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'pending'>('active')
  const [search, setSearch] = useState('')
  const [actionId, setActionId] = useState<number | null>(null)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [st, pa] = await Promise.all([
        dashboardApi.staffOverview(),
        dashboardApi.pendingApproval(),
      ])
      setStaff(Array.isArray(st.data) ? st.data : [])
      setPending(Array.isArray(pa.data) ? pa.data : [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(userId: number) {
    setActionId(userId)
    try {
      await userApi.approve(userId)
      await loadData()
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(userId: number) {
    if (rejectReason.length < 5) return
    setActionId(userId)
    try {
      await userApi.reject(userId, rejectReason)
      setRejectId(null)
      setRejectReason('')
      await loadData()
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setActionId(null)
    }
  }

  const filteredStaff = staff.filter(s =>
    !search ||
    (s.display_name || s.username).toLowerCase().includes(search.toLowerCase())
  )

  const filteredPending = pending.filter(u =>
    !search ||
    u.display_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
    if (diff < 60) return `${diff} นาทีที่แล้ว`
    if (diff < 1440) return `${Math.floor(diff / 60)} ชั่วโมงที่แล้ว`
    return `${Math.floor(diff / 1440)} วันที่แล้ว`
  }

  function workloadColor(n: number) {
    if (n === 0) return 'text-slate-600'
    if (n >= 4) return 'text-red-400'
    if (n >= 2) return 'text-amber-400'
    return 'text-green-400'
  }

  function workloadBg(n: number) {
    if (n === 0) return 'bg-slate-800'
    if (n >= 4) return 'bg-red-900/40 border-red-800/50'
    if (n >= 2) return 'bg-amber-900/30 border-amber-800/40'
    return 'bg-green-900/30 border-green-800/40'
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Staff</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {staff.length} คน
              {pending.length > 0 && (
                <span className="ml-2 text-red-400 font-semibold">· รออนุมัติ {pending.length}</span>
              )}
            </p>
          </div>
          <button
            onClick={loadData}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 bg-slate-800 active:bg-slate-700 transition"
          >
            ↻
          </button>
        </div>

        <ManagerNav />

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input
            type="text"
            placeholder="ค้นหาชื่อหรืออีเมล..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Sub tabs */}
      <div className="px-4 pt-3 flex gap-2">
        <button
          onClick={() => setTab('active')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
            tab === 'active'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900 border border-slate-700 text-slate-400'
          }`}
        >
          พนักงาน {staff.length > 0 && `(${staff.length})`}
        </button>
        <button
          onClick={() => setTab('pending')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition relative ${
            tab === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900 border border-slate-700 text-slate-400'
          }`}
        >
          รออนุมัติ
          {pending.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
              {pending.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">

        {/* Skeleton */}
        {loading && [1,2,3].map(i => (
          <div key={i} className="bg-slate-900 rounded-2xl h-20 animate-pulse" />
        ))}

        {/* Active staff */}
        {!loading && tab === 'active' && (
          <>
            {filteredStaff.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-slate-300 font-semibold">ไม่พบพนักงาน</p>
              </div>
            ) : (
              filteredStaff.map(s => (
                <div
                  key={s.id}
                  className={`border rounded-2xl p-4 flex items-center gap-3 ${workloadBg(s.active_tasks)}`}
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center text-base font-bold text-slate-200 shrink-0">
                    {(s.display_name || s.username)?.[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {s.display_name || s.username}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">@{s.username}</p>
                  </div>

                  {/* Workload badge */}
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold leading-none ${workloadColor(s.active_tasks)}`}>
                      {s.active_tasks}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">งาน</p>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Pending users */}
        {!loading && tab === 'pending' && (
          <>
            {filteredPending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-slate-300 font-semibold">ไม่มีคำขอรออนุมัติ</p>
              </div>
            ) : (
              filteredPending.map(u => (
                <div key={u.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                  {/* Top */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center text-base font-bold text-slate-200 shrink-0">
                      {u.display_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">{u.display_name}</p>
                      <p className="text-slate-500 text-xs truncate">{u.email}</p>
                    </div>
                    <p className="text-xs text-slate-600 shrink-0">{timeAgo(u.registered_at)}</p>
                  </div>

                  {/* Telegram ID */}
                  <div className="flex items-center gap-2 mb-3 bg-slate-800 rounded-xl px-3 py-2">
                    <span className="text-sm">✈️</span>
                    <span className="text-xs text-slate-400 font-mono">{u.telegram_id}</span>
                  </div>

                  {/* Reject reason input */}
                  {rejectId === u.id && (
                    <div className="mb-3">
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="ระบุเหตุผลที่ปฏิเสธ (อย่างน้อย 5 ตัว)"
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-600 outline-none focus:border-red-500 text-xs resize-none"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  {rejectId === u.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setRejectId(null); setRejectReason('') }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-400 bg-slate-800 active:bg-slate-700 transition"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={() => handleReject(u.id)}
                        disabled={rejectReason.length < 5 || actionId === u.id}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-red-600 active:bg-red-700 transition disabled:opacity-40"
                      >
                        {actionId === u.id ? '...' : 'ยืนยันปฏิเสธ'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRejectId(u.id)}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-red-300 bg-red-950/40 border border-red-800/50 active:bg-red-900 transition"
                      >
                        ❌ ปฏิเสธ
                      </button>
                      <button
                        onClick={() => handleApprove(u.id)}
                        disabled={actionId === u.id}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-green-600 active:bg-green-700 transition disabled:opacity-40"
                      >
                        {actionId === u.id ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          </span>
                        ) : '✅ อนุมัติ'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}