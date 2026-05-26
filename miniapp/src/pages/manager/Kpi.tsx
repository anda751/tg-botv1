import { useEffect, useMemo, useState } from 'react'
import ManagerNav from '../../components/ManagerNav'
import { dashboardApi } from '../../api'

type Tone = 'green' | 'blue' | 'amber' | 'red'

type KpiGuide = {
  window_label: string
  weights: Array<{ key: string; label: string; weight: number; formula: string }>
  thresholds: Record<string, string[]>
}

type StaffKpi = {
  id: number
  display_name: string
  username: string
  completed_tasks: number
  rejection_rate: number
  active_tasks: number
  active_in_progress: number
  active_under_review: number
  active_waiting_pickup: number
  stale_active_tasks: number
  on_time_rate: number | null
  avg_completion_hours: number | null
  update_rate: number
  output_target: number
  output_score: number
  quality_score: number
  on_time_score: number
  speed_score: number
  update_score: number
  total_score: number
  status: { label: string; tone: Tone }
  focus_note: string
}

type ResponseShape = {
  window_days: number
  generated_at: string
  formula_guide: KpiGuide
  staff: StaffKpi[]
}

const DAY_OPTIONS = [14, 30, 60]

export default function Kpi() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<ResponseShape | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showFormula, setShowFormula] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | Tone>('all')
  const [openMemberId, setOpenMemberId] = useState<number | null>(null)

  useEffect(() => {
    void loadKpi(days)
  }, [days])

  async function loadKpi(rangeDays = days) {
    setLoading(true)
    setError('')
    try {
      const response = await dashboardApi.staffKpi(rangeDays)
      const nextData = response.data as ResponseShape
      setData(nextData)
      setOpenMemberId((current) => nextData.staff.some((member) => member.id === current) ? current : null)
    } catch (err) {
      setData(null)
      setOpenMemberId(null)
      setError(extractMessage(err, 'โหลด KPI รายคนไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }

  const team = data?.staff ?? []

  const averageScore = useMemo(() => {
    if (!team.length) return 0
    return Math.round(team.reduce((sum, member) => sum + member.total_score, 0) / team.length)
  }, [team])

  const watchList = useMemo(
    () => team.filter((member) => member.status.tone === 'amber' || member.status.tone === 'red'),
    [team],
  )

  const topPerformer = team[0] ?? null

  const filteredStaff = useMemo(() => {
    return team.filter((member) => {
      const matchTone = filter === 'all' || member.status.tone === filter
      const q = search.trim().toLowerCase()
      const matchSearch = !q
        || member.display_name.toLowerCase().includes(q)
        || member.username.toLowerCase().includes(q)
      return matchTone && matchSearch
    })
  }, [filter, search, team])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">KPI รายคน</h1>
            <p className="text-sm text-slate-400 mt-1">ดูเร็วว่าใครเด่น ใครเริ่มเสี่ยง และควรตามใครต่อ</p>
          </div>
          <button
            onClick={() => void loadKpi(days)}
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

      <div className="flex-1 px-4 py-5 space-y-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-900 rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <StateBox title="โหลด KPI ไม่สำเร็จ" message={error} actionLabel="ลองใหม่" onAction={() => void loadKpi(days)} />
        ) : data ? (
          <>
            <section className="grid grid-cols-2 gap-3">
              <SummaryCard title="ค่าเฉลี่ยทีม" value={`${averageScore}`} hint={data.formula_guide.window_label} tone="blue" />
              <SummaryCard
                title="ต้องติดตาม"
                value={`${watchList.length}`}
                hint="สถานะเฝ้าดูหรือเร่งติดตาม"
                tone={watchList.length > 0 ? 'amber' : 'green'}
              />
              <SummaryCard
                title="คะแนนสูงสุด"
                value={topPerformer ? `${topPerformer.total_score}` : '-'}
                hint={topPerformer ? topPerformer.display_name : 'ยังไม่มีข้อมูลพอ'}
                tone="green"
              />
              <SummaryCard
                title="คนมีงานค้างนิ่ง"
                value={`${team.filter((member) => member.stale_active_tasks > 0).length}`}
                hint="มีงาน active ที่ไม่ค่อยขยับ"
                tone={team.some((member) => member.stale_active_tasks > 0) ? 'red' : 'blue'}
              />
            </section>

            {watchList.length > 0 && (
              <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">ต้องตามก่อน</p>
                    <h2 className="text-base font-semibold text-white mt-1">คนที่ควรเปิดคุยก่อน</h2>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-950/40 text-amber-200 text-xs font-bold border border-amber-800/60">
                    {watchList.length} คน
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {watchList.slice(0, 3).map((member) => (
                    <div key={member.id} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{member.display_name}</p>
                          <p className="text-xs text-slate-500 mt-1">{member.focus_note}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-white">{member.total_score}</p>
                          <p className="text-[11px] text-slate-500">{member.status.label}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">เกณฑ์คำนวณ</p>
                  <h2 className="text-base font-semibold text-white mt-1">ดูสูตรเมื่อจำเป็น</h2>
                </div>
                <button
                  onClick={() => setShowFormula((current) => !current)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 active:bg-slate-700 transition"
                >
                  {showFormula ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                </button>
              </div>

              {showFormula && (
                <div className="mt-4 space-y-3">
                  {data.formula_guide.weights.map((rule) => (
                    <div key={rule.key} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{rule.label}</p>
                          <p className="text-sm text-slate-400 mt-1">{rule.formula}</p>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-slate-800 text-slate-200 text-xs font-bold">
                          {rule.weight}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">คะแนนรายคน</p>
                  <h2 className="text-base font-semibold text-white mt-1">กดดูรายละเอียดทีละคน เพื่อลดความรกของหน้า</h2>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ค้นหาชื่อพนักงาน"
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm"
                  />
                  <div className="flex gap-2 overflow-x-auto">
                    {(['all', 'green', 'blue', 'amber', 'red'] as const).map((tone) => (
                      <button
                        key={tone}
                        onClick={() => setFilter(tone)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
                          filter === tone ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-700 text-slate-300'
                        }`}
                      >
                        {tone === 'all'
                          ? 'ทั้งหมด'
                          : tone === 'green'
                            ? 'ดีมาก'
                            : tone === 'blue'
                              ? 'ดี'
                              : tone === 'amber'
                                ? 'เฝ้าดู'
                                : 'เร่งติดตาม'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredStaff.length === 0 ? (
                <StateBox title="ไม่พบข้อมูล" message="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
              ) : (
                <div className="space-y-3">
                  {filteredStaff.map((member, index) => (
                    <StaffKpiRow
                      key={member.id}
                      member={member}
                      rank={index + 1}
                      expanded={openMemberId === member.id}
                      onToggle={() => setOpenMemberId((current) => current === member.id ? null : member.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
}

function SummaryCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string
  value: string
  hint: string
  tone: Tone
}) {
  const toneMap = {
    green: 'border-green-800/60 bg-green-950/30 text-green-300',
    blue: 'border-blue-800/60 bg-blue-950/30 text-blue-300',
    amber: 'border-amber-800/60 bg-amber-950/30 text-amber-300',
    red: 'border-red-800/60 bg-red-950/30 text-red-300',
  } as const

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <p className="text-xs text-slate-400 mt-3">{hint}</p>
    </div>
  )
}

function StaffKpiRow({
  member,
  rank,
  expanded,
  onToggle,
}: {
  member: StaffKpi
  rank: number
  expanded: boolean
  onToggle: () => void
}) {
  const statusTone = {
    green: 'text-green-200 bg-green-950/20 border-green-800/60',
    blue: 'text-blue-200 bg-blue-950/20 border-blue-800/60',
    amber: 'text-amber-200 bg-amber-950/20 border-amber-800/60',
    red: 'text-red-200 bg-red-950/20 border-red-800/60',
  } as const

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full p-4 text-left active:bg-slate-800/60 transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center shrink-0">
              {rank}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-white truncate">{member.display_name}</h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusTone[member.status.tone]}`}>
                  {member.status.label}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">@{member.username}</p>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">{member.focus_note}</p>
            </div>
          </div>

          <div className="text-right shrink-0 flex flex-col items-end gap-2">
            <div>
              <p className="text-3xl font-bold text-white">{member.total_score}</p>
              <p className="text-xs text-slate-500 mt-1">คะแนนรวม</p>
            </div>
            <span className="w-8 h-8 rounded-full border border-slate-700 bg-slate-950 text-slate-300 flex items-center justify-center text-sm font-bold">
              {expanded ? '−' : '+'}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <MetricBox label="งานเสร็จ" value={`${member.completed_tasks}/${member.output_target}`} />
            <MetricBox label="ตีกลับ" value={member.rejection_rate > 0 ? `${member.rejection_rate}%` : '-'} />
            <MetricBox label="ตรงเวลา" value={member.on_time_rate !== null ? `${member.on_time_rate}%` : '-'} />
            <MetricBox label="อัปเดตงาน" value={`${member.update_rate}%`} />
          </div>

          <div className="grid grid-cols-5 gap-2">
            <ScoreChip label="Output" value={member.output_score} />
            <ScoreChip label="Quality" value={member.quality_score} />
            <ScoreChip label="Time" value={member.on_time_score} />
            <ScoreChip label="Speed" value={member.speed_score} />
            <ScoreChip label="Update" value={member.update_score} />
          </div>

          <div className="flex flex-wrap gap-2">
            <MiniTag label="กำลังทำ" value={member.active_in_progress} />
            <MiniTag label="รอตรวจ" value={member.active_under_review} />
            <MiniTag label="รอรับต่อ" value={member.active_waiting_pickup} />
            <MiniTag label="งานค้างนิ่ง" value={member.stale_active_tasks} alert={member.stale_active_tasks > 0} />
            <MiniTag label="ปิดงานเฉลี่ย" value={member.avg_completion_hours !== null ? `${member.avg_completion_hours} ชม.` : '-'} />
          </div>
        </div>
      )}
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-xl font-bold mt-2 text-white">{value}</p>
    </div>
  )
}

function MiniTag({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <span className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
      alert
        ? 'border-red-800/60 bg-red-950/20 text-red-200'
        : 'border-slate-800 bg-slate-950 text-slate-300'
    }`}>
      {label} {value}
    </span>
  )
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 px-2 py-2 text-center">
      <p className="text-[11px] text-slate-500 font-semibold">{label}</p>
      <p className="text-sm font-bold text-white mt-1">{value}</p>
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
