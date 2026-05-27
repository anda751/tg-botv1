import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerNav from '../../components/ManagerNav'
import { dashboardApi, handoverApi, notificationApi, taskApi } from '../../api'

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

type NotificationItem = {
  id: number
  title: string
  message: string
  type?: 'task' | 'project' | 'handover' | 'general'
  link?: string
  is_read: boolean
  createdAt: string
}

type PendingHandover = {
  id: number
  reason: string
  expires_at?: string
  is_expired: boolean
  task: {
    id: number
    name: string
    project?: { id: number; name: string } | null
    current_owner?: { id: number; display_name?: string; username?: string } | null
  } | null
  requested_by?: { id: number; display_name?: string; username?: string } | null
  picked_up_by?: { id: number; display_name?: string; username?: string } | null
  createdAt: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [underReview, setUnderReview] = useState<ReviewTask[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [pendingHandover, setPendingHandover] = useState<PendingHandover[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [openingNotificationId, setOpeningNotificationId] = useState<number | null>(null)
  const [handoverActionId, setHandoverActionId] = useState<number | null>(null)

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setPageError('')
    setActionError('')
    try {
      const { data } = await dashboardApi.home()
      setSummary(data?.summary ?? null)
      setUnderReview(Array.isArray(data?.under_review) ? data.under_review : [])
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : [])
      setPendingHandover(Array.isArray(data?.pending_handover) ? data.pending_handover : [])
    } catch (err) {
      setSummary(null)
      setUnderReview([])
      setNotifications([])
      setPendingHandover([])
      setPageError(extractMessage(err, 'โหลดแดชบอร์ดไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(taskId: number) {
    setActionError('')
    setActionSuccess('')
    setActionLoading(taskId)
    try {
      await taskApi.approve(taskId)
      setActionSuccess('อนุมัติงานเรียบร้อย')
      await loadAll()
    } catch (err) {
      setActionError(extractMessage(err, 'อนุมัติงานไม่สำเร็จ'))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(taskId: number) {
    if (rejectReason.trim().length < 5) return

    setActionError('')
    setActionSuccess('')
    setActionLoading(taskId)
    try {
      await taskApi.reject(taskId, rejectReason.trim())
      setRejectId(null)
      setRejectReason('')
      setActionSuccess('ส่งงานกลับเรียบร้อย')
      await loadAll()
    } catch (err) {
      setActionError(extractMessage(err, 'ส่งงานกลับไม่สำเร็จ'))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleOpenNotification(item: NotificationItem) {
    setOpeningNotificationId(item.id)
    try {
      if (!item.is_read) {
        await notificationApi.markRead(item.id)
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === item.id ? { ...notification, is_read: true } : notification,
          ),
        )
      }

      if (item.link) navigate(item.link)
    } catch (err) {
      setActionError(extractMessage(err, 'เปิดการแจ้งเตือนไม่สำเร็จ'))
    } finally {
      setOpeningNotificationId(null)
    }
  }

  async function handleMarkAllNotificationsRead() {
    setMarkingAllRead(true)
    try {
      await notificationApi.markAllRead()
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
    } catch (err) {
      setActionError(extractMessage(err, 'อัปเดตการแจ้งเตือนไม่สำเร็จ'))
    } finally {
      setMarkingAllRead(false)
    }
  }

  async function handleApproveHandover(handoverId: number) {
    setActionError('')
    setActionSuccess('')
    setHandoverActionId(handoverId)
    try {
      await handoverApi.approve(handoverId)
      setActionSuccess('อนุมัติการรับช่วงต่องานเรียบร้อย')
      await loadAll()
    } catch (err) {
      setActionError(extractMessage(err, 'อนุมัติการรับช่วงต่องานไม่สำเร็จ'))
    } finally {
      setHandoverActionId(null)
    }
  }

  async function handleRejectHandover(handoverId: number) {
    const reason = window.prompt('เหตุผลที่ยังไม่อนุมัติการรับช่วงต่อ (ไม่บังคับ)') || ''
    setActionError('')
    setActionSuccess('')
    setHandoverActionId(handoverId)
    try {
      await handoverApi.reject(handoverId, reason.trim())
      setActionSuccess('ปฏิเสธคำขอรับช่วงต่องานเรียบร้อย')
      await loadAll()
    } catch (err) {
      setActionError(extractMessage(err, 'ปฏิเสธคำขอรับช่วงต่องานไม่สำเร็จ'))
    } finally {
      setHandoverActionId(null)
    }
  }

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  )

  const urgentItems = pendingHandover.length + (summary?.tasks.under_review ?? 0)

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">แดชบอร์ด</h1>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              เริ่มจากงานรอตรวจและคำขอรับช่วงต่อก่อน แล้วค่อยไล่ดูการแจ้งเตือนและภาพรวมระบบ
            </p>
          </div>
          <button
            onClick={() => void loadAll()}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition"
            title="รีเฟรช"
            aria-label="รีเฟรช"
          >
            ↻
          </button>
        </div>
        <ManagerNav />
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto pb-8 page-enter">
        {actionError && <NoticeBox tone="red" title="ทำรายการไม่สำเร็จ" message={actionError} />}
        {actionSuccess && <NoticeBox tone="blue" title="ทำรายการสำเร็จ" message={actionSuccess} />}

        {loading ? (
          <>
            <div className="grid grid-cols-2 gap-3 content-fade">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-slate-900 rounded-2xl p-4 h-24 animate-pulse" />
              ))}
            </div>
            <div className="bg-slate-900 rounded-2xl h-24 animate-pulse" />
            <div className="bg-slate-900 rounded-2xl h-40 animate-pulse" />
            <div className="bg-slate-900 rounded-2xl h-40 animate-pulse" />
            <div className="bg-slate-900 rounded-2xl h-40 animate-pulse" />
          </>
        ) : !summary ? (
          <ErrorState
            title="โหลดภาพรวมไม่สำเร็จ"
            message={pageError || 'ระบบยังดึงข้อมูลแดชบอร์ดไม่ได้'}
            onRetry={() => void loadAll()}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="งานทั้งหมด" value={summary.tasks.total} sub={`เสร็จแล้ว ${summary.tasks.done}`} color="blue" icon="งาน" />
              <StatCard label="รอตรวจ" value={summary.tasks.under_review} sub="ควรเปิดดูก่อน" color="amber" icon="ตรวจ" alert={summary.tasks.under_review > 0} />
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
                sub={`รอรับช่วงต่อ ${summary.tasks.waiting_pickup} งาน`}
                color="purple"
                icon="ทีม"
              />
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 panel-enter interactive-lift">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">สิ่งที่ควรดูต่อก่อน</p>
                  <p className="text-xs text-slate-400 mt-1">
                    วันนี้มี {urgentItems} รายการที่ควรตัดสินใจเร็ว โดยเฉพาะงานรอตรวจและคำขอรับช่วงต่อ
                  </p>
                </div>
                <button
                  onClick={() => navigate('/tasks')}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-100 bg-slate-800 border border-slate-700 active:bg-slate-700 transition"
                >
                  เปิดหน้าจัดการงาน
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 panel-enter interactive-lift">
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

            <Section title="คำขอรับช่วงต่องาน" badge={pendingHandover.length} badgeColor="amber">
              {pendingHandover.length === 0 ? (
                <EmptyState title="ยังไม่มีคำขอรอหัวหน้าอนุมัติ" message="เมื่อมีพนักงานขอรับช่วงต่องาน รายการจะขึ้นที่ส่วนนี้ทันที" />
              ) : (
                <div className="space-y-3">
                  {pendingHandover.map((item) => {
                    const loadingAction = handoverActionId === item.id
                    return (
                      <div key={item.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-4 panel-enter interactive-lift">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">{item.task?.name || 'งานไม่ระบุชื่อ'}</p>
                            {item.task?.project?.name && (
                              <p className="text-xs text-slate-400 mt-1">โปรเจกต์: {item.task.project.name}</p>
                            )}
                          </div>
                          {item.is_expired ? (
                            <StatusPill tone="red" text="หมดเวลาแล้ว" />
                          ) : (
                            <StatusPill tone="amber" text="รออนุมัติ" />
                          )}
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                          <p>เจ้าของเดิม: {displayName(item.task?.current_owner) || '-'}</p>
                          <p>ผู้ขอรับช่วงต่อ: {displayName(item.picked_up_by) || '-'}</p>
                          <p>ผู้ส่งต่องาน: {displayName(item.requested_by) || '-'}</p>
                          {item.expires_at && <p>หมดเวลา: {formatDateTime(item.expires_at)}</p>}
                        </div>

                        {item.reason && (
                          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">เหตุผลที่ส่งต่อ</p>
                            <p className="text-xs text-slate-200 mt-1 whitespace-pre-line">{item.reason}</p>
                          </div>
                        )}

                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => void handleRejectHandover(item.id)}
                            disabled={loadingAction || item.is_expired}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-red-300 bg-red-950/50 border border-red-800 active:bg-red-900 transition disabled:opacity-40 interactive-press"
                          >
                            {loadingAction ? 'กำลังทำรายการ...' : 'ปฏิเสธ'}
                          </button>
                          <button
                            onClick={() => void handleApproveHandover(item.id)}
                            disabled={loadingAction || item.is_expired}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 active:bg-green-700 transition disabled:opacity-40 interactive-press"
                          >
                            {loadingAction ? 'กำลังทำรายการ...' : 'อนุมัติ'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Section>

            <Section title="งานรอตรวจ" badge={underReview.length} badgeColor="amber">
              {underReview.length === 0 ? (
                <EmptyState title="ยังไม่มีงานรอตรวจ" message="เมื่องานถูกส่งเข้าตรวจ รายการจะขึ้นที่ส่วนนี้" />
              ) : (
                <div className="space-y-3">
                  {underReview.map((task) => (
                    <div key={task.id} className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden panel-enter interactive-lift">
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

                        {rejectId === task.id ? (
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="ระบุเหตุผลที่ส่งกลับ อย่างน้อย 5 ตัวอักษร"
                              rows={2}
                              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 outline-none focus:border-red-500 text-xs resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setRejectId(null)
                                  setRejectReason('')
                                }}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 bg-slate-800 active:bg-slate-700 transition"
                              >
                                ยกเลิก
                              </button>
                              <button
                                onClick={() => void handleReject(task.id)}
                                disabled={rejectReason.trim().length < 5 || actionLoading === task.id}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 active:bg-red-700 transition disabled:opacity-40"
                              >
                                {actionLoading === task.id ? 'กำลังส่ง...' : 'ส่งกลับ'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => setRejectId(task.id)}
                              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-red-300 bg-red-950/50 border border-red-800 active:bg-red-900 transition"
                            >
                              ส่งกลับ
                            </button>
                            <button
                              onClick={() => void handleApprove(task.id)}
                              disabled={actionLoading === task.id}
                              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 active:bg-green-700 transition disabled:opacity-40"
                            >
                              {actionLoading === task.id ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="การแจ้งเตือนล่าสุด" badge={unreadNotifications} badgeColor="blue">
              {notifications.length === 0 ? (
                <EmptyState title="ยังไม่มีการแจ้งเตือน" message="เมื่อมีอัปเดตสำคัญ ระบบจะแสดงที่ส่วนนี้" />
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">ติดตามอัปเดตในแอป</p>
                    <button
                      onClick={() => void handleMarkAllNotificationsRead()}
                      disabled={markingAllRead || unreadNotifications === 0}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-200 bg-blue-950/50 border border-blue-900 disabled:opacity-40"
                    >
                      {markingAllRead ? 'กำลังอัปเดต...' : 'อ่านแล้วทั้งหมด'}
                    </button>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {notifications.map((item) => {
                      const urgentHandover = item.type === 'handover'
                      return (
                        <button
                          key={item.id}
                          onClick={() => void handleOpenNotification(item)}
                          className={`w-full text-left px-4 py-3 transition ${
                            urgentHandover
                              ? 'bg-amber-950/20'
                              : item.is_read
                                ? 'bg-slate-900'
                                : 'bg-blue-950/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    urgentHandover ? 'bg-amber-400' : item.is_read ? 'bg-slate-600' : 'bg-blue-500'
                                  }`}
                                />
                                <p className={`text-sm font-semibold ${urgentHandover ? 'text-amber-100' : 'text-white'}`}>
                                  {item.title}
                                </p>
                              </div>
                              <p className={`text-xs mt-1 whitespace-pre-line ${urgentHandover ? 'text-amber-100/90' : 'text-slate-300'}`}>
                                {item.message}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[11px] text-slate-500">{formatRelativeTime(item.createdAt)}</p>
                              {openingNotificationId === item.id && <p className="text-[11px] text-blue-300 mt-1">กำลังเปิด...</p>}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
}

function displayName(user?: { display_name?: string; username?: string } | null) {
  return user?.display_name || user?.username || ''
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('th-TH')
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
  }
  const valueColors: Record<string, string> = {
    blue: 'text-blue-300',
    amber: 'text-amber-300',
    green: 'text-green-300',
    red: 'text-red-300',
    purple: 'text-purple-300',
  }

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
  )
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  if (!total || !value) return null
  const pct = Math.max(2, Math.round((value / total) * 100))
  return <div className={`${color} h-full`} style={{ width: `${pct}%` }} />
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
  }

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
  )
}

function StatusPill({ tone, text }: { tone: 'red' | 'amber'; text: string }) {
  const toneMap = {
    red: 'bg-red-950/50 text-red-300 border-red-800/60',
    amber: 'bg-amber-950/50 text-amber-300 border-amber-800/60',
  } as const

  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${toneMap[tone]}`}>{text}</span>
}

function NoticeBox({
  tone,
  title,
  message,
}: {
  tone: 'red' | 'blue'
  title: string
  message: string
}) {
  const toneClass = tone === 'red'
    ? 'border-red-800/70 bg-red-950/40 text-red-100'
    : 'border-blue-800/70 bg-blue-950/40 text-blue-100'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs mt-1 opacity-90 whitespace-pre-line">{message}</p>
    </div>
  )
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
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
      <p className="text-white font-semibold">{title}</p>
      <p className="text-sm text-slate-500 mt-2">{message}</p>
    </div>
  )
}
