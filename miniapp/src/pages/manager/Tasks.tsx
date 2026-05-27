import { useEffect, useMemo, useState } from 'react'
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
  in_progress: { text: 'กำลังทำ', color: 'bg-blue-900/50 text-blue-300', dot: 'bg-blue-400' },
  under_review: { text: 'รอตรวจ', color: 'bg-amber-900/50 text-amber-300', dot: 'bg-amber-400' },
  waiting_pickup: { text: 'รอคนรับ', color: 'bg-orange-900/50 text-orange-300', dot: 'bg-orange-400' },
  done: { text: 'เสร็จแล้ว', color: 'bg-green-900/50 text-green-300', dot: 'bg-green-400' },
}

type FilterStatus = 'all' | 'in_progress' | 'under_review' | 'waiting_pickup' | 'done'

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    void loadTasks()
  }, [])

  async function loadTasks() {
    setLoading(true)
    setError('')
    setActionError('')
    try {
      const { data } = await dashboardApi.pendingTasks()
      const list = Array.isArray(data) ? data : []
      setTasks(list)
    } catch (err: any) {
      setTasks([])
      setError(err?.response?.data?.error?.message || 'โหลดรายการงานไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(taskId: number) {
    setActionLoading(taskId)
    setActionError('')
    setActionSuccess('')
    try {
      await taskApi.approve(taskId)
      setActionSuccess('อนุมัติงานเรียบร้อย')
      await loadTasks()
    } catch (err: any) {
      setActionError(err?.response?.data?.error?.message || 'อนุมัติงานไม่สำเร็จ')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(taskId: number) {
    if (rejectReason.length < 5) return
    setActionLoading(taskId)
    setActionError('')
    setActionSuccess('')
    try {
      await taskApi.reject(taskId, rejectReason)
      setRejectId(null)
      setRejectReason('')
      setActionSuccess('ส่งงานกลับเรียบร้อย')
      await loadTasks()
    } catch (err: any) {
      setActionError(err?.response?.data?.error?.message || 'ส่งงานกลับไม่สำเร็จ')
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const matchStatus = filter === 'all' || t.status_task === filter
      const q = search.toLowerCase()
      const matchSearch = !search
        || t.name.toLowerCase().includes(q)
        || (t.current_owner?.display_name ?? '').toLowerCase().includes(q)
        || (t.current_owner?.username ?? '').toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [tasks, filter, search])

  const counts: Record<string, number> = {
    all: tasks.length,
    in_progress: tasks.filter((t) => t.status_task === 'in_progress').length,
    under_review: tasks.filter((t) => t.status_task === 'under_review').length,
    waiting_pickup: tasks.filter((t) => t.status_task === 'waiting_pickup').length,
    done: tasks.filter((t) => t.status_task === 'done').length,
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">งานทั้งหมด</h1>
            <p className="text-xs text-slate-400 mt-0.5">{tasks.length} งานทั้งหมด</p>
          </div>
          <button
            onClick={() => void loadTasks()}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition"
            title="รีเฟรช"
            aria-label="รีเฟรช"
          >
            ↻
          </button>
        </div>

        <ManagerNav />

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ค้น</span>
          <input
            type="text"
            placeholder="ค้นหาชื่องาน หรือชื่อพนักงาน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      <div className="px-4 pt-3 pb-1 flex gap-2 overflow-x-auto">
        {([
          { key: 'all', label: 'ทั้งหมด' },
          { key: 'under_review', label: 'รอตรวจ' },
          { key: 'in_progress', label: 'กำลังทำ' },
          { key: 'waiting_pickup', label: 'รอคนรับ' },
          { key: 'done', label: 'เสร็จแล้ว' },
        ] as { key: FilterStatus; label: string }[]).map((f) => (
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
        {actionError && (
          <div className="rounded-2xl border border-red-800/70 bg-red-950/40 px-4 py-3">
            <p className="text-sm font-semibold text-red-100">ทำรายการไม่สำเร็จ</p>
            <p className="text-xs text-red-200/90 mt-1">{actionError}</p>
          </div>
        )}
        {actionSuccess && (
          <div className="rounded-2xl border border-green-800/70 bg-green-950/40 px-4 py-3">
            <p className="text-sm font-semibold text-green-100">ทำรายการสำเร็จ</p>
            <p className="text-xs text-green-200/90 mt-1">{actionSuccess}</p>
          </div>
        )}

        {loading && [1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-900 rounded-2xl p-4 animate-pulse h-28" />
        ))}

        {!loading && error && (
          <StateBox title="โหลดรายการงานไม่สำเร็จ" message={error} actionLabel="ลองใหม่" onAction={loadTasks} />
        )}

        {!loading && !error && filtered.length === 0 && (
          <StateBox
            title="ไม่พบงาน"
            message={search ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง' : 'ยังไม่มีงานในหมวดที่เลือก'}
          />
        )}

        {!loading && !error && filtered.map((task) => {
          const s = STATUS_LABEL[task.status_task]
          const isRejecting = rejectId === task.id
          const isLoading = actionLoading === task.id

          return (
            <div key={task.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
              <div className="flex items-start gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${s.dot}`} />
                <p className="text-white font-semibold text-sm leading-snug flex-1">{task.name}</p>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${s.color}`}>
                  {s.text}
                </span>
              </div>

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
                  <span className="text-xs text-slate-600">ยังไม่มีผู้รับผิดชอบ</span>
                )}
                {task.log_count > 0 && (
                  <span className="text-xs text-slate-600">• {task.log_count} logs</span>
                )}
              </div>

              {task.status_task === 'under_review' && (
                <>
                  {isRejecting ? (
                    <div className="space-y-2 ml-4">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="ระบุเหตุผลที่ส่งกลับ อย่างน้อย 5 ตัวอักษร"
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
                          onClick={() => void handleReject(task.id)}
                          disabled={rejectReason.length < 5 || isLoading}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 active:bg-red-700 transition disabled:opacity-40"
                        >
                          {isLoading ? 'กำลังส่ง...' : 'ยืนยันส่งกลับ'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setRejectId(task.id)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-300 bg-red-950/40 border border-red-800/50 active:bg-red-900/50 transition"
                      >
                        ส่งกลับ
                      </button>
                      <button
                        onClick={() => void handleApprove(task.id)}
                        disabled={isLoading}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-green-600 active:bg-green-700 transition disabled:opacity-40"
                      >
                        {isLoading ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
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

function StateBox({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
      <p className="text-white font-semibold">{title}</p>
      <p className="text-sm text-slate-400 mt-2">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
