import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { notificationApi, taskApi } from '../../api'

type Task = {
  id: number
  name: string
  status_task: 'in_progress' | 'under_review' | 'waiting_pickup' | 'done'
  project?: { name: string }
  task_log?: Array<{
    id: number
    action: 'created' | 'submitted' | 'approved' | 'rejected' | 'handover' | 'picked_up' | 'progress_update'
    note?: string
  }>
}

type NotificationItem = {
  id: number
  title: string
  message: string
  type: 'task' | 'project' | 'handover' | 'general'
  link?: string
  is_read: boolean
  is_hidden?: boolean
  createdAt: string
}

type HiddenPanelState = {
  notifications: NotificationItem[]
  tasks: Task[]
}

type OpenPanel = 'under_review' | 'done' | 'hidden' | null

const statusLabel: Record<Task['status_task'], { text: string; tone: string }> = {
  in_progress: { text: 'กำลังทำ', tone: 'bg-blue-950/40 text-blue-200 border border-blue-900' },
  under_review: { text: 'รอตรวจ', tone: 'bg-amber-950/40 text-amber-200 border border-amber-900' },
  waiting_pickup: { text: 'รอรับช่วงต่อ', tone: 'bg-orange-950/40 text-orange-200 border border-orange-900' },
  done: { text: 'เสร็จแล้ว', tone: 'bg-green-950/40 text-green-200 border border-green-900' },
}

export default function MyTasks() {
  const navigate = useNavigate()
  const location = useLocation()

  const [tasks, setTasks] = useState<Task[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [hidden, setHidden] = useState<HiddenPanelState>({ notifications: [], tasks: [] })

  const [loading, setLoading] = useState(true)
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [hiddenLoading, setHiddenLoading] = useState(true)

  const [error, setError] = useState('')
  const [notificationsError, setNotificationsError] = useState('')
  const [hiddenError, setHiddenError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [hidingRead, setHidingRead] = useState(false)
  const [hidingTaskId, setHidingTaskId] = useState<number | null>(null)
  const [openingNotificationId, setOpeningNotificationId] = useState<number | null>(null)
  const [hidingNotificationId, setHidingNotificationId] = useState<number | null>(null)
  const [restoringNotificationId, setRestoringNotificationId] = useState<number | null>(null)
  const [restoringTaskId, setRestoringTaskId] = useState<number | null>(null)
  const [restoringAllNotifications, setRestoringAllNotifications] = useState(false)
  const [restoringAllTasks, setRestoringAllTasks] = useState(false)

  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [activityExpanded, setActivityExpanded] = useState(false)

  useEffect(() => {
    const message = (location.state as any)?.successMessage
    if (typeof message === 'string' && message.trim()) {
      setSuccessMessage(message)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    void loadInitialData()
  }, [])

  async function loadInitialData() {
    setLoading(true)
    setNotificationsLoading(true)
    setHiddenLoading(true)
    setError('')
    setNotificationsError('')
    setHiddenError('')

    try {
      const { data } = await taskApi.getHome()
      const payload = data?.data ?? data ?? {}

      setTasks(Array.isArray(payload.tasks) ? payload.tasks : [])
      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : [])
      setHidden({
        notifications: Array.isArray(payload.hidden_notifications) ? payload.hidden_notifications : [],
        tasks: Array.isArray(payload.hidden_tasks) ? payload.hidden_tasks : [],
      })
    } catch (err) {
      const message = extractMessage(err, 'โหลดข้อมูลงานไม่สำเร็จ')
      setTasks([])
      setNotifications([])
      setHidden({ notifications: [], tasks: [] })
      setError(message)
      setNotificationsError(message)
      setHiddenError(message)
    } finally {
      setLoading(false)
      setNotificationsLoading(false)
      setHiddenLoading(false)
    }
  }

  async function loadTasks() {
    setLoading(true)
    setError('')
    try {
      const { data } = await taskApi.getMyTasks()
      const list = Array.isArray(data) ? data : (data.data ?? [])
      setTasks(list)
    } catch (err) {
      setTasks([])
      setError(extractMessage(err, 'โหลดรายการงานไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }

  async function loadNotifications() {
    setNotificationsLoading(true)
    setNotificationsError('')
    try {
      const { data } = await notificationApi.getMy()
      const list = Array.isArray(data) ? data : (data.data ?? [])
      setNotifications(list)
    } catch (err) {
      setNotifications([])
      setNotificationsError(extractMessage(err, 'โหลดกิจกรรมล่าสุดไม่สำเร็จ'))
    } finally {
      setNotificationsLoading(false)
    }
  }

  async function loadHidden() {
    setHiddenLoading(true)
    setHiddenError('')
    try {
      const hiddenNotificationsRes = await notificationApi.getHidden()
      const hiddenTasksRes = await taskApi.getHiddenTasks()

      const hiddenNotifications = Array.isArray(hiddenNotificationsRes.data)
        ? hiddenNotificationsRes.data
        : (hiddenNotificationsRes.data.data ?? [])
      const hiddenTasks = Array.isArray(hiddenTasksRes.data)
        ? hiddenTasksRes.data
        : (hiddenTasksRes.data.data ?? [])

      setHidden({
        notifications: hiddenNotifications,
        tasks: hiddenTasks,
      })
    } catch (err) {
      setHiddenError(extractMessage(err, 'โหลดรายการที่ซ่อนไว้ไม่สำเร็จ'))
      setHidden({ notifications: [], tasks: [] })
    } finally {
      setHiddenLoading(false)
    }
  }

  async function handleMarkAllRead() {
    setMarkingAllRead(true)
    try {
      await notificationApi.markAllRead()
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })))
    } catch (err) {
      setNotificationsError(extractMessage(err, 'อัปเดตสถานะการแจ้งเตือนไม่สำเร็จ'))
    } finally {
      setMarkingAllRead(false)
    }
  }

  async function handleOpenNotification(item: NotificationItem) {
    setOpeningNotificationId(item.id)
    try {
      if (!item.is_read) {
        await notificationApi.markRead(item.id)
        setNotifications((items) =>
          items.map((current) => current.id === item.id ? { ...current, is_read: true } : current),
        )
      }

      if (item.link && item.link !== location.pathname) {
        navigate(item.link)
      }
    } catch (err) {
      setNotificationsError(extractMessage(err, 'เปิดการแจ้งเตือนไม่สำเร็จ'))
    } finally {
      setOpeningNotificationId(null)
    }
  }

  async function handleHideNotification(notificationId: number) {
    setHidingNotificationId(notificationId)
    try {
      await notificationApi.hide(notificationId)
      const hiddenItem = notifications.find((item) => item.id === notificationId)
      setNotifications((items) => items.filter((item) => item.id !== notificationId))
      if (hiddenItem) {
        setHidden((current) => ({
          ...current,
          notifications: [{ ...hiddenItem, is_hidden: true }, ...current.notifications],
        }))
      }
    } catch (err) {
      setNotificationsError(extractMessage(err, 'ซ่อนการแจ้งเตือนไม่สำเร็จ'))
    } finally {
      setHidingNotificationId(null)
    }
  }

  async function handleHideRead() {
    setHidingRead(true)
    try {
      await notificationApi.hideRead()
      const movedItems = notifications.filter((item) => item.is_read)
      setNotifications((items) => items.filter((item) => !item.is_read))
      if (movedItems.length) {
        setHidden((current) => ({
          ...current,
          notifications: [...movedItems.map((item) => ({ ...item, is_hidden: true })), ...current.notifications],
        }))
      }
    } catch (err) {
      setNotificationsError(extractMessage(err, 'ซ่อนรายการที่อ่านแล้วไม่สำเร็จ'))
    } finally {
      setHidingRead(false)
    }
  }

  async function handleHideTask(taskId: number) {
    setHidingTaskId(taskId)
    try {
      await taskApi.hide(taskId)
      const hiddenTask = tasks.find((item) => item.id === taskId)
      setTasks((items) => items.filter((item) => item.id !== taskId))
      if (hiddenTask) {
        setHidden((current) => ({
          ...current,
          tasks: [hiddenTask, ...current.tasks],
        }))
      }
    } catch (err) {
      setError(extractMessage(err, 'ซ่อนงานไม่สำเร็จ'))
    } finally {
      setHidingTaskId(null)
    }
  }

  async function handleRestoreNotification(notificationId: number) {
    setRestoringNotificationId(notificationId)
    try {
      await notificationApi.restore(notificationId)
      const restored = hidden.notifications.find((item) => item.id === notificationId)
      setHidden((current) => ({
        ...current,
        notifications: current.notifications.filter((item) => item.id !== notificationId),
      }))
      if (restored) {
        setNotifications((current) => [{ ...restored, is_hidden: false }, ...current])
      }
    } catch (err) {
      setHiddenError(extractMessage(err, 'กู้คืนการแจ้งเตือนไม่สำเร็จ'))
    } finally {
      setRestoringNotificationId(null)
    }
  }

  async function handleRestoreTask(taskId: number) {
    setRestoringTaskId(taskId)
    try {
      await taskApi.restore(taskId)
      const restored = hidden.tasks.find((item) => item.id === taskId)
      setHidden((current) => ({
        ...current,
        tasks: current.tasks.filter((item) => item.id !== taskId),
      }))
      if (restored) {
        setTasks((current) => [restored, ...current])
      }
    } catch (err) {
      setHiddenError(extractMessage(err, 'กู้คืนงานไม่สำเร็จ'))
    } finally {
      setRestoringTaskId(null)
    }
  }

  async function handleRestoreAllNotifications() {
    setRestoringAllNotifications(true)
    try {
      await notificationApi.restoreAll()
      const restoredItems = hidden.notifications
      setHidden((current) => ({ ...current, notifications: [] }))
      if (restoredItems.length) {
        setNotifications((current) => [
          ...restoredItems.map((item) => ({ ...item, is_hidden: false })),
          ...current,
        ])
      }
    } catch (err) {
      setHiddenError(extractMessage(err, 'กู้คืนกิจกรรมที่ซ่อนไว้ไม่สำเร็จ'))
    } finally {
      setRestoringAllNotifications(false)
    }
  }

  async function handleRestoreAllTasks() {
    setRestoringAllTasks(true)
    try {
      await taskApi.restoreAll()
      const restoredTasks = hidden.tasks
      setHidden((current) => ({ ...current, tasks: [] }))
      if (restoredTasks.length) {
        setTasks((current) => [...restoredTasks, ...current])
      }
    } catch (err) {
      setHiddenError(extractMessage(err, 'กู้คืนงานที่ซ่อนไว้ไม่สำเร็จ'))
    } finally {
      setRestoringAllTasks(false)
    }
  }

  const inProgressTasks = useMemo(
    () => tasks.filter((task) => task.status_task === 'in_progress'),
    [tasks],
  )

  const urgentTasks = useMemo(
    () => inProgressTasks.filter((task) => getLatestRejectedNote(task)),
    [inProgressTasks],
  )

  const normalTasks = useMemo(
    () => inProgressTasks.filter((task) => !getLatestRejectedNote(task)),
    [inProgressTasks],
  )

  const underReviewTasks = useMemo(
    () => tasks.filter((task) => task.status_task === 'under_review'),
    [tasks],
  )

  const doneTasks = useMemo(
    () => tasks.filter((task) => task.status_task === 'done'),
    [tasks],
  )

  const visibleNotifications = useMemo(
    () => (activityExpanded ? notifications : notifications.slice(0, 3)),
    [activityExpanded, notifications],
  )

  const unreadCount = notifications.filter((item) => !item.is_read).length
  const readCount = notifications.filter((item) => item.is_read).length
  const hiddenCount = hidden.notifications.length + hidden.tasks.length

  function togglePanel(panel: Exclude<OpenPanel, null>) {
    setOpenPanel((current) => current === panel ? null : panel)
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="bg-slate-900 px-4 pt-6 pb-4 border-b border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">งานของฉัน</h1>
            <p className="text-sm text-slate-400 mt-1">เปิดมาแล้วเห็นทันทีว่าตอนนี้ควรทำอะไรต่อ</p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-full text-lg font-medium bg-slate-800 text-slate-300 flex items-center justify-center active:bg-slate-700 transition"
            title="ตั้งค่าโปรไฟล์"
            aria-label="ตั้งค่าโปรไฟล์"
          >
            ⚙
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <SummaryPill label="ต้องแก้ก่อน" value={urgentTasks.length} tone="red" />
          <SummaryPill label="กำลังทำ" value={normalTasks.length} tone="blue" />
          <SummaryPill label="รอตรวจ" value={underReviewTasks.length} tone="amber" />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        {successMessage && <NoticeBox tone="green" message={successMessage} />}

        {loading ? (
          <TaskSkeleton />
        ) : error ? (
          <StateBox title="โหลดงานไม่สำเร็จ" message={error} actionLabel="ลองใหม่" onAction={loadTasks} />
        ) : (
          <>
            <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">งานที่ต้องทำตอนนี้</h2>
                  <p className="text-sm text-slate-400 mt-1">งานตีกลับจะอยู่ก่อน แล้วค่อยตามด้วยงานที่กำลังทำปกติ</p>
                </div>
                <button
                  onClick={() => navigate('/create')}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white bg-blue-600 active:bg-blue-500 transition shrink-0"
                >
                  + สร้างงาน
                </button>
              </div>

              <div className="p-4 space-y-3">
                {urgentTasks.length > 0 && (
                  <div className="space-y-3">
                    <SectionLabel title="ต้องแก้ก่อน" tone="red" />
                    {urgentTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isHiding={false}
                        onProgress={() => navigate(`/progress/${task.id}`, { state: { task } })}
                        onSubmit={() => navigate(`/submit/${task.id}`, { state: { task } })}
                        onHandover={() => navigate(`/handover/${task.id}`, { state: { task } })}
                        onHide={() => undefined}
                      />
                    ))}
                  </div>
                )}

                {normalTasks.length > 0 && (
                  <div className="space-y-3">
                    <SectionLabel title="กำลังทำ" tone="blue" />
                    {normalTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isHiding={false}
                        onProgress={() => navigate(`/progress/${task.id}`, { state: { task } })}
                        onSubmit={() => navigate(`/submit/${task.id}`, { state: { task } })}
                        onHandover={() => navigate(`/handover/${task.id}`, { state: { task } })}
                        onHide={() => undefined}
                      />
                    ))}
                  </div>
                )}

                {urgentTasks.length === 0 && normalTasks.length === 0 && (
                  <StateBox
                    title="ยังไม่มีงานที่ต้องทำตอนนี้"
                    message="เมื่องานใหม่เข้ามาหรือมีงานถูกส่งกลับ รายการจะมาแสดงตรงนี้"
                  />
                )}
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <QuickActionCard
                title="รับงานช่วงต่อ"
                subtitle="ดูว่างานไหนกำลังรอคนช่วยต่อ"
                buttonLabel="เปิดรายการ"
                tone="orange"
                onClick={() => navigate('/pickup')}
              />
              <QuickActionCard
                title="ตั้งค่าโปรไฟล์"
                subtitle="แก้ชื่อแสดงผลหรือเปลี่ยนรหัสผ่าน"
                buttonLabel="เปิดตั้งค่า"
                tone="slate"
                onClick={() => navigate('/settings')}
              />
            </section>

            <AccordionSection
              title="งานรอตรวจ"
              count={underReviewTasks.length}
              description="ดูงานที่ส่งแล้วและกำลังรอหัวหน้าตรวจ"
              open={openPanel === 'under_review'}
              onToggle={() => togglePanel('under_review')}
            >
              {underReviewTasks.length === 0 ? (
                <StateBox
                  title="ยังไม่มีงานรอตรวจ"
                  message="เมื่อส่งงานแล้ว รายการที่กำลังรอหัวหน้าตรวจจะมาแสดงในส่วนนี้"
                />
              ) : (
                <div className="space-y-3">
                  {underReviewTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isHiding={false}
                      onProgress={() => undefined}
                      onSubmit={() => undefined}
                      onHandover={() => undefined}
                      onHide={() => undefined}
                    />
                  ))}
                </div>
              )}
            </AccordionSection>

            <AccordionSection
              title="งานเสร็จแล้ว"
              count={doneTasks.length}
              description="เปิดดูงานที่ปิดแล้ว หรือซ่อนออกจากหน้าหลักเมื่อไม่ต้องดูบ่อย"
              open={openPanel === 'done'}
              onToggle={() => togglePanel('done')}
            >
              {doneTasks.length === 0 ? (
                <StateBox
                  title="ยังไม่มีงานที่เสร็จแล้ว"
                  message="เมื่องานผ่านการอนุมัติแล้ว รายการจะมาแสดงในส่วนนี้"
                />
              ) : (
                <div className="space-y-3">
                  {doneTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isHiding={hidingTaskId === task.id}
                      onProgress={() => undefined}
                      onSubmit={() => undefined}
                      onHandover={() => undefined}
                      onHide={() => handleHideTask(task.id)}
                    />
                  ))}
                </div>
              )}
            </AccordionSection>

            <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-4 py-4 border-b border-slate-800 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">กิจกรรมล่าสุด</h2>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        ยังไม่อ่าน {unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-1">อัปเดตสำคัญของงานจะอยู่ตรงนี้</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markingAllRead || unreadCount === 0}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-blue-200 bg-blue-950/50 border border-blue-900 disabled:opacity-40"
                  >
                    {markingAllRead ? 'กำลังอัปเดต...' : 'อ่านแล้วทั้งหมด'}
                  </button>
                  <button
                    onClick={handleHideRead}
                    disabled={hidingRead || readCount === 0}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800 disabled:opacity-40"
                  >
                    {hidingRead ? 'กำลังซ่อน...' : 'ซ่อนที่อ่านแล้ว'}
                  </button>
                </div>
              </div>

              <div className="p-4">
                {notificationsLoading ? (
                  <NotificationSkeleton />
                ) : notificationsError ? (
                  <StateBox
                    title="โหลดกิจกรรมล่าสุดไม่สำเร็จ"
                    message={notificationsError}
                    actionLabel="ลองใหม่"
                    onAction={loadNotifications}
                  />
                ) : notifications.length === 0 ? (
                  <StateBox
                    title="ยังไม่มีกิจกรรมล่าสุด"
                    message="เมื่อมีการอนุมัติ ส่งกลับ หรืออัปเดตสำคัญ ระบบจะแสดงไว้ที่นี่"
                  />
                ) : (
                  <div className="space-y-3">
                    {visibleNotifications.map((item) => (
                      <NotificationCard
                        key={item.id}
                        item={item}
                        isOpening={openingNotificationId === item.id}
                        isHiding={hidingNotificationId === item.id}
                        onOpen={() => handleOpenNotification(item)}
                        onHide={() => handleHideNotification(item.id)}
                      />
                    ))}

                    {notifications.length > 3 && (
                      <button
                        onClick={() => setActivityExpanded((current) => !current)}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800 active:bg-slate-700 transition"
                      >
                        {activityExpanded ? 'ย่อกิจกรรมล่าสุด' : `ดูกิจกรรมทั้งหมด (${notifications.length})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>

            <AccordionSection
              title="รายการที่ซ่อนไว้"
              count={hiddenCount}
              description="ซ่อนออกจากหน้าหลักได้ แต่ข้อมูลยังไม่หาย"
              open={openPanel === 'hidden'}
              onToggle={() => togglePanel('hidden')}
            >
              {hiddenLoading ? (
                <div className="text-sm text-slate-500 py-1">กำลังโหลดรายการที่ซ่อนไว้...</div>
              ) : hiddenError ? (
                <StateBox title="โหลดรายการที่ซ่อนไว้ไม่สำเร็จ" message={hiddenError} actionLabel="ลองใหม่" onAction={loadHidden} />
              ) : hiddenCount === 0 ? (
                <StateBox title="ยังไม่มีรายการที่ซ่อนไว้" message="เมื่อซ่อนกิจกรรมหรืองาน รายการจะมาอยู่ที่ส่วนนี้" />
              ) : (
                <div className="space-y-4">
                  {hidden.notifications.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">กิจกรรมล่าสุด</p>
                        <button
                          onClick={handleRestoreAllNotifications}
                          disabled={restoringAllNotifications}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-200 bg-blue-950/50 border border-blue-900 disabled:opacity-40"
                        >
                          {restoringAllNotifications ? 'กำลังกู้คืนทั้งหมด...' : 'กู้คืนทั้งหมด'}
                        </button>
                      </div>
                      {hidden.notifications.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${
                            isUrgentProjectNotification(item)
                              ? 'border-red-900/60 bg-red-950/20'
                              : isApprovedNotification(item)
                                ? 'border-green-900/60 bg-green-950/20'
                                : 'border-slate-800 bg-slate-950'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className={`font-semibold ${
                              isUrgentProjectNotification(item)
                                ? 'text-red-100 text-[15px]'
                                : isApprovedNotification(item)
                                  ? 'text-blue-100 text-[15px]'
                                  : 'text-slate-100'
                            }`}>{getNotificationDisplayTitle(item)}</p>
                            <div className="mt-1">
                              {renderNotificationMessage(
                                item.message,
                                isUrgentProjectNotification(item)
                                  ? 'urgent'
                                  : isApprovedNotification(item)
                                    ? 'approved'
                                    : 'default',
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRestoreNotification(item.id)}
                            disabled={restoringNotificationId === item.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-200 bg-blue-950/50 border border-blue-900 disabled:opacity-40"
                          >
                            {restoringNotificationId === item.id ? 'กำลังกู้คืน...' : 'กู้คืน'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {hidden.tasks.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">งานเสร็จแล้ว</p>
                        <button
                          onClick={handleRestoreAllTasks}
                          disabled={restoringAllTasks}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-200 bg-blue-950/50 border border-blue-900 disabled:opacity-40"
                        >
                          {restoringAllTasks ? 'กำลังกู้คืนทั้งหมด...' : 'กู้คืนทั้งหมด'}
                        </button>
                      </div>
                      {hidden.tasks.map((task) => (
                        <div key={task.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-100">{task.name}</p>
                            {task.project && <p className="text-xs text-slate-400 mt-1">โปรเจกต์: {task.project.name}</p>}
                          </div>
                          <button
                            onClick={() => handleRestoreTask(task.id)}
                            disabled={restoringTaskId === task.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-200 bg-blue-950/50 border border-blue-900 disabled:opacity-40"
                          >
                            {restoringTaskId === task.id ? 'กำลังกู้คืน...' : 'กู้คืน'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </AccordionSection>
          </>
        )}
      </div>
    </div>
  )
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
}

function isUrgentProjectNotification(item: Pick<NotificationItem, 'title' | 'message'>) {
  return item.title.includes('เกินกำหนด') || item.message.includes('เกินกำหนด')
}

function isApprovedNotification(item: Pick<NotificationItem, 'title' | 'message'>) {
  return (
    item.title.includes('งานเสร็จแล้ว')
    || item.title.includes('งานได้รับอนุมัติแล้ว')
    || item.message.includes('หัวหน้าอนุมัติงาน')
    || item.message.includes('อนุมัติงาน ')
    || item.message.includes('อนุมัติงานแล้ว')
    || item.message.includes('ผ่านการตรวจสอบแล้ว')
    || item.message.includes('เสร็จสมบูรณ์แล้ว')
  )
}

function getNotificationDisplayTitle(item: Pick<NotificationItem, 'title' | 'message'>) {
  if (isUrgentProjectNotification(item)) return 'โปรเจกต์ที่คุณอยู่เกินกำหนด'
  if (isApprovedNotification(item)) return 'งานเสร็จแล้ว'
  return item.title
}

function normalizeNotificationMessage(message: string) {
  return message.replace(/\*/g, '').trim()
}

function renderNotificationMessage(message: string, tone: 'urgent' | 'approved' | 'default' = 'default') {
  const lines = normalizeNotificationMessage(message).split('\n').filter((line) => line.trim().length > 0)

  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const isReasonLine = line.trim().startsWith('เหตุผล:')

        if (isReasonLine) {
          return (
            <div
              key={`${line}-${index}`}
              className="inline-block rounded-lg bg-green-900/40 border border-green-800/70 px-2.5 py-1.5"
            >
              <p className="text-sm font-bold text-green-100 whitespace-pre-line">{line}</p>
            </div>
          )
        }

        return (
          <p
            key={`${line}-${index}`}
            className={
              tone === 'urgent'
                ? 'text-sm font-semibold text-red-100 leading-relaxed'
                : tone === 'approved'
                  ? 'text-sm font-semibold text-blue-100 leading-relaxed'
                  : 'text-sm text-slate-300 leading-relaxed'
            }
          >
            {line}
          </p>
        )
      })}
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

function getLatestRejectedNote(task: Task) {
  return task.task_log
    ?.filter((item) => item.action === 'rejected' && typeof item.note === 'string' && item.note.trim())
    .sort((a, b) => b.id - a.id)[0]?.note?.trim()
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'red' | 'blue' | 'amber'
}) {
  const tones = {
    red: 'border-red-800/60 bg-red-950/30 text-red-200',
    blue: 'border-blue-800/60 bg-blue-950/30 text-blue-200',
    amber: 'border-amber-800/60 bg-amber-950/30 text-amber-200',
  } as const

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-90">{label}</p>
    </div>
  )
}

function SectionLabel({ title, tone }: { title: string; tone: 'red' | 'blue' }) {
  const tones = {
    red: 'text-red-300',
    blue: 'text-blue-300',
  } as const

  return <p className={`text-xs font-semibold uppercase tracking-widest ${tones[tone]}`}>{title}</p>
}

function QuickActionCard({
  title,
  subtitle,
  buttonLabel,
  tone,
  onClick,
}: {
  title: string
  subtitle: string
  buttonLabel: string
  tone: 'orange' | 'slate'
  onClick: () => void
}) {
  const tones = {
    orange: 'border-orange-800/60 bg-orange-950/30 text-orange-200',
    slate: 'border-slate-700 bg-slate-900 text-slate-200',
  } as const

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      <button
        onClick={onClick}
        className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-white active:bg-white/20 transition"
      >
        {buttonLabel}
      </button>
    </div>
  )
}

function AccordionSection({
  title,
  description,
  count,
  open,
  onToggle,
  children,
}: {
  title: string
  description: string
  count: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-center justify-between text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 text-xs font-semibold">
              {count}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">{description}</p>
        </div>
        <span className="text-lg text-slate-500">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-4">
          {children}
        </div>
      )}
    </section>
  )
}

function NotificationCard({
  item,
  isOpening,
  isHiding,
  onOpen,
  onHide,
}: {
  item: NotificationItem
  isOpening: boolean
  isHiding: boolean
  onOpen: () => void
  onHide: () => void
}) {
  const urgent = isUrgentProjectNotification(item)
  const success = isApprovedNotification(item)
  const tone = urgent ? 'urgent' : success ? 'approved' : 'default'
  const displayTitle = getNotificationDisplayTitle(item)

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        urgent
          ? item.is_read
            ? 'border-red-900/70 bg-red-950/30'
            : 'border-red-800 bg-red-950/50'
          : success
            ? item.is_read
              ? 'border-blue-900/60 bg-blue-950/20'
              : 'border-blue-800 bg-blue-950/40'
            : item.is_read
              ? 'border-slate-800 bg-slate-900'
              : 'border-blue-900 bg-blue-950/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2.5 h-2.5 rounded-full ${urgent ? 'bg-red-400' : success ? 'bg-blue-400' : item.is_read ? 'bg-slate-600' : 'bg-blue-500'}`} />
            <p className={`font-semibold ${urgent ? 'text-red-100 text-[15px]' : success ? 'text-blue-100 text-[15px]' : 'text-slate-100'}`}>{displayTitle}</p>
          </div>
          {renderNotificationMessage(item.message, tone)}
        </button>

        <div className="shrink-0 text-right flex flex-col items-end gap-2">
          <p className="text-xs text-slate-500">{formatRelativeTime(item.createdAt)}</p>
          {isOpening && <p className="text-xs text-blue-300">กำลังเปิด...</p>}
          <button
            onClick={onHide}
            disabled={isHiding}
            className="w-8 h-8 rounded-full text-sm font-semibold text-slate-400 bg-slate-800 border border-slate-700 disabled:opacity-40"
            title="ซ่อนรายการนี้"
            aria-label="ซ่อนรายการนี้"
          >
            {isHiding ? '…' : '×'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 animate-pulse">
          <div className="h-4 w-40 bg-slate-700 rounded mb-3" />
          <div className="h-3 w-24 bg-slate-800 rounded mb-4" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-10 rounded-xl bg-slate-800" />
            <div className="h-10 rounded-xl bg-slate-800" />
            <div className="h-10 rounded-xl bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

function NotificationSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="animate-pulse rounded-xl border border-slate-800 p-4">
          <div className="h-4 w-40 bg-slate-700 rounded mb-2" />
          <div className="h-3 w-full bg-slate-800 rounded mb-1.5" />
          <div className="h-3 w-2/3 bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  )
}

function NoticeBox({ message, tone }: { message: string; tone: 'green' | 'red' }) {
  const tones = {
    green: 'bg-green-950/40 border-green-800/70 text-green-100',
    red: 'bg-red-950/40 border-red-800/70 text-red-100',
  } as const

  return (
    <div className={`border text-sm px-4 py-3 rounded-xl ${tones[tone]}`}>
      {message}
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
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 text-center">
      <p className="font-semibold text-white">{title}</p>
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

function TaskCard({
  task,
  isHiding,
  onProgress,
  onSubmit,
  onHandover,
  onHide,
}: {
  task: Task
  isHiding: boolean
  onProgress: () => void
  onSubmit: () => void
  onHandover: () => void
  onHide: () => void
}) {
  const status = statusLabel[task.status_task]
  const latestRejectedNote = task.status_task === 'in_progress' ? getLatestRejectedNote(task) : undefined

  return (
    <div className={`rounded-xl p-4 shadow-sm border ${
      latestRejectedNote
        ? 'bg-red-950/20 border-red-900/60'
        : task.status_task === 'done'
          ? 'bg-green-950/10 border-green-900/40'
          : 'bg-slate-950 border-slate-800'
    }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium text-white flex-1 leading-snug">{task.name}</h3>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${status.tone}`}>{status.text}</span>
      </div>

      {task.project && <p className="text-xs text-slate-400 mb-3">โปรเจกต์: {task.project.name}</p>}

      {latestRejectedNote && (
        <div className="mb-3 rounded-xl border border-green-800/70 bg-green-950/40 px-3 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-green-300">หมายเหตุจากหัวหน้า</p>
          <p className="mt-1 text-sm font-semibold text-green-100 whitespace-pre-line">{latestRejectedNote}</p>
        </div>
      )}

      {task.status_task === 'in_progress' && (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={onProgress} className="py-2 rounded-lg text-xs font-semibold text-blue-200 bg-blue-950/50 border border-blue-900">
            ความคืบหน้า
          </button>
          <button onClick={onSubmit} className="py-2 rounded-lg text-xs font-semibold text-white bg-blue-600">
            ส่งงาน
          </button>
          <button onClick={onHandover} className="py-2 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800">
            ส่งต่อ
          </button>
        </div>
      )}

      {task.status_task === 'under_review' && (
        <div className="w-full text-center text-sm text-amber-300 py-2">ส่งแล้ว รอหัวหน้าตรวจ</div>
      )}

      {task.status_task === 'done' && (
        <div className="flex items-center justify-between gap-3 py-2">
          <div>
            <div className="text-sm font-semibold text-green-300">งานเสร็จสมบูรณ์</div>
            <div className="text-xs text-slate-400 mt-1">งานนี้ผ่านการอนุมัติแล้ว</div>
          </div>
          <button
            onClick={onHide}
            disabled={isHiding}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 disabled:opacity-40"
          >
            {isHiding ? 'กำลังซ่อน...' : 'ซ่อน'}
          </button>
        </div>
      )}

      {task.status_task === 'waiting_pickup' && (
        <div className="w-full text-center text-sm text-orange-300 py-2">งานนี้กำลังรอคนรับช่วงต่อ</div>
      )}
    </div>
  )
}
