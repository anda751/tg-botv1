import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskApi } from '../../api';

type Task = {
  id: number
  name: string
  status_task: 'in_progress' | 'under_review' | 'waiting_pickup' | 'done'
  project?: { name: string }
}

const statusLabel: Record<string, { text: string; color: string }> = {
  in_progress: { text: 'กำลังทำ', color: 'bg-blue-100 text-blue-700' },
  under_review: { text: 'รอตรวจ', color: 'bg-yellow-100 text-yellow-700' },
  waiting_pickup: { text: 'รอรับต่อ', color: 'bg-orange-100 text-orange-700' },
  done: { text: 'เสร็จแล้ว', color: 'bg-green-100 text-green-700' },
};

export default function MyTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'done'>('active');

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      const { data } = await taskApi.getMyTasks();
      const list = Array.isArray(data) ? data : (data.data ?? []);
      setTasks(list);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () => tasks.filter((t) => (filter === 'active' ? t.status_task !== 'done' : t.status_task === 'done')),
    [filter, tasks],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-6 pb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">งานของฉัน</h1>
          <button
            onClick={() => navigate('/create')}
            className="bg-blue-500 text-white text-sm px-4 py-2 rounded-full font-medium"
          >
            + สร้างงาน
          </button>
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

      <div className="px-4 py-4 space-y-3 pb-24">
        {loading ? (
          <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-400 text-sm">ไม่มีงานในขณะนี้</p>
          </div>
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

      {task.project && <p className="text-xs text-gray-400 mb-3">📁 {task.project.name}</p>}

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
        <div className="w-full text-center text-sm text-yellow-600 py-2">รอหัวหน้าตรวจสอบ</div>
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
