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
  const [pageError, setPageError] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setPageError('');
    setReviewError('');
    setActionError('');

    const [summaryRes, reviewRes] = await Promise.allSettled([
      dashboardApi.summary(),
      dashboardApi.underReview(),
    ]);

    if (summaryRes.status === 'fulfilled') {
      setSummary(summaryRes.value.data);
    } else {
      setSummary(null);
      setPageError(extractMessage(summaryRes.reason, 'โหลดข้อมูลภาพรวมไม่สำเร็จ'));
    }

    if (reviewRes.status === 'fulfilled') {
      setUnderReview(Array.isArray(reviewRes.value.data) ? reviewRes.value.data : []);
    } else {
      setUnderReview([]);
      setReviewError(extractMessage(reviewRes.reason, 'โหลดรายการงานรอตรวจไม่สำเร็จ'));
    }

    setLoading(false);
  }

  async function handleApprove(taskId: number) {
    setActionError('');
    setActionSuccess('');
    setActionLoading(taskId);
    try {
      await taskApi.approve(taskId);
      setActionSuccess('อนุมัติงานเรียบร้อย');
      await loadAll();
    } catch (err) {
      setActionError(extractMessage(err, 'อนุมัติงานไม่สำเร็จ'));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(taskId: number) {
    if (rejectReason.length < 5) return;
    setActionError('');
    setActionSuccess('');
    setActionLoading(taskId);
    try {
      await taskApi.reject(taskId, rejectReason);
      setRejectId(null);
      setRejectReason('');
      setActionSuccess('ส่งงานกลับเรียบร้อย');
      await loadAll();
    } catch (err) {
      setActionError(extractMessage(err, 'ส่งงานกลับไม่สำเร็จ'));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">แดชบอร์ด</h1>
            <p className="text-xs text-slate-400 mt-0.5">ภาพรวมระบบและงานรอตรวจ</p>
          </div>
          <button
            onClick={loadAll}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition"
            title="รีเฟรช"
            aria-label="รีเฟรช"
          >
            ↻
          </button>
        </div>
        <ManagerNav />
      </div>

      <div className="flex-1 px-4 py-5 space-y-6 overflow-y-auto">
        {actionError && (
          <NoticeBox tone="red" title="ทำรายการไม่สำเร็จ" message={actionError} />
        )}
        {actionSuccess && (
          <NoticeBox tone="blue" title="ทำรายการสำเร็จ" message={actionSuccess} />
        )}

        {loading ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-slate-900 rounded-2xl p-4 h-24 animate-pulse" />
              ))}
            </div>
            <div className="bg-slate-900 rounded-2xl h-40 animate-pulse" />
          </>
        ) : summary ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="งานทั้งหมด" value={summary.tasks.total} sub={`เสร็จแล้ว ${summary.tasks.done}`} color="blue" icon="งาน" />
              <StatCard
                label="รอตรวจ"
                value={summary.tasks.under_review}
                sub="รอหัวหน้าตรวจ"
                color="amber"
                icon="ตรวจ"
                alert={summary.tasks.under_review > 0}
              />
              <StatCard
                label="โปรเจกต์"
                value={summary.projects.active}
                sub={summary.projects.overdue > 0 ? `เกินกำหนด ${summary.projects.overdue}` : 'กำลังดำเนินการ'}
                color={summary.projects.overdue > 0 ? 'red' : 'green'}
                icon="โปรเจกต์"
                alert={summary.projects.overdue > 0}
              />
              <StatCard
                label="พนักงาน"
                value={summary.staff.total}
                sub={`รอรับต่อ ${summary.tasks.waiting_pickup} งาน`}
                color="purple"
                icon="ทีม"
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">สถานะงานวันนี้</p>
                <p className="text-xs text-slate-500">{summary.tasks.total} งาน</p>
              </div>
              {summary.tasks.total === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีงานในระบบตอนนี้</p>
              ) : (
                <div className="flex rounded-full overflow-hidden h-3 gap-0.5">
                  <ProgressBar value={summary.tasks.done} total={summary.tasks.total} color="bg-green-500" />
                  <ProgressBar value={summary.tasks.under_review} total={summary.tasks.total} color="bg-amber-400" />
                  <ProgressBar value={summary.tasks.in_progress} total={summary.tasks.total} color="bg-blue-500" />
                  <ProgressBar value={summary.tasks.waiting_pickup} total={summary.tasks.total} color="bg-orange-400" />
                </div>
              )}
            </div>
          </>
        ) : (
          <ErrorState
            title="โหลดภาพรวมไม่สำเร็จ"
            message={pageError || 'ระบบยังดึงข้อมูลแดชบอร์ดไม่ได้'}
            onRetry={loadAll}
          />
        )}

        <Section title="งานรอตรวจ" badge={underReview.length} badgeColor="amber">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-slate-900 rounded-2xl h-36 animate-pulse" />
              ))}
            </div>
          ) : reviewError ? (
            <NoticeBox tone="red" title="โหลดรายการงานรอตรวจไม่สำเร็จ" message={reviewError} actionLabel="ลองใหม่" onAction={loadAll} />
          ) : underReview.length === 0 ? (
            <EmptyState title="ยังไม่มีงานรอตรวจ" message="เมื่องานถูกส่งเข้าตรวจ รายการจะแสดงที่นี่" />
          ) : (
            <div className="space-y-3">
              {underReview.map((task) => (
                <div key={task.id} className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                  {task.latest_proof?.image_url && (
                    <img src={task.latest_proof.image_url} alt="proof" className="w-full object-cover max-h-48" />
                  )}
                  <div className="p-4">
                    <p className="text-white font-semibold text-sm leading-snug">{task.name}</p>
                    {task.current_owner && <p className="text-xs text-slate-400 mt-1">ผู้ส่ง: {task.current_owner.display_name}</p>}

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
                          placeholder="ระบุเหตุผลที่ส่งกลับ อย่างน้อย 5 ตัวอักษร"
                          rows={2}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 outline-none focus:border-red-500 text-xs resize-none"
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
                            {actionLoading === task.id ? 'กำลังส่ง...' : 'ส่งกลับ'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setRejectId(task.id)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-red-300 bg-red-950/50 border border-red-800 active:bg-red-900 transition"
                          >
                            ส่งกลับ
                          </button>
                          <button
                            onClick={() => handleApprove(task.id)}
                            disabled={actionLoading === task.id}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 active:bg-green-700 transition disabled:opacity-40"
                          >
                            {actionLoading === task.id ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
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

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback;
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
        <span className="text-xs font-semibold text-slate-300">{icon}</span>
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

function NoticeBox({
  tone,
  title,
  message,
  actionLabel,
  onAction,
}: {
  tone: 'red' | 'blue'
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  const toneClass = tone === 'red'
    ? 'border-red-800/70 bg-red-950/40 text-red-100'
    : 'border-blue-800/70 bg-blue-950/40 text-blue-100';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs mt-1 opacity-90">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-3 px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 active:bg-white/20 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
      <p className="text-white font-semibold">{title}</p>
      <p className="text-sm text-slate-400 mt-2">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 transition"
      >
        ลองใหม่
      </button>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
      <p className="text-white font-semibold">{title}</p>
      <p className="text-sm text-slate-500 mt-2">{message}</p>
    </div>
  );
}
