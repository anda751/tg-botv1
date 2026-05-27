import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ManagerNav from '../../components/ManagerNav'
import { dashboardApi, taskApi } from '../../api'

type Task = {
  id: number
  name: string
  status_task: 'in_progress' | 'under_review' | 'waiting_pickup' | 'done'
  current_owner: { id: number; display_name?: string; username?: string } | null
  created_at: string
  log_count: number
}

type FilterStatus = 'all' | 'in_progress' | 'under_review' | 'waiting_pickup' | 'done'

const STATUS_LABEL: Record<FilterStatus | string, { text: string; color: string; dot: string }> = {
  all: { text: 'ทั้งหมด', color: 'bg-slate-800 text-slate-200', dot: 'bg-slate-400' },
  in_progress: { text: 'กำลังทำ', color: 'bg-blue-900/50 text-blue-300', dot: 'bg-blue-400' },
  under_review: { text: 'รอตรวจ', color: 'bg-amber-900/50 text-amber-300', dot: 'bg-amber-400' },
  waiting_pickup: { text: 'รอรับช่วงต่อ', color: 'bg-orange-900/50 text-orange-300', dot: 'bg-orange-400' },
  done: { text: 'เสร็จแล้ว', color: 'bg-green-900/50 text-green-300', dot: 'bg-green-400' },
}

const FILTER_OPTIONS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'under_review', label: 'รอตรวจ' },
  { key: 'in_progress', label: 'กำลังทำ' },
  { key: 'waiting_pickup', label: 'รอรับช่วงต่อ' },
  { key: 'done', label: 'เสร็จแล้ว' },
]

export default function Tasks() {
  const location = useLocation()
  const navigate = useNavigate()
  const highlightedTaskRef = useRef<HTMLDivElement | null>(null)

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

  const selectedTaskId = Number(new URLSearchParams(location.search).get('task') || '')
  const selectedStatus = new URLSearchParams(location.search).get('status') as FilterStatus | null
  const fromProjectId = Number(new URLSearchParams(location.search).get('fromProject') || '')
  const fromProjectName = decodeURIComponent(new URLSearchParams(location.search).get('projectName') || '')

  useEffect(() => {
    if (selectedStatus && ['in_progress', 'under_review', 'waiting_pickup', 'done'].includes(selectedStatus)) {
      setFilter(selectedStatus)
    }
  }, [selectedStatus])

  useEffect(() => {
    void loadTasks()
  }, [])

  useEffect(() => {
    if (!loading && selectedTaskId && highlightedTaskRef.current) {
      highlightedTaskRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [loading, selectedTaskId, filter])

  async function loadTasks() {
    setLoading(true)
    setError('')
    setActionError('')
    try {
      const { data } = await dashboardApi.pendingTasks()
      setTasks(Array.isArray(data) ? data : [])
    } catch (requestError: any) {
      setTasks([])
      setError(requestError?.response?.data?.error?.message || 'โหลดรายการงานไม่สำเร็จ')
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
    } catch (requestError: any) {
      setActionError(requestError?.response?.data?.error?.message || 'อนุมัติงานไม่สำเร็จ')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(taskId: number) {
    if (rejectReason.trim().length < 5) return

    setActionLoading(taskId)
    setActionError('')
    setActionSuccess('')
    try {
      await taskApi.reject(taskId, rejectReason.trim())
      setRejectId(null)
      setRejectReason('')
      setActionSuccess('ส่งงานกลับเรียบร้อย')
      await loadTasks()
    } catch (requestError: any) {
      setActionError(requestError?.response?.data?.error?.message || 'ส่งงานกลับไม่สำเร็จ')
    } finally {
      setActionLoading(null)
    }
  }

  function clearSelectedTask() {
    navigate('/tasks', { replace: true })
  }

  function goBackToProject() {
    if (Number.isFinite(fromProjectId) && fromProjectId > 0) {
      const highlight = Number.isFinite(selectedTaskId) && selectedTaskId > 0 ? `&highlightTask=${selectedTaskId}` : ''
      navigate(`/projects?open=${fromProjectId}${highlight}`)
      return
    }
    navigate('/projects')
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return tasks.filter((task) => {
      const matchStatus = filter === 'all' || task.status_task === filter
      const matchSearch =
        !query ||
        task.name.toLowerCase().includes(query) ||
        (task.current_owner?.display_name ?? '').toLowerCase().includes(query) ||
        (task.current_owner?.username ?? '').toLowerCase().includes(query)

      return matchStatus && matchSearch
    })
  }, [filter, search, tasks])

  const counts: Record<FilterStatus, number> = {
    all: tasks.length,
    in_progress: tasks.filter((task) => task.status_task === 'in_progress').length,
    under_review: tasks.filter((task) => task.status_task === 'under_review').length,
    waiting_pickup: tasks.filter((task) => task.status_task === 'waiting_pickup').length,
    done: tasks.filter((task) => task.status_task === 'done').length,
  }

  const selectedTaskVisible = filtered.some((task) => task.id === selectedTaskId)
  const activeFilterLabel = FILTER_OPTIONS.find((item) => item.key === filter)?.label || 'ทั้งหมด'

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">งานทั้งหมด</h1>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              ใช้หน้านี้สำหรับอนุมัติ ส่งกลับ และตามงานตามสถานะต่าง ๆ โดยเริ่มจากงานรอตรวจก่อน
            </p>
          </div>
          <button
            onClick={() => void loadTasks()}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition shrink-0"
            title="รีเฟรช"
            aria-label="รีเฟรช"
          >
            ↻
          </button>
        </div>

        <ManagerNav />
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 pb-8">
        {selectedTaskId > 0 && (
          <div className="rounded-2xl border border-blue-800/70 bg-blue-950/40 px-4 py-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-100">เปิดมาจากหน้าโปรเจกต์</p>
              <p className="text-xs text-blue-200/90 mt-1">
                {selectedTaskVisible
                  ? 'เราเลื่อนมาที่งานชิ้นนี้ให้แล้ว คุณจัดการงานนี้ต่อได้ทันที'
                  : 'งานที่เลือกอาจอยู่นอกตัวกรองปัจจุบัน ลองสลับสถานะหรือล้างคำค้นหา'}
              </p>
              {fromProjectName && <p className="text-xs text-blue-300 mt-2">โปรเจกต์ต้นทาง: {fromProjectName}</p>}
            </div>
            <div className="shrink-0 flex flex-col gap-2">
              <button
                onClick={goBackToProject}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-100 bg-slate-800 border border-slate-700 active:bg-slate-700 transition"
              >
                กลับไปที่โปรเจกต์
              </button>
              <button
                onClick={clearSelectedTask}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 active:bg-blue-700 transition"
              >
                ล้างการเลือก
              </button>
            </div>
          </div>
        )}

        {actionError && <InlineNotice tone="red" title="ทำรายการไม่สำเร็จ" message={actionError} />}
        {actionSuccess && <InlineNotice tone="green" title="ทำรายการสำเร็จ" message={actionSuccess} />}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {FILTER_OPTIONS.map((item) => (
            <StatCard key={item.key} label={item.label} value={String(counts[item.key])} active={filter === item.key} />
          ))}
        </div>

        <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">ค้นหาและกรองงาน</p>
              <p className="text-xs text-slate-400 mt-1">ลดรายการให้เหลือเฉพาะงานที่ต้องดูตอนนี้ จะได้ตัดสินใจง่ายขึ้น</p>
            </div>
            {(search || filter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setFilter('all')
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 active:bg-slate-700 transition"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ค้น</span>
            <input
              type="text"
              placeholder="ค้นหาชื่องาน หรือชื่อพนักงาน"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500 text-sm"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTER_OPTIONS.map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                  filter === item.key
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {item.label}
                <span className={`ml-1.5 ${filter === item.key ? 'text-blue-100' : 'text-slate-500'}`}>
                  {counts[item.key]}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5">
            <p className="text-xs text-slate-300">
              ตอนนี้กำลังแสดง <span className="font-semibold text-white">{filtered.length}</span> งาน ในหมวด{' '}
              <span className="font-semibold text-white">{activeFilterLabel}</span>
            </p>
          </div>
        </section>

        {loading &&
          [1, 2, 3, 4].map((index) => <div key={index} className="bg-slate-900 rounded-2xl p-4 animate-pulse h-32" />)}

        {!loading && error && (
          <StateBox title="โหลดรายการงานไม่สำเร็จ" message={error} actionLabel="ลองใหม่" onAction={loadTasks} />
        )}

        {!loading && !error && filtered.length === 0 && (
          <StateBox
            title="ไม่พบงาน"
            message={search ? 'ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองแล้วดูอีกครั้ง' : 'ยังไม่มีงานในหมวดที่เลือก'}
          />
        )}

        {!loading &&
          !error &&
          filtered.map((task) => {
            const status = STATUS_LABEL[task.status_task]
            const isRejecting = rejectId === task.id
            const isLoading = actionLoading === task.id
            const isHighlighted = task.id === selectedTaskId

            return (
              <div
                key={task.id}
                ref={isHighlighted ? highlightedTaskRef : null}
                className={`bg-slate-900 border rounded-2xl p-4 transition ${
                  isHighlighted ? 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.4)]' : 'border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${status.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm leading-snug">{task.name}</p>
                      {isHighlighted && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950/60 text-blue-200 border border-blue-800/70">
                          งานที่เลือกมา
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${status.color}`}>
                        {status.text}
                      </span>
                      <span className="text-[11px] text-slate-500">สร้างเมื่อ {formatDateTime(task.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="ml-4 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.current_owner ? (
                      <>
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                          {(task.current_owner.display_name || task.current_owner.username)?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs text-slate-300">
                          ผู้รับผิดชอบ: {task.current_owner.display_name || task.current_owner.username}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">ยังไม่มีผู้รับผิดชอบ</span>
                    )}

                    <span className="text-xs text-slate-500">บันทึกความเคลื่อนไหว {task.log_count} ครั้ง</span>
                  </div>

                  {task.status_task === 'under_review' ? (
                    isRejecting ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          value={rejectReason}
                          onChange={(event) => setRejectReason(event.target.value)}
                          placeholder="ระบุเหตุผลที่ส่งกลับ อย่างน้อย 5 ตัวอักษร"
                          rows={2}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-600 outline-none focus:border-red-500 text-xs resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setRejectId(null)
                              setRejectReason('')
                            }}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 active:bg-slate-700 transition"
                          >
                            ยกเลิก
                          </button>
                          <button
                            onClick={() => void handleReject(task.id)}
                            disabled={rejectReason.trim().length < 5 || isLoading}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 active:bg-red-700 transition disabled:opacity-40"
                          >
                            {isLoading ? 'กำลังส่ง...' : 'ยืนยันส่งกลับ'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
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
                    )
                  ) : (
                    <p className="text-xs text-slate-500 pt-1">งานนี้ยังไม่อยู่ในขั้นรอตรวจ จึงยังไม่มีปุ่มตัดสินใจในหน้านี้</p>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}

function StatCard({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={`border rounded-xl px-3 py-2.5 ${active ? 'bg-blue-950/30 border-blue-800/60' : 'bg-slate-900 border-slate-700'}`}>
      <p className={`text-[11px] ${active ? 'text-blue-200' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-lg font-bold leading-tight ${active ? 'text-white' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function InlineNotice({
  tone,
  title,
  message,
}: {
  tone: 'red' | 'green'
  title: string
  message: string
}) {
  const toneClass =
    tone === 'green'
      ? 'border-green-800/70 bg-green-950/40 text-green-100'
      : 'border-red-800/70 bg-red-950/40 text-red-100'

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs mt-1 opacity-90">{message}</p>
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('th-TH')
}
