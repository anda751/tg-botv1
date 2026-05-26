import { useEffect, useMemo, useState } from 'react';
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
      const [summaryRes, staffRes] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.staffOverview(),
      ]);
      setSummary(summaryRes.data);
      setStaff(Array.isArray(staffRes.data) ? staffRes.data : []);
    } catch (err) {
      setSummary(null);
      setStaff([]);
      setError(extractMessage(err, 'โหลดรายงานไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }

  const sortedStaff = useMemo(
    () => [...staff].sort((a, b) => b.active_tasks - a.active_tasks),
    [staff],
  );

  const doneRate = summary?.tasks.total
    ? Math.round((summary.tasks.done / summary.tasks.total) * 100)
    : 0;

  const activeLoad = summary
    ? summary.tasks.in_progress + summary.tasks.under_review + summary.tasks.waiting_pickup
    : 0;

  const focusItems = buildFocusItems(summary);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">รายงาน</h1>
            <p className="text-sm text-slate-400 mt-1">สรุปภาพรวมทีมแบบอ่านง่ายและเห็นจุดที่ต้องตามต่อ</p>
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

      <div className="flex-1 px-4 py-5 space-y-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-slate-900 rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <StateBox title="โหลดรายงานไม่สำเร็จ" message={error} actionLabel="ลองใหม่" onAction={loadData} />
        ) : summary ? (
          <>
            <section className="grid grid-cols-2 gap-3">
              <SummaryCard
                title="งานทั้งหมด"
                value={summary.tasks.total}
                hint={`${activeLoad} งานยังอยู่ระหว่างดำเนินการ`}
                tone="blue"
              />
              <SummaryCard
                title="งานเสร็จแล้ว"
                value={summary.tasks.done}
                hint={`คิดเป็น ${doneRate}% ของงานทั้งหมด`}
                tone="green"
              />
              <SummaryCard
                title="รอหัวหน้าตรวจ"
                value={summary.tasks.under_review}
                hint={summary.tasks.under_review > 0 ? 'มีงานที่ควรเปิดตรวจต่อ' : 'ไม่มีงานค้างตรวจ'}
                tone={summary.tasks.under_review > 0 ? 'amber' : 'slate'}
                alert={summary.tasks.under_review > 0}
              />
              <SummaryCard
                title="โปรเจกต์เกินกำหนด"
                value={summary.projects.overdue}
                hint={summary.projects.overdue > 0 ? 'ควรเร่งติดตามเดดไลน์' : 'ยังไม่มีโปรเจกต์เกินกำหนด'}
                tone={summary.projects.overdue > 0 ? 'red' : 'slate'}
                alert={summary.projects.overdue > 0}
              />
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">สิ่งที่ควรดูต่อ</p>
                  <h2 className="text-base font-semibold text-white mt-2">ภาพรวมตอนนี้</h2>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-bold text-green-300">{doneRate}%</p>
                  <p className="text-xs text-slate-500 mt-1">อัตรางานเสร็จ</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {focusItems.map((item) => (
                  <FocusItem key={item.text} tone={item.tone} text={item.text} />
                ))}
              </div>
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">สถานะงาน</p>
                  <h2 className="text-base font-semibold text-white mt-2">งานตอนนี้อยู่ช่วงไหนบ้าง</h2>
                </div>
                <p className="text-sm text-slate-500">{summary.tasks.total} งานทั้งหมด</p>
              </div>

              {summary.tasks.total === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีงานในระบบตอนนี้</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex rounded-full overflow-hidden h-3 bg-slate-800">
                    <ProgressBar value={summary.tasks.done} total={summary.tasks.total} color="bg-green-500" />
                    <ProgressBar value={summary.tasks.in_progress} total={summary.tasks.total} color="bg-blue-500" />
                    <ProgressBar value={summary.tasks.under_review} total={summary.tasks.total} color="bg-amber-400" />
                    <ProgressBar value={summary.tasks.waiting_pickup} total={summary.tasks.total} color="bg-orange-400" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <StatusStat label="กำลังทำ" value={summary.tasks.in_progress} tone="blue" />
                    <StatusStat label="รอตรวจ" value={summary.tasks.under_review} tone="amber" />
                    <StatusStat label="รอรับช่วงต่อ" value={summary.tasks.waiting_pickup} tone="orange" />
                    <StatusStat label="เสร็จแล้ว" value={summary.tasks.done} tone="green" />
                  </div>
                </div>
              )}
            </section>

            <section className="grid grid-cols-3 gap-3">
              <MiniStat label="พนักงานทั้งหมด" value={summary.staff.total} color="text-slate-100" />
              <MiniStat label="โปรเจกต์ทั้งหมด" value={summary.projects.total} color="text-slate-100" />
              <MiniStat label="โปรเจกต์ที่ยังเปิดอยู่" value={summary.projects.active} color="text-green-300" />
            </section>

            <section className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">ภาระงานทีม</p>
                <h2 className="text-base font-semibold text-white mt-2">ใครกำลังรับงานมากที่สุด</h2>
                <p className="text-sm text-slate-500 mt-1">ใช้ดูการกระจายงานคร่าว ๆ ว่าตอนนี้ทีมเอนไปทางไหน</p>
              </div>

              {sortedStaff.length === 0 ? (
                <StateBox title="ยังไม่มีพนักงาน" message="เมื่อมีพนักงานในระบบ รายการภาระงานจะแสดงที่นี่" />
              ) : (
                <div className="space-y-2">
                  {sortedStaff.map((member, index) => {
                    const maxTasks = sortedStaff[0]?.active_tasks || 1;
                    const fill = member.active_tasks === 0 ? 0 : Math.max(8, Math.round((member.active_tasks / maxTasks) * 100));
                    const tone =
                      member.active_tasks >= 4 ? 'bg-red-500'
                        : member.active_tasks >= 2 ? 'bg-amber-400'
                          : member.active_tasks >= 1 ? 'bg-blue-500'
                            : 'bg-slate-700';

                    return (
                      <div key={member.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-xs font-bold text-slate-600">{index + 1}</div>
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300 shrink-0">
                            {(member.display_name || member.username)?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">{member.display_name || member.username}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {member.active_tasks === 0
                                ? 'ยังไม่มีงานที่รับผิดชอบตอนนี้'
                                : `กำลังรับผิดชอบ ${member.active_tasks} งาน`}
                            </p>
                          </div>
                          <div className={`text-xs font-bold ${
                            member.active_tasks >= 4 ? 'text-red-300'
                              : member.active_tasks >= 2 ? 'text-amber-300'
                                : member.active_tasks >= 1 ? 'text-blue-300'
                                  : 'text-slate-500'
                          }`}
                          >
                            {member.active_tasks}
                          </div>
                        </div>

                        <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full ${tone}`} style={{ width: `${fill}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function buildFocusItems(summary: Summary | null) {
  if (!summary) return [];

  const items: Array<{ text: string; tone: 'green' | 'red' | 'amber' | 'blue' }> = [];

  if (summary.projects.overdue > 0) {
    items.push({
      text: `มี ${summary.projects.overdue} โปรเจกต์เกินกำหนด ควรเช็กเดดไลน์และติดตามความคืบหน้า`,
      tone: 'red',
    });
  }

  if (summary.tasks.under_review > 0) {
    items.push({
      text: `มี ${summary.tasks.under_review} งานรอหัวหน้าตรวจ ถ้าเคลียร์ชุดนี้ได้ flow งานจะเดินต่อเร็วขึ้น`,
      tone: 'amber',
    });
  }

  if (summary.tasks.waiting_pickup > 0) {
    items.push({
      text: `มี ${summary.tasks.waiting_pickup} งานรอคนรับช่วงต่อ อาจต้องช่วยกระจายงานในทีม`,
      tone: 'blue',
    });
  }

  if (items.length === 0) {
    items.push({
      text: 'ตอนนี้ภาพรวมค่อนข้างนิ่ง ไม่มีงานค้างสำคัญที่ต้องเร่งตามต่อ',
      tone: 'green',
    });
  }

  return items;
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback;
}

function SummaryCard({
  title,
  value,
  hint,
  tone,
  alert,
}: {
  title: string
  value: number
  hint: string
  tone: 'blue' | 'green' | 'amber' | 'red' | 'slate'
  alert?: boolean
}) {
  const toneMap = {
    blue: 'border-blue-800/60 bg-blue-950/30 text-blue-300',
    green: 'border-green-800/60 bg-green-950/30 text-green-300',
    amber: 'border-amber-800/60 bg-amber-950/30 text-amber-300',
    red: 'border-red-800/60 bg-red-950/30 text-red-300',
    slate: 'border-slate-800 bg-slate-900 text-slate-200',
  } as const;

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        {alert && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse mt-1" />}
      </div>
      <p className="text-xs text-slate-400 mt-3">{hint}</p>
    </div>
  );
}

function FocusItem({
  text,
  tone,
}: {
  text: string
  tone: 'green' | 'red' | 'amber' | 'blue'
}) {
  const toneMap = {
    green: 'border-green-800/60 bg-green-950/30 text-green-200',
    red: 'border-red-800/60 bg-red-950/30 text-red-200',
    amber: 'border-amber-800/60 bg-amber-950/30 text-amber-200',
    blue: 'border-blue-800/60 bg-blue-950/30 text-blue-200',
  } as const;

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneMap[tone]}`}>
      <p className="text-sm font-medium leading-relaxed">{text}</p>
    </div>
  );
}

function StatusStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'blue' | 'amber' | 'orange' | 'green'
}) {
  const toneMap = {
    blue: 'text-blue-300 bg-blue-950/30 border-blue-900',
    amber: 'text-amber-300 bg-amber-950/30 border-amber-900',
    orange: 'text-orange-300 bg-orange-950/30 border-orange-900',
    green: 'text-green-300 bg-green-950/30 border-green-900',
  } as const;

  return (
    <div className={`rounded-xl border p-3 ${toneMap[tone]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-3">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  if (!total || !value) return null;
  const pct = Math.max(2, Math.round((value / total) * 100));
  return <div className={`${color} h-full`} style={{ width: `${pct}%` }} />;
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
