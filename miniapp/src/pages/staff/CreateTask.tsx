import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { taskApi, projectApi } from '../../api'

type Project = { id: number; name: string }

export default function CreateTask() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [selectedProject, setSelectedProject] = useState<number | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    projectApi.getMyProjects()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data.data ?? [])
        setProjects(list)
      })
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false))
  }, [])

  async function handleCreate() {
    if (!name || name.length < 5) {
      setError('ชื่องานต้องมีอย่างน้อย 5 ตัวอักษร')
      return
    }
    if (!/[a-zA-Zก-๙]/.test(name)) {
      setError('ชื่องานต้องมีตัวอักษรภาษาไทยหรืออังกฤษอย่างน้อย 1 ตัว')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await taskApi.create({
        name,
        project: selectedProject as number,
      })
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  const isValid = name.length >= 5 && /[a-zA-Zก-๙]/.test(name)

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
        <h1 className="text-lg font-bold text-white">สร้างงานใหม่</h1>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">

        {/* Task name */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">
            ชื่องาน <span className="text-red-400">*</span>
          </label>
          <textarea
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder="อธิบายงานที่ต้องทำ..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none text-sm"
          />
          {/* char counter */}
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-slate-600">ต้องการอย่างน้อย 5 ตัวอักษร</span>
            <span className={`text-xs font-medium ${name.length >= 5 ? 'text-green-400' : 'text-slate-500'}`}>
              {name.length} ตัว
            </span>
          </div>
        </div>

        {/* Project picker */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 block">
            โปรเจกต์
          </label>

          {loadingProjects ? (
            <div className="flex gap-2">
              {[1, 2].map(i => (
                <div key={i} className="h-10 w-28 rounded-xl bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* none option */}
              <button
                onClick={() => setSelectedProject(null)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition active:scale-95 ${
                  selectedProject === null
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                ไม่ระบุ
              </button>

              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition active:scale-95 ${
                    selectedProject === p.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  📁 {p.name}
                </button>
              ))}

              {projects.length === 0 && (
                <p className="text-sm text-slate-600 py-1">ยังไม่ได้อยู่ในโปรเจกต์ใด</p>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-xl">
            ⚠️ {error}
          </div>
        )}

        {/* Preview card */}
        {name.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">ตัวอย่างการ์ดงาน</p>
            <p className="text-white font-medium text-sm leading-snug">{name}</p>
            {selectedProject !== null && (
              <p className="text-xs text-slate-400 mt-2">
                📁 {projects.find(p => p.id === selectedProject)?.name}
              </p>
            )}
            <span className="mt-2 inline-block text-xs px-2.5 py-1 rounded-full bg-blue-900/50 text-blue-300 font-medium">
              กำลังทำ
            </span>
          </div>
        )}
      </div>

      {/* Bottom button */}
      <div className="px-4 pb-8 pt-2">
        <button
          onClick={handleCreate}
          disabled={submitting || !isValid}
          className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              กำลังสร้าง...
            </span>
          ) : (
            '+ สร้างงาน'
          )}
        </button>
      </div>
    </div>
  )
}