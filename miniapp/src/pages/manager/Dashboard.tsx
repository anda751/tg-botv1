import { useEffect, useState } from 'react';
import ManagerNav from '../../components/ManagerNav';
import { dashboardApi, taskApi } from '../../api';

type Summary = {
  tasks: { total: number; in_progress: number; under_review: number; waiting_pickup: number; done: number }
  projects: { total: number; active: number; overdue: number }
  staff: { total: number }
}

type ReviewTask = {
  id: number
  name: string
  current_owner: { display_name: string } | null
  latest_proof: { image_url: string | null; report_text: string; submitted_at: string } | null
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [underReview, setUnderReview] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([dashboardApi.summary(), dashboardApi.underReview()]);
      setSummary(s.data);
      setUnderReview(Array.isArray(r.data) ? r.data : []);
    } catch {
      setSummary(null);
      setUnderReview([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(taskId: number) {
    setActionLoading(taskId);
    try {
      await taskApi.approve(taskId);
      await loadAll();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(taskId: number) {
    if (rejectReason.length < 5) return;
    setActionLoading(taskId);
    try {
      await taskApi.reject(taskId, rejectReason);
      setRejectId(null);
      setRejectReason('');
      await loadAll();
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5">ภาพรวมระบบ</p>
          </div>
          <button
            onClick={loadAll}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 bg-slate-800 active:bg-slate-700 transition"
          >
            ↻
          </button>
        </div>
        <ManagerNav />
      </div>

      <div className="flex-1 px-4 py-5 space-y-6 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-slate-900 rounded-2xl p-4 h-24 animate-pulse" />
            ))}
          </div>
        ) : summary && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="งานทั้งหมด" value={summary.tasks.total} sub={`เสร็จ ${summary.tasks.done}`} color="blue" icon="📋" />
              <StatCard
                label="รอตรวจ"
                value={summary.tasks.under_review}
                sub="รอหัวหน้าตรวจ"
                color="amber"
                icon="🔍"
                alert={summary.tasks.under_review > 0}
              />
              <StatCard
                label="โปรเจคต์"
                value={summary.projects.active}
                sub={summary.projects.overdue > 0 ? `เกินกำหนด ${summary.projects.overdue}` : 'Active'}
                color={summary.projects.overdue > 0 ? 'red' : 'green'}
                icon="📁"
                alert={summary.projects.overdue > 0}
              />
              <StatCard
                label="พนักงาน"
                value={summary.staff.total}
                sub={`รอรับ ${summary.tasks.waiting_pickup} งาน`}
                color="purple"
                icon="👥"
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">สถานะงานวันนี้</p>
                <p className="text-xs text-slate-500">{summary.tasks.total} งาน</p>
              </div>
              <div className="flex rounded-full overflow-hidden h-3 gap-0.5">
                <ProgressBar value={summary.tasks.done} total={summary.tasks.total} color="bg-green-500" />
                <ProgressBar value={summary.tasks.under_review} total={summary.tasks.total} color="bg-amber-400" />
                <ProgressBar value={summary.tasks.in_progress} total={summary.tasks.total} color="bg-blue-500" />
                <ProgressBar value={summary.tasks.waiting_pickup} total={summary.tasks.total} color="bg-orange-400" />
              </div>
            </div>
          </>
        )}

        <Section title="รอตรวจงาน" badge={underReview.length} badgeColor="amber">
          {underReview.length === 0 ? (
            <p className="text-slate-500 text-sm py-2">ไม่มีงานรอตรวจ</p>
          ) : (
            <div className="space-y-3">
              {underReview.map((task) => (
                <div key={task.id} className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                  {task.latest_proof?.image_url && (
                    <img src={task.latest_proof.image_url} alt="proof" className="w-full object-cover max-h-48" />
                  )}
                  <div className="p-4">
                    <p className="text-white font-semibold text-sm leading-snug">{task.name}</p>
                    {task.current_owner && <p className="text-xs text-slate-400 mt-1">👤 {task.current_owner.display_name}</p>}

                    {task.latest_proof?.report_text && (
                      <div className="bg-slate-800 rounded-xl px-3 py-2 mt-3">
                        <p className="text-xs text-slate-300 leading-relaxed">{task.latest_proof.report_text}</p>
                      </div>
                    )}

                    {rejectId === task.id && (
                      <div className="mt-3">
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="ระบุเหตุผลที่ส่งกลับ (อย่างน้อย 5 ตัว)"
                          rows={2}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-600 outline-none focus:border-red-500 text-xs resize-none"
                        />
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      {rejectId === task.id ? (
                        <>
                          <button
                            onClick={() => {
                              setRejectId(null);
                              setRejectReason('');
                            }}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 bg-slate-800 active:bg-slate-700 transition"
                          >
                            ยกเลิก
                          </button>
                          <button
                            onClick={() => handleReject(task.id)}
                            disabled={rejectReason.length < 5 || actionLoading === task.id}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 active:bg-red-700 transition disabled:opacity-40"
                          >
                            {actionLoading === task.id ? '...' : 'ส่งกลับ'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setRejectId(task.id)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-red-300 bg-red-950/50 border border-red-800 active:bg-red-900 transition"
                          >
                            ❌ ส่งกลับ
                          </button>
                          <button
                            onClick={() => handleApprove(task.id)}
                            disabled={actionLoading === task.id}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 active:bg-green-700 transition disabled:opacity-40"
                          >
                            {actionLoading === task.id ? '...' : '✅ อนุมัติ'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon, alert }: {
  label: string
  value: number
  sub: string
  color: string
  icon: string
  alert?: boolean
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-900/40 border-blue-800/50',
    amber: 'bg-amber-900/40 border-amber-800/50',
    green: 'bg-green-900/40 border-green-800/50',
    red: 'bg-red-900/40 border-red-800/50',
    purple: 'bg-purple-900/40 border-purple-800/50',
  };
  const valueColors: Record<string, string> = {
    blue: 'text-blue-300',
    amber: 'text-amber-300',
    green: 'text-green-300',
    red: 'text-red-300',
    purple: 'text-purple-300',
  };

  return (
    <div className={`border rounded-2xl p-4 ${colors[color]}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xl">{icon}</span>
        {alert && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />}
      </div>
      <p className={`text-2xl font-bold ${valueColors[color]}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
    </div>
  );
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  if (!total || !value) return null;
  const pct = Math.max(2, Math.round((value / total) * 100));
  return <div className={`${color} h-full`} style={{ width: `${pct}%` }} />;
}

function Section({ title, badge, badgeColor, children }: {
  title: string
  badge?: number
  badgeColor?: string
  children: React.ReactNode
}) {
  const badgeColors: Record<string, string> = {
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-slate-200">{title}</h2>
        {badge !== undefined && badge > 0 && (
          <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${badgeColors[badgeColor ?? 'blue']}`}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
