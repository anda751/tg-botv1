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

const TEXT = {
  all: '\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14',
  task: '\u0e07\u0e32\u0e19',
  project: '\u0e42\u0e1b\u0e23\u0e40\u0e08\u0e01\u0e15\u0e4c',
  join: '\u0e04\u0e33\u0e02\u0e2d\u0e40\u0e02\u0e49\u0e32\u0e42\u0e1b\u0e23\u0e40\u0e08\u0e01\u0e15\u0e4c',
  success: '\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08',
  pending: '\u0e23\u0e2d\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23',
  reject: '\u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18/\u0e2a\u0e48\u0e07\u0e01\u0e25\u0e31\u0e1a',
  pageTitle: '\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e01\u0e32\u0e23\u0e17\u0e33\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23',
  pageIntro:
    '\u0e43\u0e0a\u0e49\u0e14\u0e39\u0e22\u0e49\u0e2d\u0e19\u0e2b\u0e25\u0e31\u0e07\u0e27\u0e48\u0e32\u0e43\u0e04\u0e23\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34 \u0e2a\u0e48\u0e07\u0e01\u0e25\u0e31\u0e1a \u0e2a\u0e48\u0e07\u0e15\u0e48\u0e2d \u0e1b\u0e34\u0e14\u0e42\u0e1b\u0e23\u0e40\u0e08\u0e01\u0e15\u0e4c \u0e2b\u0e23\u0e37\u0e2d\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23\u0e04\u0e33\u0e02\u0e2d\u0e2a\u0e33\u0e04\u0e31\u0e0d\u0e2d\u0e30\u0e44\u0e23\u0e44\u0e1b\u0e1a\u0e49\u0e32\u0e07',
  refresh: '\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a',
  totalItems: '\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14',
  followUp: '\u0e22\u0e31\u0e07\u0e04\u0e27\u0e23\u0e15\u0e32\u0e21\u0e15\u0e48\u0e2d',
  searchAndRange: '\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e41\u0e25\u0e30\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e0a\u0e48\u0e27\u0e07\u0e40\u0e27\u0e25\u0e32',
  searchAndRangeHelp:
    '\u0e0a\u0e48\u0e27\u0e22\u0e43\u0e2b\u0e49\u0e2b\u0e31\u0e27\u0e2b\u0e19\u0e49\u0e32\u0e21\u0e2d\u0e07\u0e22\u0e49\u0e2d\u0e19\u0e40\u0e09\u0e1e\u0e32\u0e30\u0e40\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e44\u0e14\u0e49\u0e40\u0e23\u0e47\u0e27\u0e02\u0e36\u0e49\u0e19',
  clearFilter: '\u0e25\u0e49\u0e32\u0e07\u0e15\u0e31\u0e27\u0e01\u0e23\u0e2d\u0e07',
  day: '\u0e27\u0e31\u0e19',
  search: '\u0e04\u0e49\u0e19',
  searchPlaceholder:
    '\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e0a\u0e37\u0e48\u0e2d\u0e07\u0e32\u0e19 \u0e42\u0e1b\u0e23\u0e40\u0e08\u0e01\u0e15\u0e4c \u0e2b\u0e23\u0e37\u0e2d\u0e0a\u0e37\u0e48\u0e2d\u0e04\u0e19',
  showingNow: '\u0e15\u0e2d\u0e19\u0e19\u0e35\u0e49\u0e01\u0e33\u0e25\u0e31\u0e07\u0e41\u0e2a\u0e14\u0e07',
  items: '\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23',
  inCategory: '\u0e43\u0e19\u0e2b\u0e21\u0e27\u0e14',
  loadFailed: '\u0e42\u0e2b\u0e25\u0e14\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08',
  emptyTitle: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e43\u0e19\u0e0a\u0e48\u0e27\u0e07\u0e19\u0e35\u0e49',
  emptyMessage:
    '\u0e25\u0e2d\u0e07\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e0a\u0e48\u0e27\u0e07\u0e40\u0e27\u0e25\u0e32 \u0e04\u0e33\u0e04\u0e49\u0e19\u0e2b\u0e32 \u0e2b\u0e23\u0e37\u0e2d\u0e2b\u0e21\u0e27\u0e14\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e14\u0e39',
  by: '\u0e42\u0e14\u0e22',
  actor: '\u0e1c\u0e39\u0e49\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23',
  relatedUser: '\u0e1c\u0e39\u0e49\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e02\u0e49\u0e2d\u0e07',
  note: '\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38',
  retry: '\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48',
  minutesAgo: '\u0e19\u0e32\u0e17\u0e35\u0e17\u0e35\u0e48\u0e41\u0e25\u0e49\u0e27',
  hoursAgo: '\u0e0a\u0e31\u0e48\u0e27\u0e42\u0e21\u0e07\u0e17\u0e35\u0e48\u0e41\u0e25\u0e49\u0e27',
  daysAgo: '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e41\u0e25\u0e49\u0e27',
} as const

const CATEGORY_OPTIONS: { key: 'all' | HistoryCategory | HistoryTone; label: string }[] = [
  { key: 'all', label: TEXT.all },
  { key: 'task', label: TEXT.task },
  { key: 'project', label: TEXT.project },
  { key: 'project_join', label: TEXT.join },
  { key: 'green', label: TEXT.success },
  { key: 'amber', label: TEXT.pending },
  { key: 'red', label: TEXT.reject },
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
          TEXT.loadFailed,
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

  const activeFilterLabel = CATEGORY_OPTIONS.find((option) => option.key === filter)?.label || TEXT.all

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">{TEXT.pageTitle}</h1>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{TEXT.pageIntro}</p>
          </div>
          <button
            onClick={() => void loadHistory(days)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition"
            title={TEXT.refresh}
            aria-label={TEXT.refresh}
          >
            ↻
          </button>
        </div>

        <ManagerNav />
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 pb-8 page-enter">
        <div className="grid grid-cols-2 gap-3 content-fade">
          <SummaryCard title={TEXT.totalItems} value={counts.all} tone="blue" />
          <SummaryCard
            title={TEXT.followUp}
            value={counts.red + counts.amber}
            tone={counts.red + counts.amber > 0 ? 'amber' : 'green'}
          />
        </div>

        <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 panel-enter interactive-lift">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{TEXT.searchAndRange}</p>
              <p className="text-xs text-slate-400 mt-1">{TEXT.searchAndRangeHelp}</p>
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
                {TEXT.clearFilter}
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
                {option} {TEXT.day}
              </button>
            ))}
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{TEXT.search}</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={TEXT.searchPlaceholder}
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
              {TEXT.showingNow} <span className="font-semibold text-white">{filteredItems.length}</span> {TEXT.items} {TEXT.inCategory}{' '}
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
          <StateBox title={TEXT.loadFailed} message={error} actionLabel={TEXT.retry} onAction={() => void loadHistory(days)} />
        ) : filteredItems.length === 0 ? (
          <StateBox title={TEXT.emptyTitle} message={TEXT.emptyMessage} />
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
    item.category === 'task' ? TEXT.task : item.category === 'project' ? TEXT.project : TEXT.join

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
              {item.actor && <span>{TEXT.by} {item.actor}</span>}
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
              <DetailBox label={TEXT.actor} value={item.actor} />
              <DetailBox label={TEXT.relatedUser} value={item.subject_user || '-'} />
              <DetailBox label={TEXT.task} value={item.task?.name || '-'} />
              <DetailBox label={TEXT.project} value={item.project?.name || '-'} />
            </div>

            {item.detail ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{TEXT.note}</p>
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
  if (diffMinutes < 60) return `${diffMinutes} ${TEXT.minutesAgo}`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} ${TEXT.hoursAgo}`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} ${TEXT.daysAgo}`

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
