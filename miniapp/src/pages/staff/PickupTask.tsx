import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { handoverApi, taskApi } from '../../api'

type Task = {
  id: number
  name: string
  project?: { name: string }
  current_owner?: { display_name: string; username: string }
  task_log?: any[]
  handover_requests?: { reason: string }[]
}

export default function PickupTask() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [pickingId, setPickingId] = useState<number | null>(null)
  const [doneId, setDoneId] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadTasks()
  }, [])

  async function loadTasks() {
    setLoading(true)
    try {
      const { data } = await taskApi.getWaitingPickup()
      const list = Array.isArray(data) ? data : (data.data ?? [])
      setTasks(list)
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  async function handlePickup(taskId: number) {
    setError('')
    setPickingId(taskId)
    try {
      await handoverApi.pickup(taskId)
      setDoneId(taskId)
      // refresh list after short delay
      setTimeout(() => {
        setDoneId(null)
        loadTasks()
      }, 2000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setPickingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 bg-slate-800 active:bg-slate-700 transition"
        >
          ←
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">งานรอคนรับ</h1>
          {!loading && (
            <p className="text-xs text-slate-400 mt-0.5">
              {tasks.length === 0 ? 'ไม่มีงานรอรับ' : `${tasks.length} งาน`}
            </p>
          )}
        </div>
        <button
          onClick={loadTasks}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 bg-slate-800 active:bg-slate-700 transition"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 px-4 py-4">

        {/* Info banner */}
        <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl px-4 py-3 flex gap-3 items-start mb-4">
          <span className="text-lg mt-0.5">ℹ️</span>
          <p className="text-blue-300 text-xs leading-relaxed">
            กดรับงานแล้วรอหัวหน้าอนุมัติ งานจะย้ายมาอยู่กับคุณหลังจากนั้น
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
            ⚠️ {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-slate-900 rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-slate-800 rounded w-3/4 mb-3" />
                <div className="h-3 bg-slate-800 rounded w-1/2 mb-4" />
                <div className="h-10 bg-slate-800 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-slate-300 font-semibold">ไม่มีงานรอรับตอนนี้</p>
            <p className="text-slate-500 text-sm mt-1">ทุกงานมีคนรับผิดชอบแล้ว</p>
            <button
              onClick={loadTasks}
              className="mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-slate-900 border border-slate-700 active:bg-slate-800 transition"
            >
              รีเฟรช
            </button>
          </div>
        )}

        {/* Task cards */}
        {!loading && tasks.length > 0 && (
          <div className="space-y-3">
            {tasks.map(task => {
              const isDone = doneId === task.id
              const isPicking = pickingId === task.id
              const reason = task.handover_requests?.[0]?.reason

              return (
                <div
                  key={task.id}
                  className={`bg-slate-900 border rounded-2xl p-4 transition-all ${
                    isDone ? 'border-green-600' : 'border-slate-700'
                  }`}
                >
                  {/* Task name */}
                  <p className="text-white font-semibold text-sm leading-snug mb-1">
                    {task.name}
                  </p>

                  {/* Project */}
                  {task.project && (
                    <p className="text-xs text-slate-500 mb-2">📁 {task.project.name}</p>
                  )}

                  {/* Previous owner */}
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

                  {/* Handover reason */}
                  {reason && (
                    <div className="bg-slate-800 rounded-xl px-3 py-2 mb-3">
                      <p className="text-xs text-slate-500 mb-0.5">เหตุผล</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{reason}</p>
                    </div>
                  )}

                  {/* Status badge + timer */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-orange-900/50 text-orange-300">
                      🟡 รอคนรับ
                    </span>
                  </div>

                  {/* Action button */}
                  {isDone ? (
                    <div className="w-full py-3 rounded-xl bg-green-900/40 border border-green-700 text-green-300 text-sm font-semibold text-center">
                      ✅ ส่งคำขอแล้ว รอหัวหน้าอนุมัติ
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePickup(task.id)}
                      disabled={isPicking || pickingId !== null}
                      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 text-sm"
                    >
                      {isPicking ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          กำลังส่งคำขอ...
                        </span>
                      ) : (
                        '🙋 รับงานนี้'
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}