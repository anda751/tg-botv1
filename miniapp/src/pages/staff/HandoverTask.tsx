import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { handoverApi } from '../../api'
import axios from 'axios'

type Task = { id: number; name: string; project?: { name: string } }

export default function HandoverTask() {
  const navigate = useNavigate()
  const { taskId } = useParams()

  const [task, setTask] = useState<Task | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    axios
      .get(`/tasks/${taskId}`, { params: { populate: 'project' } })
      .then(({ data }) => setTask(data.data ?? data))
      .catch(() => navigate('/'))
  }, [taskId])

  async function handleHandover() {
    if (reason.length < 5) {
      setError('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await handoverApi.handover(Number(taskId), reason)
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  const isValid = reason.length >= 5

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
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white">ส่งต่องาน</h1>
          {task && (
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {task.project ? `📁 ${task.project.name} · ` : ''}{task.name}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">

        {/* Info banner */}
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl px-4 py-3 flex gap-3 items-start">
          <span className="text-xl mt-0.5">⚠️</span>
          <div>
            <p className="text-amber-300 text-sm font-semibold">ส่งต่องานให้คนอื่นรับ</p>
            <p className="text-amber-400/70 text-xs mt-0.5 leading-relaxed">
              งานจะเปลี่ยนเป็น "รอคนรับ" และมีเวลา 30 นาที
              ถ้าไม่มีคนรับ งานจะกลับมาที่คุณ
            </p>
          </div>
        </div>

        {/* Task card */}
        {task && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1 uppercase tracking-widest font-semibold">งานที่จะส่งต่อ</p>
            <p className="text-white font-semibold text-sm leading-snug">{task.name}</p>
            {task.project && (
              <p className="text-xs text-slate-400 mt-1.5">📁 {task.project.name}</p>
            )}
            <div className="mt-3 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs text-blue-300">กำลังทำ → รอคนรับ</span>
            </div>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">
            เหตุผลที่ส่งต่อ <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => { setReason(e.target.value); setError('') }}
            placeholder="เช่น ติดประชุม, ป่วย, ต้องไปทำงานอื่นก่อน..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition resize-none text-sm"
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-slate-600">ต้องการอย่างน้อย 5 ตัวอักษร</span>
            <span className={`text-xs font-medium ${reason.length >= 5 ? 'text-green-400' : 'text-slate-500'}`}>
              {reason.length} ตัว
            </span>
          </div>
        </div>

        {/* What happens next */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">ขั้นตอนหลังส่งต่อ</p>
          <Step n={1} text="งานเปลี่ยนเป็นสถานะ รอคนรับ" />
          <Step n={2} text="เพื่อนร่วมทีมสามารถกด Pickup งานได้" />
          <Step n={3} text="หัวหน้าอนุมัติการโอน แล้วงานย้ายไปให้คนใหม่" />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-xl">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="px-4 pb-8 pt-2 flex gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex-1 py-3.5 rounded-xl font-semibold text-slate-400 bg-slate-900 border border-slate-700 active:bg-slate-800 transition"
        >
          ยกเลิก
        </button>
        <button
          onClick={handleHandover}
          disabled={submitting || !isValid}
          className="flex-1 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              กำลังส่ง...
            </span>
          ) : (
            'ส่งต่องาน 🔄'
          )}
        </button>
      </div>
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
        {n}
      </div>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  )
}