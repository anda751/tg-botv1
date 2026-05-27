import { useEffect, useMemo, useState } from 'react'
import ManagerNav from '../../components/ManagerNav'
import { dashboardApi } from '../../api'

type HistoryTone = 'green' | 'blue' | 'amber' | 'red'
type HistoryCategory = 'task' | 'project_join' | 'project'

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

const CATEGORY_OPTIONS: { key: 'all' | HistoryCategory | HistoryTone; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'task', label: 'ฝั่งงาน' },
  { key: 'project', label: 'โปรเจกต์' },
  { key: 'project_join', label: 'คำขอเข้าโปรเจกต์' },
  { key: 'green', label: 'สำเร็จ' },
  { key: 'amber', label: 'รอจัดการ' },
  { key: 'red', label: 'ปฏิเสธ/ส่งกลับ' },
]

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
      setOpenItemId((current) => (nextData.items.some((item) => item.id === current) ? current : null))
    } catch (requestError: any) {
      setData(null)
      setOpenItemId(null)
      setError(
        requestError?.response?.data?.error?.message ||
          requestError?.response?.data?.message ||
          'โหลดประวัติการทำรายการไม่สำเร็จ',
      )
    } finally {
      setLoading(false)
    }
  }

  const items = data?.items ?? []

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchFilter = filter === 'all' || item.category === filter || item.tone === filter
      const matchSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.actor.toLowerCase().includes(query) ||
        item.subject_user.toLowerCase().includes(query) ||
        (item.task?.name ?? '').toLowerCase().includes(query) ||
        (item.project?.name ?? '').toLowerCase().includes(query)
      return matchFilter && matchSearch
    })
  }, [filter, items, search])

  const counts = useMemo(
    () => ({
      all: items.length,
      task: items.filter((item) => item.category === 'task').length,
      project: items.filter((item) => item.category === 'project').length,
      project_join: items.filter((item) => item.category === 'project_join').length,
      green: items.filter((item) => item.tone === 'green').length,
      amber: items.filter((item) => item.tone === 'amber').length,
      red: items.filter((item) => item.tone === 'red').length,
    }),
    [items],
  )

  const activeFilterLabel = CATEGORY_OPTIONS.find((option) => option.key === filter)?.label || 'ทั้งหมด'

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">ประวัติการทำรายการ</h1>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              ใช้ดูย้อนหลังว่าใครอนุมัติ ส่งกลับ ส่งต่อ ปิดโปรเจกต์ หรือจัดการคำขอสำคัญอะไรไปบ้าง
            </p>
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
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 pb-8 page-enter">
        <div className="grid grid-cols-2 gap-3 content-fade">
          <SummaryCard title="รายการทั้งหมด" value={counts.all} tone="blue" />
          <SummaryCard
            title="ยังควรตามต่อ"
            value={counts.red + counts.amber}
            tone={counts.red + counts.amber > 0 ? 'amber' : 'green'}
          />
        </div>

        <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 panel-enter interactive-lift">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">ค้นหาและเลือกช่วงเวลา</p>
              <p className="text-xs text-slate-400 mt-1">ช่วยให้หัวหน้ามองย้อนหลังเฉพาะเรื่องที่ต้องการได้เร็วขึ้น</p>
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

          <div className="flex gap-2 overflow-x-auto pb-1">
            {DAY_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setDays(option)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                  days === option ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 active:bg-slate-700'
                }`}
              >
                {option} วัน
              </button>
            ))}
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ค้น</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาชื่องาน โปรเจกต์ หรือชื่อคน"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setFilter(option.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                  filter === option.key
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5">
            <p className="text-xs text-slate-300">
              ตอนนี้กำลังแสดง <span className="font-semibold text-white">{filteredItems.length}</span> รายการ ในหมวด{' '}
              <span className="font-semibold text-white">{activeFilterLabel}</span>
            </p>
          </div>
        </section>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((index) => (
              <div key={index} className="bg-slate-900 rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <StateBox title="โหลดประวัติไม่สำเร็จ" message={error} actionLabel="ลองใหม่" onAction={() => void loadHistory(days)} />
        ) : filteredItems.length === 0 ? (
          <StateBox title="ยังไม่มีประวัติในช่วงนี้" message="ลองเปลี่ยนช่วงเวลา คำค้นหา หรือตัวกรอง" />
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <AnimatedHistoryRow
                key={item.id}
                item={item}
                expanded={openItemId === item.id}
                onToggle={() => setOpenItemId((current) => (current === item.id ? null : item.id))}
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
    <div className={`rounded-2xl border p-4 panel-enter interactive-lift ${toneMap[tone]}`}>
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

  const categoryLabel =
    item.category === 'task' ? 'งาน' : item.category === 'project' ? 'โปรเจกต์' : 'คำขอเข้าโปรเจกต์'

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden panel-enter interactive-lift">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full p-4 text-left active:bg-slate-800/60 transition interactive-press"
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
            <div className="flex items-center gap-2 flex-wrap mt-2 text-xs text-slate-500">
              <span>{formatRelativeTime(item.occurred_at)}</span>
              {item.actor && <span>โดย {item.actor}</span>}
            </div>
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

function AnimatedHistoryRow({
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

  const categoryLabel =
    item.category === 'task' ? 'à¸‡à¸²à¸™' : item.category === 'project' ? 'à¹‚à¸›à¸£à¹€à¸ˆà¸à¸•à¹Œ' : 'à¸„à¸³à¸‚à¸­à¹€à¸‚à¹‰à¸²à¹‚à¸›à¸£à¹€à¸ˆà¸à¸•à¹Œ'

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden panel-enter interactive-lift">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full p-4 text-left active:bg-slate-800/60 transition interactive-press"
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
            <div className="flex items-center gap-2 flex-wrap mt-2 text-xs text-slate-500">
              <span>{formatRelativeTime(item.occurred_at)}</span>
              {item.actor && <span>à¹‚à¸”à¸¢ {item.actor}</span>}
            </div>
          </div>
          <span className={`accordion-chevron ${expanded ? 'open text-blue-300' : 'text-slate-300'} w-8 h-8 rounded-full border border-slate-700 bg-slate-950 flex items-center justify-center text-sm font-bold shrink-0`}>
            ⌄
          </span>
        </div>
      </button>

      <div className={`accordion-shell ${expanded ? 'open' : ''}`}>
        <div className="accordion-inner">
          <div className="border-t border-slate-800 px-4 py-4 space-y-3 slide-down-enter">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailBox label="à¸œà¸¹à¹‰à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£" value={item.actor} />
              <DetailBox label="à¸œà¸¹à¹‰à¹€à¸à¸µà¹ˆà¸¢à¸§à¸‚à¹‰à¸­à¸‡" value={item.subject_user || '-'} />
              <DetailBox label="à¸‡à¸²à¸™" value={item.task?.name || '-'} />
              <DetailBox label="à¹‚à¸›à¸£à¹€à¸ˆà¸à¸•à¹Œ" value={item.project?.name || '-'} />
            </div>

            {item.detail ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸</p>
                <p className="text-sm text-slate-300 mt-2 whitespace-pre-line">{item.detail}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
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
