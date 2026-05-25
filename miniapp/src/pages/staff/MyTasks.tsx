import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notificationApi, taskApi } from '../../api';

type Task = {
  id: number
  name: string
  status_task: 'in_progress' | 'under_review' | 'waiting_pickup' | 'done'
  project?: { name: string }
}

type NotificationItem = {
  id: number
  title: string
  message: string
  type: 'task' | 'project' | 'handover' | 'general'
  link?: string
  is_read: boolean
  createdAt: string
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
  const [loading, setLoading] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationsError, setNotificationsError] = useState('');
  const [filter, setFilter] = useState<'active' | 'done'>('active');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [openingNotificationId, setOpeningNotificationId] = useState<number | null>(null);

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

  const filtered = useMemo(
    () => tasks.filter((t) => (filter === 'active' ? t.status_task !== 'done' : t.status_task === 'done')),
    [filter, tasks],
  );

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-6 pb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">งานของฉัน</h1>
            <p className="text-sm text-gray-500 mt-1">ติดตามงานและอัปเดตล่าสุดได้จากหน้าเดียว</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/settings')}
              className="w-10 h-10 rounded-full text-lg font-medium bg-gray-100 text-gray-700 flex items-center justify-center"
              title="ตั้งค่าโปรไฟล์"
              aria-label="ตั้งค่าโปรไฟล์"
            >
              ⚙
            </button>
            <button
              onClick={() => navigate('/create')}
              className="bg-blue-500 text-white text-sm px-4 py-2 rounded-full font-medium"
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
                filter === f ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f === 'active' ? 'กำลังดำเนินการ' : 'เสร็จแล้ว'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
            {successMessage}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
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
            <button
              onClick={handleMarkAllRead}
              disabled={markingAllRead || unreadCount === 0}
              className="px-3 py-2 rounded-xl text-sm font-semibold text-blue-700 bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {markingAllRead ? 'กำลังอัปเดต...' : 'อ่านแล้วทั้งหมด'}
            </button>
          </div>

          <div className="p-4">
            {notificationsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="animate-pulse rounded-xl border border-gray-100 p-4">
                    <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-full bg-gray-100 rounded mb-1.5" />
                    <div className="h-3 w-2/3 bg-gray-100 rounded" />
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
                  <button
                    key={item.id}
                    onClick={() => handleOpenNotification(item)}
                    className={`w-full text-left rounded-xl border p-4 transition ${
                      item.is_read
                        ? 'border-gray-200 bg-white'
                        : 'border-blue-200 bg-blue-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${item.is_read ? 'bg-gray-300' : 'bg-blue-500'}`} />
                          <p className="font-semibold text-gray-800">{item.title}</p>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-line">{item.message}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-gray-400">{formatRelativeTime(item.createdAt)}</p>
                        {openingNotificationId === item.id && (
                          <p className="text-xs text-blue-500 mt-1">กำลังเปิด...</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {loading ? (
          <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
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
              onProgress={() => navigate(`/progress/${task.id}`, { state: { task } })}
              onSubmit={() => navigate(`/submit/${task.id}`, { state: { task } })}
              onHandover={() => navigate(`/handover/${task.id}`, { state: { task } })}
            />
          ))
        )}
      </div>

      <div className="fixed bottom-6 left-4 right-4">
        <button
          onClick={() => navigate('/pickup')}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium shadow-lg"
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
      <p className="font-semibold text-gray-800">{title}</p>
      <p className="text-sm text-gray-500 mt-2">{message}</p>
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
  onProgress,
  onSubmit,
  onHandover,
}: {
  task: Task
  onProgress: () => void
  onSubmit: () => void
  onHandover: () => void
}) {
  const status = statusLabel[task.status_task];

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium text-gray-800 flex-1 leading-snug">{task.name}</h3>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${status.color}`}>{status.text}</span>
      </div>

      {task.project && <p className="text-xs text-gray-400 mb-3">โปรเจกต์: {task.project.name}</p>}

      {task.status_task === 'in_progress' && (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={onProgress} className="py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-100">
            ความคืบหน้า
          </button>
          <button onClick={onSubmit} className="py-2 rounded-lg text-xs font-semibold text-white bg-blue-500">
            ส่งงาน
          </button>
          <button onClick={onHandover} className="py-2 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100">
            ส่งต่อ
          </button>
        </div>
      )}

      {task.status_task === 'under_review' && (
        <div className="w-full text-center text-sm text-amber-600 py-2">รอหัวหน้าตรวจสอบ</div>
      )}
      {task.status_task === 'done' && (
        <div className="w-full text-center text-sm text-green-600 py-2">งานเสร็จสมบูรณ์</div>
      )}
      {task.status_task === 'waiting_pickup' && (
        <div className="w-full text-center text-sm text-orange-600 py-2">งานรอรับช่วงต่อ</div>
      )}
    </div>
  );
}
