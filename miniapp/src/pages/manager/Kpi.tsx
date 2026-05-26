import { useEffect, useMemo, useState } from 'react';
import ManagerNav from '../../components/ManagerNav';
import { dashboardApi } from '../../api';

type Tone = 'green' | 'blue' | 'amber' | 'red';

type KpiGuide = {
  window_label: string
  weights: Array<{ key: string; label: string; weight: number; formula: string }>
  thresholds: Record<string, string[]>
}

type StaffKpi = {
  id: number
  display_name: string
  username: string
  telegram_id: string
  tasks_total: number
  completed_tasks: number
  review_cycles: number
  rejected_cycles: number
  rejection_rate: number
  active_tasks: number
  active_in_progress: number
  active_under_review: number
  active_waiting_pickup: number
  active_updated_recently: number
  stale_active_tasks: number
  progress_updates: number
  on_time_completed: number
  deadline_tracked_completed: number
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

const DAY_OPTIONS = [14, 30, 60];

export default function Kpi() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadKpi(days);
  }, [days]);

  async function loadKpi(rangeDays = days) {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardApi.staffKpi(rangeDays);
      setData(response.data);
    } catch (err) {
      setData(null);
      setError(extractMessage(err, 'โหลด KPI รายคนไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }

  const topPerformer = data?.staff[0] ?? null;
  const watchCount = useMemo(
    () => data?.staff.filter((member) => member.status.tone === 'amber' || member.status.tone === 'red').length ?? 0,
    [data],
  );
  const averageScore = useMemo(() => {
    if (!data?.staff.length) return 0;
    return Math.round(data.staff.reduce((sum, member) => sum + member.total_score, 0) / data.staff.length);
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">KPI รายคน</h1>
            <p className="text-sm text-slate-400 mt-1">ดูผลงานรายคนด้วยสูตรเดียวกันทั้งทีม และเห็นชัดว่าควรตามใครต่อ</p>
          </div>
          <button
            onClick={() => loadKpi(days)}
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
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-slate-900 rounded-2xl h-32 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <StateBox title="โหลด KPI ไม่สำเร็จ" message={error} actionLabel="ลองใหม่" onAction={() => loadKpi(days)} />
        ) : data ? (
          <>
            <section className="grid grid-cols-3 gap-3">
              <SummaryCard
                title="ค่าเฉลี่ยทีม"
                value={`${averageScore}`}
                hint={`คะแนนเฉลี่ย ${data.formula_guide.window_label}`}
                tone="blue"
              />
              <SummaryCard
                title="ต้องติดตาม"
                value={`${watchCount}`}
                hint="คนที่อยู่ในสถานะเฝ้าดูหรือเร่งติดตาม"
                tone={watchCount > 0 ? 'amber' : 'green'}
              />
              <SummaryCard
                title="ผลงานเด่นสุด"
                value={topPerformer ? `${topPerformer.total_score}` : '-'}
                hint={topPerformer ? topPerformer.display_name : 'ยังไม่มีข้อมูลพอ'}
                tone="green"
              />
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">กฎการคิดคะแนน</p>
              <h2 className="text-base font-semibold text-white mt-2">สูตรที่ใช้จริงตอนนี้</h2>
              <p className="text-sm text-slate-500 mt-1">ระบบคำนวณจากข้อมูลย้อนหลัง {data.window_days} วัน โดยใช้ threshold เดียวกันทั้งทีม</p>

              <div className="mt-4 grid gap-3">
                {data.formula_guide.weights.map((rule) => (
                  <div key={rule.key} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{rule.label}</p>
                        <p className="text-sm text-slate-400 mt-1">{rule.formula}</p>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-slate-800 text-slate-200 text-xs font-bold">
                        {rule.weight}%
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(data.formula_guide.thresholds[rule.key] ?? []).map((line) => (
                        <span key={line} className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs">
                          {line}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-semibold text-white">เกณฑ์สรุปภาพรวม</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.formula_guide.thresholds.total.map((line) => (
                      <span key={line} className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs">
                        {line}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">คะแนนรายคน</p>
                <h2 className="text-base font-semibold text-white mt-2">เรียงจากคนที่คะแนนรวมสูงสุด</h2>
                <p className="text-sm text-slate-500 mt-1">ดูคะแนนรวมก่อน แล้วค่อยไล่ดูสาเหตุจากอัตราตีกลับ ตรงเวลา และความสม่ำเสมอในการอัปเดต</p>
              </div>

              {data.staff.length === 0 ? (
                <StateBox title="ยังไม่มีข้อมูลพนักงาน" message="เมื่อมีพนักงานและงานในระบบ รายการ KPI จะขึ้นที่หน้านี้" />
              ) : (
                <div className="space-y-3">
                  {data.staff.map((member, index) => (
                    <StaffKpiCard key={member.id} member={member} rank={index + 1} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback;
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
  } as const;

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <p className="text-xs text-slate-400 mt-3">{hint}</p>
    </div>
  );
}

function StaffKpiCard({ member, rank }: { member: StaffKpi; rank: number }) {
  const toneMap = {
    green: 'border-green-800/60 bg-green-950/20 text-green-200',
    blue: 'border-blue-800/60 bg-blue-950/20 text-blue-200',
    amber: 'border-amber-800/60 bg-amber-950/20 text-amber-200',
    red: 'border-red-800/60 bg-red-950/20 text-red-200',
  } as const;

  return (
    <div className={`rounded-2xl border p-5 ${toneMap[member.status.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-slate-900/70 text-slate-200 text-xs font-bold flex items-center justify-center shrink-0">
              {rank}
            </span>
            <h3 className="text-base font-semibold text-white truncate">{member.display_name}</h3>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${toneMap[member.status.tone]}`}>
              {member.status.label}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">@{member.username}</p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-3xl font-bold text-white">{member.total_score}</p>
          <p className="text-xs text-slate-400 mt-1">คะแนนรวม</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricBox label="งานเสร็จ" value={`${member.completed_tasks}/${member.output_target}`} hint="เทียบกับเป้าช่วงนี้" tone="blue" />
        <MetricBox label="ตีกลับ" value={member.review_cycles > 0 ? `${member.rejection_rate}%` : '-'} hint={`${member.rejected_cycles}/${member.review_cycles} รอบ`} tone={member.rejection_rate > 20 ? 'red' : 'green'} />
        <MetricBox label="ตรงเวลา" value={member.on_time_rate !== null ? `${member.on_time_rate}%` : '-'} hint={`${member.on_time_completed}/${member.deadline_tracked_completed} งานมี deadline`} tone={member.on_time_rate !== null && member.on_time_rate < 75 ? 'amber' : 'green'} />
        <MetricBox label="ปิดงานเฉลี่ย" value={member.avg_completion_hours !== null ? `${member.avg_completion_hours} ชม.` : '-'} hint="นับจากสร้างงานถึงอนุมัติ" tone={member.avg_completion_hours !== null && member.avg_completion_hours > 168 ? 'amber' : 'blue'} />
        <MetricBox label="อัปเดตงาน active" value={`${member.update_rate}%`} hint={`${member.active_updated_recently}/${member.active_tasks || 0} งาน`} tone={member.update_rate < 75 ? 'amber' : 'blue'} />
        <MetricBox label="งานค้างนิ่ง" value={`${member.stale_active_tasks}`} hint={`จากงาน active ${member.active_tasks} งาน`} tone={member.stale_active_tasks > 0 ? 'red' : 'green'} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">คะแนนย่อย</p>
          <div className="flex gap-2 text-xs">
            <ScoreChip label="Output" value={member.output_score} />
            <ScoreChip label="Quality" value={member.quality_score} />
            <ScoreChip label="Time" value={member.on_time_score} />
            <ScoreChip label="Speed" value={member.speed_score} />
            <ScoreChip label="Update" value={member.update_score} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <MiniStat label="กำลังทำ" value={member.active_in_progress} />
          <MiniStat label="รอตรวจ" value={member.active_under_review} />
          <MiniStat label="รอรับต่อ" value={member.active_waiting_pickup} />
        </div>

        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">ข้อสังเกตสำหรับหัวหน้า</p>
          <p className="text-sm text-slate-200 mt-2 leading-relaxed">{member.focus_note}</p>
        </div>
      </div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: Tone
}) {
  const toneMap = {
    green: 'border-green-800/60 bg-green-950/20 text-green-200',
    blue: 'border-blue-800/60 bg-blue-950/20 text-blue-200',
    amber: 'border-amber-800/60 bg-amber-950/20 text-amber-200',
    red: 'border-red-800/60 bg-red-950/20 text-red-200',
  } as const;

  return (
    <div className={`rounded-xl border p-3 ${toneMap[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-xl font-bold mt-2 text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-2">{hint}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-200 font-semibold">
      {label} {value}
    </span>
  );
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
  );
}
