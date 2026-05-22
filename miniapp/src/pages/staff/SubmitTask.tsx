import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { taskApi } from '../../api'

type Task = { id: number; name: string; project?: { name: string } }

export default function SubmitTask() {
  const navigate = useNavigate()
  const location = useLocation()
  const { taskId } = useParams()
  const fileRef = useRef<HTMLInputElement>(null)

  const [task, setTask] = useState<Task | null>(null)
  const [reportText, setReportText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const navTask = (location.state as any)?.task as Task | undefined
    const idNum = Number(taskId)

    if (!Number.isFinite(idNum) || idNum <= 0) {
      navigate('/')
      return
    }

    if (navTask && navTask.id === idNum) {
      setTask(navTask)
      return
    }

    taskApi
      .getMyTasks()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data.data ?? [])
        const found = list.find((t: any) => Number(t.id) === idNum)
        if (!found) {
          navigate('/')
          return
        }
        setTask(found)
      })
      .catch(() => navigate('/'))
  }, [taskId, location.state, navigate])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
    setError('')
  }

  function handleRemoveImage() {
    setImageFile(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit() {
    if (!imageFile) { setError('กรุณาแนบรูปหลักฐาน'); return }
    if (reportText.length < 5) { setError('รายงานต้องมีอย่างน้อย 5 ตัวอักษร'); return }
    setError('')
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('proof_image', imageFile)
      fd.append('report_text', reportText)
      await taskApi.submit(Number(taskId), fd)
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  const isValid = !!imageFile && reportText.length >= 5

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
          <h1 className="text-lg font-bold text-white">ส่งงาน</h1>
          {task && (
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {task.project ? `📁 ${task.project.name} · ` : ''}{task.name}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">

        {/* Image upload */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 block">
            รูปหลักฐาน <span className="text-red-400">*</span>
          </label>

          {preview ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-700">
              <img
                src={preview}
                alt="proof"
                className="w-full object-cover max-h-64"
              />
              {/* overlay buttons */}
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-black/60 backdrop-blur-sm active:scale-95 transition"
                >
                  เปลี่ยน
                </button>
                <button
                  onClick={handleRemoveImage}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-black/60 backdrop-blur-sm active:scale-95 transition"
                >
                  ลบ
                </button>
              </div>
              {/* filename */}
              <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-white text-xs truncate">{imageFile?.name}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-40 rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-2 active:bg-slate-900 transition"
            >
              <span className="text-3xl">📷</span>
              <span className="text-sm text-slate-400 font-medium">แตะเพื่อเลือกรูป</span>
              <span className="text-xs text-slate-600">JPG, PNG, HEIC</span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Report text */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">
            รายงานสรุปผลงาน <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reportText}
            onChange={e => { setReportText(e.target.value); setError('') }}
            placeholder="อธิบายสิ่งที่ทำเสร็จแล้ว..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none text-sm"
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-slate-600">ต้องการอย่างน้อย 5 ตัวอักษร</span>
            <span className={`text-xs font-medium ${reportText.length >= 5 ? 'text-green-400' : 'text-slate-500'}`}>
              {reportText.length} ตัว
            </span>
          </div>
        </div>

        {/* Checklist */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">เช็คลิสต์ก่อนส่ง</p>
          <CheckItem ok={!!imageFile} label="แนบรูปหลักฐานแล้ว" />
          <CheckItem ok={reportText.length >= 5} label="กรอกรายงานอย่างน้อย 5 ตัวอักษร" />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-xl">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Bottom button */}
      <div className="px-4 pb-8 pt-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !isValid}
          className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              กำลังส่ง...
            </span>
          ) : (
            'ส่งงานให้หัวหน้าตรวจ ✈️'
          )}
        </button>
      </div>
    </div>
  )
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition ${
        ok ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-600'
      }`}>
        {ok ? '✓' : '·'}
      </div>
      <span className={`text-sm transition ${ok ? 'text-slate-300' : 'text-slate-600'}`}>
        {label}
      </span>
    </div>
  )
}
