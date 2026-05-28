import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handoverApi, taskApi } from '../../api';

type Task = {
  id: number
  name: string
  project?: { name: string }
  current_owner?: { display_name: string; username: string }
  handover_requests?: { reason: string }[]
}

export default function PickupTask() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [doneId, setDoneId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    setListError('');
    try {
      const { data } = await taskApi.getWaitingPickup();
      const list = Array.isArray(data) ? data : (data.data ?? []);
      setTasks(list);
    } catch (err: any) {
      setTasks([]);
      setListError(err?.response?.data?.error?.message || 'โหลดงานรอรับไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  async function handlePickup(taskId: number) {
    setError('');
    setSuccessMessage('');
    setPickingId(taskId);
    try {
      await handoverApi.pickup(taskId);
      setDoneId(taskId);
      setSuccessMessage('ส่งคำขอรับงานเรียบร้อยแล้ว รอหัวหน้าอนุมัติ');
      setTimeout(() => {
        setDoneId(null);
        loadTasks();
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'ส่งคำขอรับงานไม่สำเร็จ');
    } finally {
      setPickingId(null);
    }
  }

  return (
    <div className="panel-shell min-h-screen bg-slate-950 flex flex-col transition-colors">
      <div className="panel-header bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4 flex items-center gap-3 transition-colors">
        <button
          onClick={() => navigate('/')}
          className="panel-icon-button w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition"
          title="ย้อนกลับ"
          aria-label="ย้อนกลับ"
        >
          ←
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">งานรอรับช่วงต่อ</h1>
          {!loading && !listError && (
            <p className="text-xs text-slate-400 mt-0.5">
              {tasks.length === 0 ? 'ยังไม่มีงานรอรับช่วงต่อ' : `${tasks.length} งาน`}
            </p>
          )}
        </div>
        <button
          onClick={loadTasks}
          className="panel-icon-button w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition"
          title="รีเฟรช"
          aria-label="รีเฟรช"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 px-4 py-4">
        <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl px-4 py-3 flex gap-3 items-start mb-4">
          <span className="text-lg mt-0.5">i</span>
          <p className="text-blue-300 text-xs leading-relaxed">
            เมื่อกดรับงาน ระบบจะส่งคำขอให้หัวหน้าตรวจสอบก่อน งานจะย้ายมาอยู่กับคุณหลังอนุมัติแล้ว
          </p>
        </div>

        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-950/50 border border-green-800 text-green-300 text-sm px-4 py-3 rounded-xl mb-4">
            {successMessage}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-900 rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-slate-800 rounded w-3/4 mb-3" />
                <div className="h-3 bg-slate-800 rounded w-1/2 mb-4" />
                <div className="h-10 bg-slate-800 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {!loading && listError && (
          <StateBox title="โหลดงานรอรับไม่สำเร็จ" message={listError} actionLabel="ลองใหม่" onAction={loadTasks} />
        )}

        {!loading && !listError && tasks.length === 0 && (
          <StateBox
            title="ยังไม่มีงานรอรับช่วงต่อ"
            message="ตอนนี้ทุกงานมีผู้รับผิดชอบอยู่แล้ว"
            actionLabel="รีเฟรช"
            onAction={loadTasks}
          />
        )}

        {!loading && !listError && tasks.length > 0 && (
          <div className="space-y-3">
            {tasks.map((task) => {
              const isDone = doneId === task.id;
              const isPicking = pickingId === task.id;
              const reason = task.handover_requests?.[0]?.reason;

              return (
                <div
                  key={task.id}
                  className={`bg-slate-900 border rounded-2xl p-4 transition-all ${
                    isDone ? 'border-green-600' : 'border-slate-700'
                  }`}
                >
                  <p className="text-white font-semibold text-sm leading-snug mb-1">{task.name}</p>

                  {task.project && (
                    <p className="text-xs text-slate-500 mb-2">โปรเจกต์: {task.project.name}</p>
                  )}

                  {task.current_owner && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-400">
                        {(task.current_owner.display_name || task.current_owner.username)?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-400">
                        ส่งต่อโดย {task.current_owner.display_name || task.current_owner.username}
                      </span>
                    </div>
                  )}

                  {reason && (
                    <div className="bg-slate-800 rounded-xl px-3 py-2 mb-3">
                      <p className="text-xs text-slate-500 mb-0.5">เหตุผลที่ส่งต่อ</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{reason}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-orange-900/50 text-orange-300">
                      รอรับช่วงต่อ
                    </span>
                  </div>

                  {isDone ? (
                    <div className="w-full py-3 rounded-xl bg-green-900/40 border border-green-700 text-green-300 text-sm font-semibold text-center">
                      ส่งคำขอแล้ว รอหัวหน้าอนุมัติ
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePickup(task.id)}
                      disabled={isPicking || pickingId !== null}
                      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 text-sm"
                    >
                      {isPicking ? 'กำลังส่งคำขอ...' : 'ขอรับงานนี้'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
