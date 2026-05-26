import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notificationApi, taskApi } from '../../api';

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

const statusLabel: Record<Task['status_task'], { text: string; color: string }> = {
  in_progress: { text: 'กำลังทำ', color: 'bg-blue-100 text-blue-700' },
  under_review: { text: 'รอตรวจ', color: 'bg-amber-100 text-amber-700' },
  waiting_pickup: { text: 'รอรับต่อ', color: 'bg-orange-100 text-orange-700' },
  done: { text: 'เสร็จแล้ว', color: 'bg-green-100 text-green-700' },
};

export default function MyTasks() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hidden, setHidden] = useState<HiddenPanelState>({ notifications: [], tasks: [] });
  const [loading, setLoading] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [hiddenLoading, setHiddenLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationsError, setNotificationsError] = useState('');
  const [hiddenError, setHiddenError] = useState('');
  const [filter, setFilter] = useState<'active' | 'done'>('active');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [hidingRead, setHidingRead] = useState(false);
  const [hidingTaskId, setHidingTaskId] = useState<number | null>(null);
  const [openingNotificationId, setOpeningNotificationId] = useState<number | null>(null);
  const [hidingNotificationId, setHidingNotificationId] = useState<number | null>(null);
  const [restoringNotificationId, setRestoringNotificationId] = useState<number | null>(null);
  const [restoringTaskId, setRestoringTaskId] = useState<number | null>(null);
  const [restoringAllNotifications, setRestoringAllNotifications] = useState(false);
  const [restoringAllTasks, setRestoringAllTasks] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState(false);

  useEffect(() => {
    const message = (location.state as any)?.successMessage;
    if (typeof message === 'string' && message.trim()) {
      setSuccessMessage(message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    loadTasks();
    loadNotifications();
    loadHidden();
  }, []);

  async function loadTasks() {
    setLoading(true);
    setError('');
    try {
      const { data } = await taskApi.getMyTasks();
      const list = Array.isArray(data) ? data : (data.data ?? []);
      setTasks(list);
    } catch (err) {
      setTasks([]);
      setError(extractMessage(err, 'โหลดรายการงานไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    setNotificationsLoading(true);
    setNotificationsError('');
    try {
      const { data } = await notificationApi.getMy();
      const list = Array.isArray(data) ? data : (data.data ?? []);
      setNotifications(list);
    } catch (err) {
      setNotifications([]);
      setNotificationsError(extractMessage(err, 'โหลดกิจกรรมล่าสุดไม่สำเร็จ'));
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function loadHidden() {
    setHiddenLoading(true);
    setHiddenError('');
    try {
      const [hiddenNotificationsRes, hiddenTasksRes] = await Promise.all([
        notificationApi.getHidden(),
        taskApi.getHiddenTasks(),
      ]);
      const hiddenNotifications = Array.isArray(hiddenNotificationsRes.data)
        ? hiddenNotificationsRes.data
        : (hiddenNotificationsRes.data.data ?? []);
      const hiddenTasks = Array.isArray(hiddenTasksRes.data)
        ? hiddenTasksRes.data
        : (hiddenTasksRes.data.data ?? []);
      setHidden({
        notifications: hiddenNotifications,
        tasks: hiddenTasks,
      });
    } catch (err) {
      setHiddenError(extractMessage(err, 'โหลดรายการที่ซ่อนไว้ไม่สำเร็จ'));
      setHidden({ notifications: [], tasks: [] });
    } finally {
      setHiddenLoading(false);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAllRead(true);
    try {
      await notificationApi.markAllRead();
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
    } catch (err) {
      setNotificationsError(extractMessage(err, 'อัปเดตสถานะแจ้งเตือนไม่สำเร็จ'));
    } finally {
      setMarkingAllRead(false);
    }
  }

  async function handleOpenNotification(item: NotificationItem) {
    setOpeningNotificationId(item.id);
    try {
      if (!item.is_read) {
        await notificationApi.markRead(item.id);
        setNotifications((items) =>
          items.map((current) => current.id === item.id ? { ...current, is_read: true } : current),
        );
      }
      if (item.link && item.link !== location.pathname) {
        navigate(item.link);
      }
    } catch (err) {
      setNotificationsError(extractMessage(err, 'เปิดการแจ้งเตือนไม่สำเร็จ'));
    } finally {
      setOpeningNotificationId(null);
    }
  }

  async function handleHideNotification(notificationId: number) {
    setHidingNotificationId(notificationId);
    try {
      await notificationApi.hide(notificationId);
      const hiddenItem = notifications.find((item) => item.id === notificationId);
      setNotifications((items) => items.filter((item) => item.id !== notificationId));
      if (hiddenItem) {
        setHidden((current) => ({
          ...current,
          notifications: [{ ...hiddenItem, is_hidden: true }, ...current.notifications],
        }));
      }
    } catch (err) {
      setNotificationsError(extractMessage(err, 'ซ่อนการแจ้งเตือนไม่สำเร็จ'));
    } finally {
      setHidingNotificationId(null);
    }
  }

  async function handleHideRead() {
    setHidingRead(true);
    try {
      await notificationApi.hideRead();
      const movedItems = notifications.filter((item) => item.is_read);
      setNotifications((items) => items.filter((item) => !item.is_read));
      if (movedItems.length) {
        setHidden((current) => ({
          ...current,
          notifications: [...movedItems.map((item) => ({ ...item, is_hidden: true })), ...current.notifications],
        }));
      }
    } catch (err) {
      setNotificationsError(extractMessage(err, 'ซ่อนรายการที่อ่านแล้วไม่สำเร็จ'));
    } finally {
      setHidingRead(false);
    }
  }

  async function handleHideTask(taskId: number) {
    setHidingTaskId(taskId);
    try {
      await taskApi.hide(taskId);
      const hiddenTask = tasks.find((item) => item.id === taskId);
      setTasks((items) => items.filter((item) => item.id !== taskId));
      if (hiddenTask) {
        setHidden((current) => ({
          ...current,
          tasks: [hiddenTask, ...current.tasks],
        }));
      }
    } catch (err) {
      setError(extractMessage(err, 'ซ่อนงานไม่สำเร็จ'));
    } finally {
      setHidingTaskId(null);
    }
  }

  async function handleRestoreNotification(notificationId: number) {
    setRestoringNotificationId(notificationId);
    try {
      await notificationApi.restore(notificationId);
      const restored = hidden.notifications.find((item) => item.id === notificationId);
      setHidden((current) => ({
        ...current,
        notifications: current.notifications.filter((item) => item.id !== notificationId),
      }));
      if (restored) {
        setNotifications((current) => [{ ...restored, is_hidden: false }, ...current]);
      }
    } catch (err) {
      setHiddenError(extractMessage(err, 'กู้คืนการแจ้งเตือนไม่สำเร็จ'));
    } finally {
      setRestoringNotificationId(null);
    }
  }

  async function handleRestoreTask(taskId: number) {
    setRestoringTaskId(taskId);
    try {
      await taskApi.restore(taskId);
      const restored = hidden.tasks.find((item) => item.id === taskId);
      setHidden((current) => ({
        ...current,
        tasks: current.tasks.filter((item) => item.id !== taskId),
      }));
      if (restored) {
        setTasks((current) => [restored, ...current]);
      }
    } catch (err) {
      setHiddenError(extractMessage(err, 'กู้คืนงานไม่สำเร็จ'));
    } finally {
      setRestoringTaskId(null);
    }
  }

  async function handleRestoreAllNotifications() {
    setRestoringAllNotifications(true);
    try {
      await notificationApi.restoreAll();
      const restoredItems = hidden.notifications;
      setHidden((current) => ({
        ...current,
        notifications: [],
      }));
      if (restoredItems.length) {
        setNotifications((current) => [
          ...restoredItems.map((item) => ({ ...item, is_hidden: false })),
          ...current,
        ]);
      }
    } catch (err) {
      setHiddenError(extractMessage(err, 'กู้คืนกิจกรรมล่าสุดที่ซ่อนไว้ไม่สำเร็จ'));
    } finally {
      setRestoringAllNotifications(false);
    }
  }

  async function handleRestoreAllTasks() {
    setRestoringAllTasks(true);
    try {
      await taskApi.restoreAll();
      const restoredTasks = hidden.tasks;
      setHidden((current) => ({
        ...current,
        tasks: [],
      }));
      if (restoredTasks.length) {
        setTasks((current) => [...restoredTasks, ...current]);
      }
    } catch (err) {
      setHiddenError(extractMessage(err, 'กู้คืนงานที่ซ่อนไว้ไม่สำเร็จ'));
    } finally {
      setRestoringAllTasks(false);
    }
  }

  const filtered = useMemo(
    () => tasks.filter((t) => (filter === 'active' ? t.status_task !== 'done' : t.status_task === 'done')),
    [filter, tasks],
  );

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const readCount = notifications.filter((item) => item.is_read).length;
  const hiddenCount = hidden.notifications.length + hidden.tasks.length;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="bg-slate-900 px-4 pt-6 pb-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">งานของฉัน</h1>
            <p className="text-sm text-gray-500 mt-1">ติดตามงานและอัปเดตล่าสุดได้จากหน้าเดียว</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/settings')}
              className="w-10 h-10 rounded-full text-lg font-medium bg-slate-800 text-slate-300 flex items-center justify-center active:bg-slate-700 transition"
              title="ตั้งค่าโปรไฟล์"
              aria-label="ตั้งค่าโปรไฟล์"
            >
              ⚙
            </button>
            <button
              onClick={() => navigate('/create')}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-full font-medium active:bg-blue-500 transition"
            >
              + สร้างงาน
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {(['active', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {f === 'active' ? 'กำลังดำเนินการ' : 'เสร็จแล้ว'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        {successMessage && (
          <div className="bg-green-950/40 border border-green-800/70 text-green-100 text-sm px-4 py-3 rounded-xl">
            {successMessage}
          </div>
        )}

        <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-4 border-b border-slate-800 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-800">กิจกรรมล่าสุด</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                    ยังไม่อ่าน {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">อัปเดตที่เดิมเคยส่งผ่าน Telegram จะมาอยู่ตรงนี้แทน</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={handleMarkAllRead}
                disabled={markingAllRead || unreadCount === 0}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-blue-200 bg-blue-950/50 border border-blue-900 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {markingAllRead ? 'กำลังอัปเดต...' : 'อ่านแล้วทั้งหมด'}
              </button>
              <button
                onClick={handleHideRead}
                disabled={hidingRead || readCount === 0}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {hidingRead ? 'กำลังซ่อน...' : 'ซ่อนที่อ่านแล้ว'}
              </button>
            </div>
          </div>

          <div className="p-4">
            {notificationsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="animate-pulse rounded-xl border border-slate-800 p-4">
                    <div className="h-4 w-40 bg-slate-700 rounded mb-2" />
                    <div className="h-3 w-full bg-slate-800 rounded mb-1.5" />
                    <div className="h-3 w-2/3 bg-slate-800 rounded" />
                  </div>
                ))}
              </div>
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
                message="เมื่อมีการอนุมัติ ส่งกลับ หรือเพิ่มเข้าโปรเจกต์ ระบบจะแสดงไว้ที่นี่"
              />
            ) : (
              <div className="space-y-3">
                {notifications.map((item) => (
                  (() => {
                    const urgent = isUrgentProjectNotification(item);
                    return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 transition ${
                      urgent
                        ? item.is_read
                          ? 'border-red-900/70 bg-red-950/30'
                          : 'border-red-800 bg-red-950/50'
                        : item.is_read
                          ? 'border-slate-800 bg-slate-900'
                          : 'border-blue-900 bg-blue-950/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button onClick={() => handleOpenNotification(item)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            urgent ? 'bg-red-400' : item.is_read ? 'bg-slate-600' : 'bg-blue-500'
                          }`}
                          />
                          <p className={`font-semibold ${urgent ? 'text-red-100 text-[15px]' : 'text-slate-100'}`}>{item.title}</p>
                        </div>
                        <p className={`whitespace-pre-line ${urgent ? 'text-sm font-semibold text-red-100 leading-relaxed' : 'text-sm text-slate-300'}`}>
                          {item.message}
                        </p>
                      </button>
                      <div className="shrink-0 text-right flex flex-col items-end gap-2">
                        <p className="text-xs text-slate-500">{formatRelativeTime(item.createdAt)}</p>
                        {openingNotificationId === item.id && (
                          <p className="text-xs text-blue-500">กำลังเปิด...</p>
                        )}
                        <button
                          onClick={() => handleHideNotification(item.id)}
                          disabled={hidingNotificationId === item.id}
                          className="w-8 h-8 rounded-full text-sm font-semibold text-slate-400 bg-slate-800 border border-slate-700 disabled:opacity-40"
                          title="ซ่อนรายการนี้"
                          aria-label="ซ่อนรายการนี้"
                        >
                          {hidingNotificationId === item.id ? '…' : '×'}
                        </button>
                      </div>
                    </div>
                  </div>
                    );
                  })()
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <button
            onClick={() => setHiddenOpen((value) => !value)}
            className="w-full px-4 py-4 flex items-center justify-between text-left"
          >
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-800">รายการที่ซ่อนไว้</h2>
                {hiddenCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 text-xs font-semibold">
                    {hiddenCount}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">ซ่อนไว้เพื่อลดความรก แต่ยังกู้คืนกลับมาได้</p>
            </div>
            <span className="text-lg text-slate-400">{hiddenOpen ? '−' : '+'}</span>
          </button>

          {hiddenOpen && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-800">
              {hiddenLoading ? (
                <div className="text-sm text-gray-400 py-3">กำลังโหลดรายการที่ซ่อนไว้...</div>
              ) : hiddenError ? (
                <StateBox title="โหลดรายการที่ซ่อนไว้ไม่สำเร็จ" message={hiddenError} actionLabel="ลองใหม่" onAction={loadHidden} />
              ) : hiddenCount === 0 ? (
                <StateBox title="ยังไม่มีรายการที่ซ่อนไว้" message="เมื่อซ่อนกิจกรรมล่าสุดหรืองานเสร็จแล้ว รายการจะมาอยู่ตรงนี้" />
              ) : (
                <>
                  {hidden.notifications.length > 0 && (
                    <div className="space-y-2 pt-4">
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
                              : 'border-slate-800 bg-slate-950'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className={`font-semibold ${isUrgentProjectNotification(item) ? 'text-red-100 text-[15px]' : 'text-slate-100'}`}>{item.title}</p>
                            <p className={`whitespace-pre-line mt-1 ${isUrgentProjectNotification(item) ? 'text-sm font-semibold text-red-100 leading-relaxed' : 'text-sm text-slate-300'}`}>
                              {item.message}
                            </p>
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
                </>
              )}
            </div>
          )}
        </section>

        {loading ? (
          <div className="text-center py-12 text-slate-500">กำลังโหลด...</div>
        ) : error ? (
          <StateBox title="โหลดงานไม่สำเร็จ" message={error} actionLabel="ลองใหม่" onAction={loadTasks} />
        ) : filtered.length === 0 ? (
          <StateBox
            title={filter === 'active' ? 'ยังไม่มีงานที่กำลังทำ' : 'ยังไม่มีงานที่เสร็จแล้ว'}
            message={
              filter === 'active'
                ? 'เริ่มต้นด้วยการสร้างงานใหม่ หรือรับงานต่อจากหน้าอื่น'
                : 'เมื่องานเสร็จ รายการจะแสดงที่นี่'
            }
          />
        ) : (
          filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isHiding={hidingTaskId === task.id}
              onProgress={() => navigate(`/progress/${task.id}`, { state: { task } })}
              onSubmit={() => navigate(`/submit/${task.id}`, { state: { task } })}
              onHandover={() => navigate(`/handover/${task.id}`, { state: { task } })}
              onHide={() => handleHideTask(task.id)}
            />
          ))
        )}
      </div>

      <div className="fixed bottom-6 left-4 right-4">
        <button
          onClick={() => navigate('/pickup')}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-medium shadow-lg"
        >
          ดูงานรอรับช่วงต่อ
        </button>
      </div>
    </div>
  );
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback;
}

function isUrgentProjectNotification(item: Pick<NotificationItem, 'title' | 'message'>) {
  return item.title.includes('เกินกำหนด') || item.message.includes('เกินกำหนด');
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;

  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
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
          className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-500 active:bg-blue-600 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
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
  const status = statusLabel[task.status_task];
  const latestRejectedNote = task.task_log
    ?.filter((item) => item.action === 'rejected' && typeof item.note === 'string' && item.note.trim())
    .sort((a, b) => b.id - a.id)[0]?.note?.trim();

  return (
    <div className="bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-800">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium text-white flex-1 leading-snug">{task.name}</h3>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${status.color}`}>{status.text}</span>
      </div>

      {task.project && <p className="text-xs text-slate-400 mb-3">โปรเจกต์: {task.project.name}</p>}

      {task.status_task === 'in_progress' && latestRejectedNote && (
        <div className="mb-3 rounded-xl border border-green-800/70 bg-green-950/40 px-3 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-green-700">หมายเหตุจากหัวหน้า</p>
          <p className="mt-1 text-sm font-medium text-green-800 whitespace-pre-line">{latestRejectedNote}</p>
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
        <div className="w-full text-center text-sm text-amber-600 py-2">รอหัวหน้าตรวจสอบ</div>
      )}
      {task.status_task === 'done' && (
        <div className="flex items-center justify-between gap-3 py-2">
          <div className="text-sm text-green-600">งานเสร็จสมบูรณ์</div>
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
        <div className="w-full text-center text-sm text-orange-600 py-2">งานรอรับช่วงต่อ</div>
      )}
    </div>
  );
}
