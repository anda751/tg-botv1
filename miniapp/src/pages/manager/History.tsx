import { useEffect, useMemo, useState } from 'react'
import ManagerNav from '../../components/ManagerNav'
import { dashboardApi } from '../../api'

type HistoryTone = 'green' | 'blue' | 'amber' | 'red'
type HistoryCategory = 'task' | 'project_join'

type HistoryItem = {
  id: string
  category: HistoryCategory
  action: string
  tone: HistoryTone
  occurred_at: string
  title: string
  summary: string
  detail: string
  actor: string
  subject_user: string
  task: { id: number; name: string; status_task: string } | null
  project: { id: number; name: string } | null
}

type HistoryResponse = {
  window_days: number
  generated_at: string
  total: number
  items: HistoryItem[]
}

const DAY_OPTIONS = [7, 14, 30, 60]

export default function History() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | HistoryCategory | HistoryTone>('all')
  const [openItemId, setOpenItemId] = useState<string | null>(null)

  useEffect(() => {
    void loadHistory(days)
  }, [days])

  async function loadHistory(rangeDays = days) {
    setLoading(true)
    setError('')
    try {
      const response = await dashboardApi.history(rangeDays)
      const nextData = response.data as HistoryResponse
      setData(nextData)
      setOpenItemId((current) => nextData.items.some((item) => item.id === current) ? current : null)
    } catch (err: any) {
      setData(null)
      setOpenItemId(null)
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'โหลดประวัติการทำรายการไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  const items = data?.items ?? []

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchFilter = filter === 'all' || item.category === filter || item.tone === filter
      const matchSearch = !q
        || item.title.toLowerCase().includes(q)
        || item.summary.toLowerCase().includes(q)
        || item.actor.toLowerCase().includes(q)
        || item.subject_user.toLowerCase().includes(q)
        || (item.task?.name ?? '').toLowerCase().includes(q)
        || (item.project?.name ?? '').toLowerCase().includes(q)
      return matchFilter && matchSearch
    })
  }, [filter, items, search])

  const counts = useMemo(() => ({
    all: items.length,
    task: items.filter((item) => item.category === 'task').length,
    project_join: items.filter((item) => item.category === 'project_join').length,
    green: items.filter((item) => item.tone === 'green').length,
    amber: items.filter((item) => item.tone === 'amber').length,
    red: items.filter((item) => item.tone === 'red').length,
  }), [items])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">ประวัติการทำรายการ</h1>
            <p className="text-sm text-slate-400 mt-1">ดูย้อนหลังว่าใครอนุมัติ ส่งกลับ ส่งต่อ หรือจัดการคำขอสำคัญอะไรไปบ้าง</p>
          </div>
          <button
            onClick={() => void loadHistory(days)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition"
            title="รีเฟรช"
            aria-label="รีเฟรช"
          >
            ↻
          </button>
        </div>

        <ManagerNav />

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {DAY_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setDays(option)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                days === option
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 active:bg-slate-700'
              }`}
            >
              {option} วัน
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard title="ทั้งหมด" value={counts.all} tone="blue" />
          <SummaryCard title="ต้องตามต่อ" value={counts.red + counts.amber} tone={counts.red + counts.amber > 0 ? 'amber' : 'green'} />
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่องาน โปรเจกต์ หรือชื่อคน"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm"
          />

          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'all', label: 'ทั้งหมด' },
              { key: 'task', label: 'ฝั่งงาน' },
              { key: 'project_join', label: 'คำขอเข้าโปรเจกต์' },
              { key: 'green', label: 'สำเร็จ' },
              { key: 'amber', label: 'ส่งต่อ/รอจัดการ' },
              { key: 'red', label: 'ตีกลับ/ปฏิเสธ' },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setFilter(option.key as typeof filter)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                  filter === option.key
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-slate-900 rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <StateBox title="โหลดประวัติไม่สำเร็จ" message={error} actionLabel="ลองใหม่" onAction={() => void loadHistory(days)} />
        ) : filteredItems.length === 0 ? (
          <StateBox title="ยังไม่มีประวัติในช่วงนี้" message="ลองเปลี่ยนช่วงเวลา คำค้นหา หรือตัวกรอง" />
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                expanded={openItemId === item.id}
                onToggle={() => setOpenItemId((current) => current === item.id ? null : item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ title, value, tone }: { title: string; value: number; tone: HistoryTone }) {
  const toneMap: Record<HistoryTone, string> = {
    green: 'border-green-800/60 bg-green-950/30 text-green-300',
    blue: 'border-blue-800/60 bg-blue-950/30 text-blue-300',
    amber: 'border-amber-800/60 bg-amber-950/30 text-amber-300',
    red: 'border-red-800/60 bg-red-950/30 text-red-300',
  }

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  )
}

function HistoryRow({
  item,
  expanded,
  onToggle,
}: {
  item: HistoryItem
  expanded: boolean
  onToggle: () => void
}) {
  const toneMap: Record<HistoryTone, string> = {
    green: 'text-green-200 bg-green-950/20 border-green-800/60',
    blue: 'text-blue-200 bg-blue-950/20 border-blue-800/60',
    amber: 'text-amber-200 bg-amber-950/20 border-amber-800/60',
    red: 'text-red-200 bg-red-950/20 border-red-800/60',
  }

  const categoryLabel = item.category === 'task' ? 'งาน' : 'คำขอเข้าโปรเจกต์'

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full p-4 text-left active:bg-slate-800/60 transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${toneMap[item.tone]}`}>
                {item.title}
              </span>
              <span className="text-xs text-slate-500">{categoryLabel}</span>
            </div>
            <p className="text-sm text-white font-semibold mt-2 leading-relaxed">{item.summary}</p>
            <p className="text-xs text-slate-500 mt-2">{formatRelativeTime(item.occurred_at)}</p>
          </div>
          <span className="w-8 h-8 rounded-full border border-slate-700 bg-slate-950 text-slate-300 flex items-center justify-center text-sm font-bold shrink-0">
            {expanded ? '−' : '+'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-800 px-4 py-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailBox label="ผู้ดำเนินการ" value={item.actor} />
            <DetailBox label="ผู้เกี่ยวข้อง" value={item.subject_user || '-'} />
            <DetailBox label="งาน" value={item.task?.name || '-'} />
            <DetailBox label="โปรเจกต์" value={item.project?.name || '-'} />
          </div>

          {item.detail ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">หมายเหตุ</p>
              <p className="text-sm text-slate-300 mt-2 whitespace-pre-line">{item.detail}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-sm text-white mt-2">{value}</p>
    </div>
  )
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000))
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`

  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
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
