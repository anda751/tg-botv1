import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerNav from '../../components/ManagerNav'
import { dashboardApi, taskApi } from '../../api'

type Task = {
  id: number
  name: string
  status_task: 'in_progress' | 'under_review' | 'waiting_pickup' | 'done'
  current_owner: { id: number; display_name: string; username: string } | null
  created_at: string
  log_count: number
}

const STATUS_LABEL: Record<string, { text: string; color: string; dot: string }> = {
  in_progress:    { text: 'กำลังทำ',       color: 'bg-blue-900/50 text-blue-300',   dot: 'bg-blue-400' },
  under_review:   { text: 'รอตรวจ',        color: 'bg-amber-900/50 text-amber-300', dot: 'bg-amber-400' },
  waiting_pickup: { text: 'รอคนรับ',       color: 'bg-orange-900/50 text-orange-300', dot: 'bg-orange-400' },
  done:           { text: 'เสร็จแล้ว',     color: 'bg-green-900/50 text-green-300', dot: 'bg-green-400' },
}

type FilterStatus = 'all' | 'in_progress' | 'under_review' | 'waiting_pickup' | 'done'

export default function Tasks() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    setLoading(true)
    try {
      const { data } = await dashboardApi.pendingTasks()
      // pendingTasks only returns non-done, so also fetch done separately if needed
      const list = Array.isArray(data) ? data : []
      setTasks(list)
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(taskId: number) {
    setActionLoading(taskId)
    try {
      await taskApi.approve(taskId)
      await loadTasks()
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(taskId: number) {
    if (rejectReason.length < 5) return
    setActionLoading(taskId)
    try {
      await taskApi.reject(taskId, rejectReason)
      setRejectId(null)
      setRejectReason('')
      await loadTasks()
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = tasks.filter(t => {
    const matchStatus = filter === 'all' || t.status_task === filter
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase())
      || (t.current_owner?.display_name ?? '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const counts: Record<string, number> = {
    all: tasks.length,
    in_progress: tasks.filter(t => t.status_task === 'in_progress').length,
    under_review: tasks.filter(t => t.status_task === 'under_review').length,
    waiting_pickup: tasks.filter(t => t.status_task === 'waiting_pickup').length,
    done: tasks.filter(t => t.status_task === 'done').length,
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Tasks</h1>
            <p className="text-xs text-slate-400 mt-0.5">{tasks.length} งานทั้งหมด</p>
          </div>
          <button
            onClick={loadTasks}
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
            placeholder="ค้นหาชื่องาน หรือพนักงาน..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-4 pt-3 pb-1 flex gap-2 overflow-x-auto">
        {([
          { key: 'all', label: 'ทั้งหมด' },
          { key: 'under_review', label: '🔍 รอตรวจ' },
          { key: 'in_progress', label: '🔵 กำลังทำ' },
          { key: 'waiting_pickup', label: '🟡 รอรับ' },
          { key: 'done', label: '✅ เสร็จ' },
        ] as { key: FilterStatus; label: string }[]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
              filter === f.key
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {f.label}
            {counts[f.key] > 0 && (
              <span className={`ml-1.5 ${filter === f.key ? 'text-blue-200' : 'text-slate-500'}`}>
                {counts[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-3 space-y-3">
        {/* Skeletons */}
        {loading && [1,2,3,4].map(i => (
          <div key={i} className="bg-slate-900 rounded-2xl p-4 animate-pulse h-28" />
        ))}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-slate-300 font-semibold">ไม่พบงาน</p>
            <p className="text-slate-500 text-sm mt-1">ลองเปลี่ยน filter หรือ keyword</p>
          </div>
        )}

        {/* Task cards */}
        {!loading && filtered.map(task => {
          const s = STATUS_LABEL[task.status_task]
          const isRejecting = rejectId === task.id
          const isLoading = actionLoading === task.id

          return (
            <div key={task.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
              {/* Top row */}
              <div className="flex items-start gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${s.dot}`} />
                <p className="text-white font-semibold text-sm leading-snug flex-1">{task.name}</p>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${s.color}`}>
                  {s.text}
                </span>
              </div>

              {/* Owner + logs */}
              <div className="flex items-center gap-3 mb-3 ml-4">
                {task.current_owner ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                      {(task.current_owner.display_name || task.current_owner.username)?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs text-slate-400">
                      {task.current_owner.display_name || task.current_owner.username}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-600">ไม่มีผู้รับผิดชอบ</span>
                )}
                {task.log_count > 0 && (
                  <span className="text-xs text-slate-600">· {task.log_count} logs</span>
                )}
              </div>

              {/* Actions for under_review */}
              {task.status_task === 'under_review' && (
                <>
                  {isRejecting ? (
                    <div className="space-y-2 ml-4">
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="ระบุเหตุผลที่ส่งกลับ (อย่างน้อย 5 ตัว)"
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-600 outline-none focus:border-red-500 text-xs resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setRejectId(null); setRejectReason('') }}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-400 bg-slate-800 active:bg-slate-700 transition"
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={() => handleReject(task.id)}
                          disabled={rejectReason.length < 5 || isLoading}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 active:bg-red-700 transition disabled:opacity-40"
                        >
                          {isLoading ? '...' : 'ยืนยันส่งกลับ'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setRejectId(task.id)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-300 bg-red-950/40 border border-red-800/50 active:bg-red-900/50 transition"
                      >
                        ❌ ส่งกลับ
                      </button>
                      <button
                        onClick={() => handleApprove(task.id)}
                        disabled={isLoading}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-green-600 active:bg-green-700 transition disabled:opacity-40"
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          </span>
                        ) : '✅ อนุมัติ'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}