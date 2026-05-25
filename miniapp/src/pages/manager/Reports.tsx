import { useEffect, useState } from 'react';
import ManagerNav from '../../components/ManagerNav';
import { dashboardApi } from '../../api';

type StaffStat = {
  id: number
  display_name: string
  username: string
  telegram_id: string
  active_tasks: number
}

type Summary = {
  tasks: { total: number; in_progress: number; under_review: number; waiting_pickup: number; done: number }
  projects: { total: number; active: number; overdue: number }
  staff: { total: number }
}

export default function Reports() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [staff, setStaff] = useState<StaffStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [s, st] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.staffOverview(),
      ]);
      setSummary(s.data);
      setStaff(Array.isArray(st.data) ? st.data : []);
    } catch (err) {
      setSummary(null);
      setStaff([]);
      setError(extractMessage(err, 'โหลดรายงานไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }

  const doneRate = summary
    ? summary.tasks.total > 0
      ? Math.round((summary.tasks.done / summary.tasks.total) * 100)
      : 0
    : 0;

  const sortedStaff = [...staff].sort((a, b) => b.active_tasks - a.active_tasks);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">รายงาน</h1>
            <p className="text-xs text-slate-400 mt-0.5">สรุปภาพรวมทีม</p>
          </div>
          <button
            onClick={loadData}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition"
            title="รีเฟรช"
            aria-label="รีเฟรช"
          >
            ↻
          </button>
        </div>

        <ManagerNav />
      </div>

      <div className="flex-1 px-4 py-5 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-900 rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <StateBox title="โหลดรายงานไม่สำเร็จ" message={error} actionLabel="ลองใหม่" onAction={loadData} />
        ) : summary ? (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">อัตราความสำเร็จ</p>
              <div className="flex items-center gap-5">
                <div className="relative w-24 h-24 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="3"
                      strokeDasharray={`${doneRate} ${100 - doneRate}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">{doneRate}%</span>
                  </div>
                </div>

                <div className="space-y-2 flex-1">
                  <StatRow label="เสร็จแล้ว" value={summary.tasks.done} color="text-green-400" />
                  <StatRow label="กำลังทำ" value={summary.tasks.in_progress} color="text-blue-400" />
                  <StatRow label="รอตรวจ" value={summary.tasks.under_review} color="text-amber-400" />
                  <StatRow label="รอคนรับ" value={summary.tasks.waiting_pickup} color="text-orange-400" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">โปรเจกต์</p>
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="ทั้งหมด" value={summary.projects.total} color="text-slate-200" />
                <MiniStat label="กำลังดำเนินการ" value={summary.projects.active} color="text-green-400" />
                <MiniStat
                  label="เกินกำหนด"
                  value={summary.projects.overdue}
                  color={summary.projects.overdue > 0 ? 'text-red-400' : 'text-slate-500'}
                  alert={summary.projects.overdue > 0}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">ภาระงานพนักงาน</p>
              {sortedStaff.length === 0 ? (
                <StateBox title="ยังไม่มีพนักงาน" message="เมื่อมีพนักงานในระบบ สรุปภาระงานจะแสดงที่นี่" />
              ) : (
                <div className="space-y-2">
                  {sortedStaff.map((s, idx) => {
                    const maxTasks = sortedStaff[0].active_tasks || 1;
                    const pct = Math.round((s.active_tasks / maxTasks) * 100);
                    const barColor =
                      s.active_tasks === 0 ? 'bg-slate-700'
                        : pct >= 80 ? 'bg-red-500'
                          : pct >= 50 ? 'bg-amber-500'
                            : 'bg-blue-500';

                    return (
                      <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-bold text-slate-600 w-4">{idx + 1}</span>
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                            {(s.display_name || s.username)?.[0]?.toUpperCase()}
                          </div>
                          <p className="text-white text-sm font-medium flex-1 truncate">
                            {s.display_name || s.username}
                          </p>
                          <span className={`text-xs font-bold ${
                            s.active_tasks === 0 ? 'text-slate-600'
                              : s.active_tasks >= 3 ? 'text-red-400'
                                : 'text-slate-300'
                          }`}
                          >
                            {s.active_tasks} งาน
                          </span>
                        </div>
                        <div className="ml-7 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${s.active_tasks === 0 ? 0 : Math.max(4, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">สรุปสถานะ</p>
              {summary.projects.overdue > 0 && (
                <InsightCard
                  text={`มี ${summary.projects.overdue} โปรเจกต์เกินกำหนดแล้ว`}
                  color="border-red-800/50 bg-red-950/30"
                  textColor="text-red-300"
                />
              )}
              {summary.tasks.waiting_pickup > 0 && (
                <InsightCard
                  text={`${summary.tasks.waiting_pickup} งานรอคนรับอยู่`}
                  color="border-orange-800/50 bg-orange-950/30"
                  textColor="text-orange-300"
                />
              )}
              {summary.tasks.under_review > 0 && (
                <InsightCard
                  text={`${summary.tasks.under_review} งานรอหัวหน้าตรวจ`}
                  color="border-amber-800/50 bg-amber-950/30"
                  textColor="text-amber-300"
                />
              )}
              {summary.projects.overdue === 0 && summary.tasks.waiting_pickup === 0 && summary.tasks.under_review === 0 && (
                <InsightCard
                  text="ทุกอย่างเรียบร้อย ไม่มีงานค้าง"
                  color="border-green-800/50 bg-green-950/30"
                  textColor="text-green-300"
                />
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback;
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, color, alert }: { label: string; value: number; color: string; alert?: boolean }) {
  return (
    <div className="bg-slate-800 rounded-xl p-3 text-center relative">
      {alert && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function InsightCard({ text, color, textColor }: {
  text: string; color: string; textColor: string
}) {
  return (
    <div className={`border rounded-xl px-4 py-3 flex items-center gap-3 ${color}`}>
      <p className={`text-sm font-medium ${textColor}`}>{text}</p>
    </div>
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
