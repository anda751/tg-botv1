import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerNav from '../../components/ManagerNav'
import { projectApi, userApi } from '../../api'

type Project = {
  id: number
  name: string
  deadline: string
  status_project: 'active' | 'closed'
  creator?: { display_name: string }
  members?: { id: number; display_name: string; username: string }[]
}

type Staff = { id: number; display_name: string; username: string }

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'closed'>('active')

  // create modal
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // member modal
  const [memberProject, setMemberProject] = useState<Project | null>(null)
  const [allStaff, setAllStaff] = useState<Staff[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [memberAction, setMemberAction] = useState<number | null>(null)

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    setLoading(true)
    try {
      const { data } = await projectApi.getAll()
      const list = Array.isArray(data) ? data : (data.data ?? [])
      setProjects(list)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName || newName.length < 2) { setCreateError('ชื่อต้องมีอย่างน้อย 2 ตัวอักษร'); return }
    if (!newDeadline) { setCreateError('กรุณาเลือกเดดไลน์'); return }
    setCreateError('')
    setCreating(true)
    try {
      await projectApi.create({ name: newName, deadline: newDeadline })
      setShowCreate(false)
      setNewName('')
      setNewDeadline('')
      await loadProjects()
    } catch (err: any) {
      setCreateError(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setCreating(false)
    }
  }

  async function handleClose(id: number) {
    if (!confirm('ปิดโปรเจกต์นี้?')) return
    try {
      await projectApi.close(id)
      await loadProjects()
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    }
  }

  async function openMemberModal(project: Project) {
    setMemberProject(project)
    setLoadingStaff(true)
    try {
      const { data } = await userApi.me() // just to check — in real: fetch all staff
      // fetch staff via dashboard staffOverview
      const { dashboardApi } = await import('../../api')
      const { data: staffData } = await dashboardApi.staffOverview()
      setAllStaff(Array.isArray(staffData) ? staffData : [])
    } catch {
      setAllStaff([])
    } finally {
      setLoadingStaff(false)
    }
  }

  async function handleAddMember(projectId: number, userId: number) {
    setMemberAction(userId)
    try {
      await projectApi.addMember(projectId, userId)
      // refresh member list
      const { data } = await projectApi.getAll()
      const list = Array.isArray(data) ? data : (data.data ?? [])
      setProjects(list)
      const updated = list.find((p: Project) => p.id === projectId) ?? null
      setMemberProject(updated)
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setMemberAction(null)
    }
  }

  async function handleRemoveMember(projectId: number, userId: number) {
    setMemberAction(userId)
    try {
      await projectApi.removeMember(projectId, userId)
      const { data } = await projectApi.getAll()
      const list = Array.isArray(data) ? data : (data.data ?? [])
      setProjects(list)
      const updated = list.find((p: Project) => p.id === projectId) ?? null
      setMemberProject(updated)
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setMemberAction(null)
    }
  }

  const filtered = projects.filter(p => p.status_project === filter)

  function deadlineLabel(deadline: string) {
    const d = new Date(deadline)
    const now = new Date()
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { text: `เกินกำหนด ${Math.abs(diff)} วัน`, color: 'text-red-400' }
    if (diff === 0) return { text: 'วันนี้!', color: 'text-red-400' }
    if (diff <= 3) return { text: `เหลือ ${diff} วัน`, color: 'text-amber-400' }
    return { text: d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }), color: 'text-slate-400' }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Projects</h1>
            <p className="text-xs text-slate-400 mt-0.5">จัดการโปรเจกต์</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 transition"
          >
            + สร้าง
          </button>
        </div>

        <ManagerNav />
      </div>

      {/* Filter */}
      <div className="px-4 pt-4 flex gap-2">
        {(['active', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'
            }`}
          >
            {f === 'active' ? '🟢 Active' : '🔴 Closed'}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">
        {/* Skeletons */}
        {loading && [1,2,3].map(i => (
          <div key={i} className="bg-slate-900 rounded-2xl p-4 animate-pulse h-32" />
        ))}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">📁</div>
            <p className="text-slate-300 font-semibold">ไม่มีโปรเจกต์</p>
            <p className="text-slate-500 text-sm mt-1">
              {filter === 'active' ? 'กด "+ สร้าง" เพื่อเริ่มต้น' : 'ยังไม่มีโปรเจกต์ที่ปิดแล้ว'}
            </p>
          </div>
        )}

        {/* Project cards */}
        {!loading && filtered.map(project => {
          const dl = deadlineLabel(project.deadline)
          return (
            <div key={project.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-white font-semibold text-sm leading-snug flex-1">{project.name}</p>
                {project.status_project === 'active' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300 font-medium shrink-0">
                    Active
                  </span>
                )}
              </div>

              {/* Deadline */}
              <p className={`text-xs font-medium mb-3 ${dl.color}`}>
                📅 {dl.text}
              </p>

              {/* Members avatars */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex -space-x-2">
                  {(project.members ?? []).slice(0, 5).map(m => (
                    <div
                      key={m.id}
                      className="w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-slate-300"
                      title={m.display_name || m.username}
                    >
                      {(m.display_name || m.username)?.[0]?.toUpperCase()}
                    </div>
                  ))}
                  {(project.members?.length ?? 0) > 5 && (
                    <div className="w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs text-slate-400">
                      +{(project.members?.length ?? 0) - 5}
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {project.members?.length ?? 0} คน
                </span>
              </div>

              {/* Actions */}
              {project.status_project === 'active' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => openMemberModal(project)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 active:bg-slate-700 transition"
                  >
                    👥 จัดการสมาชิก
                  </button>
                  <button
                    onClick={() => handleClose(project.id)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-red-300 bg-red-950/40 border border-red-800/50 active:bg-red-900/50 transition"
                  >
                    ปิด
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <Modal title="สร้างโปรเจกต์ใหม่" onClose={() => { setShowCreate(false); setCreateError('') }}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">
                ชื่อโปรเจกต์
              </label>
              <input
                type="text"
                placeholder="กรอกชื่อโปรเจกต์"
                value={newName}
                onChange={e => { setNewName(e.target.value); setCreateError('') }}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-600 outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">
                เดดไลน์
              </label>
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={e => { setNewDeadline(e.target.value); setCreateError('') }}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white outline-none focus:border-blue-500 text-sm"
              />
            </div>
            {createError && (
              <p className="text-red-400 text-sm">⚠️ {createError}</p>
            )}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 active:scale-95 transition-all disabled:opacity-50"
            >
              {creating ? 'กำลังสร้าง...' : 'สร้างโปรเจกต์'}
            </button>
          </div>
        </Modal>
      )}

      {/* Member modal */}
      {memberProject && (
        <Modal title={`สมาชิก — ${memberProject.name}`} onClose={() => setMemberProject(null)}>
          {loadingStaff ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {allStaff.map(staff => {
                const isMember = memberProject.members?.some(m => m.id === staff.id)
                const isLoading = memberAction === staff.id
                return (
                  <div key={staff.id} className="flex items-center gap-3 py-2">
                    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300 shrink-0">
                      {(staff.display_name || staff.username)?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {staff.display_name || staff.username}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        isMember
                          ? handleRemoveMember(memberProject.id, staff.id)
                          : handleAddMember(memberProject.id, staff.id)
                      }
                      disabled={isLoading}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                        isMember
                          ? 'text-red-300 bg-red-950/50 border border-red-800'
                          : 'text-green-300 bg-green-950/50 border border-green-800'
                      } disabled:opacity-40`}
                    >
                      {isLoading ? '...' : isMember ? 'นำออก' : '+ เพิ่ม'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl p-6 pb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none active:text-slate-200">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}