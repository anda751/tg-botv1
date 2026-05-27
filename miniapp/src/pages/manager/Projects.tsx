import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ManagerNav from '../../components/ManagerNav'
import { projectApi } from '../../api'

type Member = {
  id: number
  display_name?: string
  username?: string
}

type Project = {
  id: number
  name: string
  deadline: string
  status_project: 'active' | 'closed'
  members?: Member[]
}

type JoinRequest = {
  id: number
  note?: string
  project?: { id: number; name: string }
  requested_by?: { id: number; display_name?: string; username?: string }
}

type ProjectTask = {
  id: number
  name: string
  status_task: 'in_progress' | 'under_review' | 'waiting_pickup' | 'done'
  current_owner?: { id: number; display_name?: string; username?: string } | null
  updatedAt?: string
}

type ProjectDetail = {
  project: Project
  summary: {
    total: number
    in_progress: number
    under_review: number
    waiting_pickup: number
    done: number
  }
  tasks: ProjectTask[]
}

const TASK_STATUS = {
  in_progress: { label: 'กำลังทำ', tone: 'blue' as const, icon: '◔' },
  under_review: { label: 'รอตรวจ', tone: 'amber' as const, icon: '!' },
  waiting_pickup: { label: 'รอรับช่วงต่อ', tone: 'orange' as const, icon: '↹' },
  done: { label: 'เสร็จแล้ว', tone: 'green' as const, icon: '✓' },
}

export default function Projects() {
  const location = useLocation()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [formError, setFormError] = useState('')
  const [pageError, setPageError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active')
  const [openProjectId, setOpenProjectId] = useState<number | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null)
  const [detailErrorById, setDetailErrorById] = useState<Record<number, string>>({})
  const [projectDetails, setProjectDetails] = useState<Record<number, ProjectDetail>>({})
  const highlightedTaskId = Number(new URLSearchParams(location.search).get('highlightTask') || '')

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    const openProject = Number(new URLSearchParams(location.search).get('open') || '')
    if (!Number.isFinite(openProject) || openProject <= 0) return
    if (!projects.some((project) => project.id === openProject)) return
    if (openProjectId === openProject) return
    void handleToggleProject(openProject)
  }, [location.search, projects])

  async function loadAll() {
    setLoading(true)
    setPageError('')
    setActionError('')
    try {
      const { data } = await projectApi.getHome()
      setProjects(Array.isArray(data?.projects) ? data.projects : [])
      setRequests(Array.isArray(data?.requests) ? data.requests : [])
    } catch (error: any) {
      setProjects([])
      setRequests([])
      setPageError(extractMessage(error, 'โหลดข้อมูลโปรเจกต์ไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }

  async function loadProjectDetail(projectId: number) {
    setDetailLoadingId(projectId)
    setDetailErrorById((current) => ({ ...current, [projectId]: '' }))
    try {
      const { data } = await projectApi.getDetail(projectId)
      setProjectDetails((current) => ({
        ...current,
        [projectId]: data,
      }))
    } catch (error: any) {
      setDetailErrorById((current) => ({
        ...current,
        [projectId]: extractMessage(error, 'โหลดงานของโปรเจกต์นี้ไม่สำเร็จ'),
      }))
    } finally {
      setDetailLoadingId(null)
    }
  }

  async function handleToggleProject(projectId: number) {
    if (openProjectId === projectId) {
      setOpenProjectId(null)
      return
    }

    setOpenProjectId(projectId)
    if (!projectDetails[projectId]) {
      await loadProjectDetail(projectId)
    }
  }

  async function handleCreate() {
    if (!newName.trim() || !newDeadline) {
      setFormError('กรอกชื่อโปรเจกต์และกำหนดส่งให้ครบ')
      return
    }

    setCreating(true)
    setFormError('')
    setActionError('')
    setActionSuccess('')

    try {
      await projectApi.create({
        name: newName.trim(),
        deadline: new Date(newDeadline).toISOString(),
      })
      setNewName('')
      setNewDeadline('')
      setActionSuccess('สร้างโปรเจกต์เรียบร้อย')
      await loadAll()
    } catch (error: any) {
      setFormError(extractMessage(error, 'สร้างโปรเจกต์ไม่สำเร็จ'))
    } finally {
      setCreating(false)
    }
  }

  async function handleCloseProject(projectId: number) {
    if (!confirm('ต้องการปิดโปรเจกต์นี้ใช่ไหม')) return

    setActionError('')
    setActionSuccess('')

    try {
      await projectApi.close(projectId)
      setActionSuccess('ปิดโปรเจกต์เรียบร้อย')
      if (openProjectId === projectId) setOpenProjectId(null)
      setProjectDetails((current) => {
        const next = { ...current }
        delete next[projectId]
        return next
      })
      await loadAll()
    } catch (error: any) {
      setActionError(extractMessage(error, 'ปิดโปรเจกต์ไม่สำเร็จ'))
    }
  }

  async function handleApproveRequest(requestId: number) {
    setApprovingId(requestId)
    setActionError('')
    setActionSuccess('')
    try {
      await projectApi.approveJoinRequest(requestId)
      setActionSuccess('อนุมัติคำขอเข้าโปรเจกต์เรียบร้อย')
      await loadAll()
    } catch (error: any) {
      setActionError(extractMessage(error, 'อนุมัติคำขอไม่สำเร็จ'))
    } finally {
      setApprovingId(null)
    }
  }

  async function handleRejectRequest(requestId: number) {
    const reason = prompt('เหตุผลที่ปฏิเสธ (ไม่บังคับ)') ?? ''
    setRejectingId(requestId)
    setActionError('')
    setActionSuccess('')
    try {
      await projectApi.rejectJoinRequest(requestId, reason)
      setActionSuccess('ปฏิเสธคำขอเข้าโปรเจกต์เรียบร้อย')
      await loadAll()
    } catch (error: any) {
      setActionError(extractMessage(error, 'ปฏิเสธคำขอไม่สำเร็จ'))
    } finally {
      setRejectingId(null)
    }
  }

  const visibleProjects = useMemo(() => {
    if (filter === 'all') return projects
    return projects.filter((project) => project.status_project === filter)
  }, [filter, projects])

  const activeCount = projects.filter((project) => project.status_project === 'active').length
  const closedCount = projects.filter((project) => project.status_project === 'closed').length

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">โปรเจกต์</h1>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              กดเปิดแต่ละโปรเจกต์เพื่อดูงานทั้งหมดที่เกี่ยวข้อง แยกให้เห็นชัดว่าอะไรต้องรีบตาม อะไรเสร็จแล้ว และใครกำลังรับผิดชอบ
            </p>
          </div>
          <button
            onClick={() => void loadAll()}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition shrink-0"
            title="รีเฟรช"
            aria-label="รีเฟรช"
          >
            ↻
          </button>
        </div>
        <ManagerNav />
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        {pageError && <InlineNotice tone="red" title="โหลดข้อมูลไม่สำเร็จ" message={pageError} />}
        {actionError && <InlineNotice tone="red" title="ทำรายการไม่สำเร็จ" message={actionError} />}
        {actionSuccess && <InlineNotice tone="green" title="ทำรายการสำเร็จ" message={actionSuccess} />}

        <div className="grid grid-cols-3 gap-2">
          <StatCard label="คำขอรออนุมัติ" value={String(requests.length)} />
          <StatCard label="โปรเจกต์ที่เปิด" value={String(activeCount)} />
          <StatCard label="โปรเจกต์ที่ปิดแล้ว" value={String(closedCount)} />
        </div>

        <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
          <p className="text-sm font-semibold text-white mb-3">สร้างโปรเจกต์ใหม่</p>
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="ชื่อโปรเจกต์"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
            />
            <input
              type="datetime-local"
              value={newDeadline}
              onChange={(event) => setNewDeadline(event.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
            />
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <button
              onClick={() => void handleCreate()}
              disabled={creating}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-50"
            >
              {creating ? 'กำลังสร้าง...' : 'สร้างโปรเจกต์'}
            </button>
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">คำขอเข้าโปรเจกต์</p>
            <span className="text-xs text-slate-400">{requests.length} รายการ</span>
          </div>
          {loading ? (
            <div className="h-12 bg-slate-800 rounded-xl animate-pulse" />
          ) : requests.length === 0 ? (
            <PanelState
              title="ยังไม่มีคำขอค้าง"
              message="เมื่อมีพนักงานขอเข้าโปรเจกต์ รายการจะมาแสดงตรงนี้"
            />
          ) : (
            <div className="space-y-2">
              {requests.map((request) => (
                <div key={request.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                  <p className="text-sm text-white leading-snug">
                    {displayName(request.requested_by)} ขอเข้าโปรเจกต์{' '}
                    <span className="font-semibold">{request.project?.name || '-'}</span>
                  </p>
                  {request.note && <p className="text-xs text-slate-400 mt-1">หมายเหตุ: {request.note}</p>}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => void handleRejectRequest(request.id)}
                      disabled={rejectingId === request.id}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-red-300 bg-red-950/40 border border-red-800/60 disabled:opacity-40"
                    >
                      {rejectingId === request.id ? 'กำลังส่ง...' : 'ปฏิเสธ'}
                    </button>
                    <button
                      onClick={() => void handleApproveRequest(request.id)}
                      disabled={approvingId === request.id}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-green-600 disabled:opacity-40"
                    >
                      {approvingId === request.id ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-white">รายการโปรเจกต์</p>
              <p className="text-xs text-slate-400 mt-1">เปิดดูได้ทีละโปรเจกต์เพื่อให้หน้าไม่รก</p>
            </div>
            <div className="flex gap-1">
              {([
                { key: 'active', label: 'เปิดอยู่' },
                { key: 'closed', label: 'ปิดแล้ว' },
                { key: 'all', label: 'ทั้งหมด' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    filter === tab.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-16 bg-slate-800 rounded-xl animate-pulse" />
          ) : visibleProjects.length === 0 ? (
            <PanelState
              title={filter === 'all' ? 'ยังไม่มีโปรเจกต์' : 'ไม่มีโปรเจกต์ในหมวดนี้'}
              message={
                filter === 'all'
                  ? 'เริ่มต้นด้วยการสร้างโปรเจกต์ใหม่ด้านบน'
                  : 'ลองสลับตัวกรองเพื่อดูรายการหมวดอื่น'
              }
            />
          ) : (
            <div className="space-y-3">
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  detail={projectDetails[project.id]}
                  expanded={openProjectId === project.id}
                  detailLoading={detailLoadingId === project.id}
                  detailError={detailErrorById[project.id]}
                  onToggle={() => void handleToggleProject(project.id)}
                  onClose={handleCloseProject}
                  highlightedTaskId={highlightedTaskId}
                  onOpenTask={(task) =>
                    navigate(
                      `/tasks?task=${task.id}&status=${task.status_task}&fromProject=${project.id}&projectName=${encodeURIComponent(project.name)}`,
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ProjectCard({
  project,
  detail,
  expanded,
  detailLoading,
  detailError,
  onToggle,
  onClose,
  highlightedTaskId,
  onOpenTask,
}: {
  project: Project
  detail?: ProjectDetail
  expanded: boolean
  detailLoading: boolean
  detailError?: string
  onToggle: () => void
  onClose: (id: number) => void
  highlightedTaskId?: number
  onOpenTask: (task: ProjectTask) => void
}) {
  const [taskSearch, setTaskSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<'all' | string>('all')
  const [detailView, setDetailView] = useState<'status' | 'owner'>('status')
  const overdue = isOverdue(project)
  const titleColor = overdue ? 'text-red-400' : 'text-green-400'
  const ownerOptions = useMemo(() => {
    const entries = (detail?.tasks ?? [])
      .map((task) => ({
        id: String(task.current_owner?.id ?? ''),
        name: displayName(task.current_owner) || 'ยังไม่ได้ระบุ',
      }))
      .filter((entry) => entry.id)

    return [...new Map(entries.map((entry) => [entry.id, entry])).values()].sort((left, right) =>
      left.name.localeCompare(right.name, 'th'),
    )
  }, [detail?.tasks])

  const filteredTasks = useMemo(() => {
    const query = taskSearch.trim().toLowerCase()

    return (detail?.tasks ?? []).filter((task) => {
      const matchesOwner = ownerFilter === 'all' || String(task.current_owner?.id ?? '') === ownerFilter
      const matchesSearch =
        !query ||
        task.name.toLowerCase().includes(query) ||
        displayName(task.current_owner).toLowerCase().includes(query)
      return matchesOwner && matchesSearch
    })
  }, [detail?.tasks, ownerFilter, taskSearch])

  const underReviewTasks = sortProjectTasks(filteredTasks.filter((task) => task.status_task === 'under_review'))
  const inProgressTasks = sortProjectTasks(filteredTasks.filter((task) => task.status_task === 'in_progress'))
  const waitingPickupTasks = sortProjectTasks(filteredTasks.filter((task) => task.status_task === 'waiting_pickup'))
  const doneTasks = sortProjectTasks(filteredTasks.filter((task) => task.status_task === 'done'))
  const ownerGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        id: string
        name: string
        tasks: ProjectTask[]
      }
    >()

    for (const task of sortProjectTasks(filteredTasks)) {
      const key = String(task.current_owner?.id ?? 'unassigned')
      const name = displayName(task.current_owner) || 'ยังไม่ได้ระบุ'
      const current = groups.get(key)

      if (current) {
        current.tasks.push(task)
      } else {
        groups.set(key, { id: key, name, tasks: [task] })
      }
    }

    return [...groups.values()].sort((left, right) => {
      if (right.tasks.length !== left.tasks.length) return right.tasks.length - left.tasks.length
      return left.name.localeCompare(right.name, 'th')
    })
  }, [filteredTasks])

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full p-3 text-left active:bg-slate-700/60 transition">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold truncate ${titleColor}`}>{project.name}</p>
              {project.status_project === 'closed' && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900 text-slate-400">
                  ปิดแล้ว
                </span>
              )}
              {overdue && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-950/50 text-red-300 border border-red-800/60">
                  เกินกำหนด
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">กำหนดส่ง {formatDateTime(project.deadline)}</p>
            <p className="text-xs text-slate-500 mt-1">สมาชิก {project.members?.length ?? 0} คน</p>
            {detail && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <MiniBadge tone="amber" text={`รอตรวจ ${detail.summary.under_review}`} />
                <MiniBadge tone="blue" text={`กำลังทำ ${detail.summary.in_progress}`} />
                <MiniBadge tone="orange" text={`รอรับช่วงต่อ ${detail.summary.waiting_pickup}`} />
                <MiniBadge tone="green" text={`เสร็จแล้ว ${detail.summary.done}`} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {project.status_project === 'active' && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(project.id)
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-red-950/40 border border-red-800/60"
              >
                ปิดโปรเจกต์
              </button>
            )}
            <span className="w-8 h-8 rounded-full border border-slate-600 bg-slate-900 text-slate-300 flex items-center justify-center text-sm font-bold">
              {expanded ? '−' : '+'}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700 px-3 py-3 space-y-3 bg-slate-900/60">
          {detailLoading ? (
            <div className="h-24 bg-slate-800 rounded-xl animate-pulse" />
          ) : detailError ? (
            <PanelState title="โหลดงานของโปรเจกต์ไม่สำเร็จ" message={detailError} />
          ) : !detail ? (
            <PanelState title="ยังไม่มีข้อมูลโปรเจกต์" message="ลองปิดแล้วเปิดรายละเอียดอีกครั้ง" />
          ) : (
            <>
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">ค้นหาในโปรเจกต์นี้</p>
                    <p className="text-xs text-slate-400 mt-1">กรองตามชื่องานหรือผู้รับผิดชอบ เพื่อให้หาเรื่องที่ต้องตามต่อได้เร็วขึ้น</p>
                  </div>
                  {(taskSearch || ownerFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setTaskSearch('')
                        setOwnerFilter('all')
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 active:bg-slate-700 transition"
                    >
                      ล้างตัวกรอง
                    </button>
                  )}
                </div>

                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
                  <input
                    type="text"
                    value={taskSearch}
                    onChange={(event) => setTaskSearch(event.target.value)}
                    placeholder="ค้นหาชื่องาน หรือชื่อผู้รับผิดชอบ"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
                  />
                  <select
                    value={ownerFilter}
                    onChange={(event) => setOwnerFilter(event.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="all">ทุกคนในโปรเจกต์</option>
                    {ownerOptions.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setDetailView('status')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      detailView === 'status' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    ดูตามสถานะ
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailView('owner')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      detailView === 'owner' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    ดูตามคน
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <StatCard label="งานที่มองอยู่" value={String(filteredTasks.length)} />
                <StatCard label="รอตรวจ" value={String(underReviewTasks.length)} />
                <StatCard label="กำลังทำ" value={String(inProgressTasks.length)} />
                <StatCard label="รอรับช่วงต่อ" value={String(waitingPickupTasks.length)} />
                <StatCard label="เสร็จแล้ว" value={String(doneTasks.length)} />
              </div>

              {filteredTasks.length !== detail.summary.total && (
                <div className="rounded-xl border border-blue-800/60 bg-blue-950/30 px-3 py-2.5">
                  <p className="text-xs text-blue-200">
                    ตอนนี้กำลังแสดง {filteredTasks.length} จากทั้งหมด {detail.summary.total} งานในโปรเจกต์นี้
                  </p>
                </div>
              )}

              {detailView === 'status' ? (
                <>
                  <TaskGroup
                    title="งานที่ควรเปิดดูก่อน"
                    description="รวมงานที่รอหัวหน้าตรวจ เพื่อให้รู้ทันทีว่าต้องตัดสินใจอะไรบ้าง"
                    tone="amber"
                    tasks={underReviewTasks}
                    emptyText="ยังไม่มีงานรอตรวจในโปรเจกต์นี้"
                    highlightedTaskId={highlightedTaskId}
                    onOpenTask={onOpenTask}
                  />
                  <TaskGroup
                    title="งานที่กำลังเดินอยู่"
                    description="ดูว่าใครกำลังทำอะไรอยู่ และงานไหนเพิ่งมีความเคลื่อนไหวล่าสุด"
                    tone="blue"
                    tasks={inProgressTasks}
                    emptyText="ยังไม่มีงานที่กำลังทำในโปรเจกต์นี้"
                    highlightedTaskId={highlightedTaskId}
                    onOpenTask={onOpenTask}
                  />
                  <TaskGroup
                    title="งานรอรับช่วงต่อ"
                    description="ใช้ตามงานที่ถูกส่งต่อและยังรอคนรับผิดชอบคนถัดไป"
                    tone="orange"
                    tasks={waitingPickupTasks}
                    emptyText="ยังไม่มีงานรอรับช่วงต่อ"
                    highlightedTaskId={highlightedTaskId}
                    onOpenTask={onOpenTask}
                  />
                  <TaskGroup
                    title="งานที่เสร็จแล้ว"
                    description="สรุปงานที่ปิดเรียบร้อยแล้วในโปรเจกต์นี้"
                    tone="green"
                    tasks={doneTasks}
                    emptyText="ยังไม่มีงานที่เสร็จแล้ว"
                    highlightedTaskId={highlightedTaskId}
                    onOpenTask={onOpenTask}
                  />
                </>
              ) : (
                <OwnerGroupList
                  groups={ownerGroups}
                  highlightedTaskId={highlightedTaskId}
                  onOpenTask={onOpenTask}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TaskGroup({
  title,
  description,
  tone,
  tasks,
  emptyText,
  highlightedTaskId,
  onOpenTask,
}: {
  title: string
  description: string
  tone: 'blue' | 'amber' | 'orange' | 'green'
  tasks: ProjectTask[]
  emptyText: string
  highlightedTaskId?: number
  onOpenTask: (task: ProjectTask) => void
}) {
  const toneMap = {
    blue: 'text-blue-300 bg-blue-950/30 border-blue-800/50',
    amber: 'text-amber-300 bg-amber-950/30 border-amber-800/50',
    orange: 'text-orange-300 bg-orange-950/30 border-orange-800/50',
    green: 'text-green-300 bg-green-950/30 border-green-800/50',
  } as const

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-800 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-400 mt-1">{description}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${toneMap[tone]}`}>
          {tasks.length} งาน
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="px-3 py-3 text-xs text-slate-500">{emptyText}</p>
      ) : (
        <div className="divide-y divide-slate-800">
          {tasks.map((task) => {
            const status = TASK_STATUS[task.status_task]
            const isHighlighted = task.id === highlightedTaskId
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task)}
                className={`w-full px-3 py-3 text-left transition ${
                  isHighlighted
                    ? 'bg-blue-950/30 ring-1 ring-inset ring-blue-500/60'
                    : 'active:bg-slate-900/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${statusIconClass(
                          status.tone,
                        )}`}
                        title={status.label}
                        aria-label={status.label}
                      >
                        {status.icon}
                      </span>
                      <p className="text-sm font-semibold text-white leading-snug">{task.name}</p>
                      {isHighlighted && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950/70 text-blue-200 border border-blue-800/70">
                          งานล่าสุด
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      ผู้รับผิดชอบ {displayName(task.current_owner) || 'ยังไม่ได้ระบุ'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      อัปเดตล่าสุด {task.updatedAt ? formatDateTime(task.updatedAt) : '-'}
                    </p>
                    <p className="text-[11px] text-blue-300 mt-2">กดเพื่อไปหน้าจัดการงานนี้</p>
                  </div>
                  <MiniBadge tone={status.tone} text={status.label} />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OwnerGroupList({
  groups,
  highlightedTaskId,
  onOpenTask,
}: {
  groups: { id: string; name: string; tasks: ProjectTask[] }[]
  highlightedTaskId?: number
  onOpenTask: (task: ProjectTask) => void
}) {
  if (groups.length === 0) {
    return (
      <PanelState
        title="ยังไม่มีงานตามเงื่อนไขที่เลือก"
        message="ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา แล้วดูงานตามคนอีกครั้ง"
      />
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const counts = {
          under_review: group.tasks.filter((task) => task.status_task === 'under_review').length,
          in_progress: group.tasks.filter((task) => task.status_task === 'in_progress').length,
          waiting_pickup: group.tasks.filter((task) => task.status_task === 'waiting_pickup').length,
          done: group.tasks.filter((task) => task.status_task === 'done').length,
        }

        return (
          <div key={group.id} className="rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
            <div className="px-3 py-3 border-b border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{group.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{group.tasks.length} งานในมุมมองปัจจุบัน</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {counts.under_review > 0 && <MiniBadge tone="amber" text={`รอตรวจ ${counts.under_review}`} />}
                  {counts.in_progress > 0 && <MiniBadge tone="blue" text={`กำลังทำ ${counts.in_progress}`} />}
                  {counts.waiting_pickup > 0 && <MiniBadge tone="orange" text={`รอรับช่วงต่อ ${counts.waiting_pickup}`} />}
                  {counts.done > 0 && <MiniBadge tone="green" text={`เสร็จแล้ว ${counts.done}`} />}
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-800">
              {group.tasks.map((task) => {
                const status = TASK_STATUS[task.status_task]
                const isHighlighted = task.id === highlightedTaskId

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpenTask(task)}
                    className={`w-full px-3 py-3 text-left transition ${
                      isHighlighted
                        ? 'bg-blue-950/30 ring-1 ring-inset ring-blue-500/60'
                        : 'active:bg-slate-900/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${statusIconClass(
                              status.tone,
                            )}`}
                            title={status.label}
                            aria-label={status.label}
                          >
                            {status.icon}
                          </span>
                          <p className="text-sm font-semibold text-white leading-snug">{task.name}</p>
                          {isHighlighted && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950/70 text-blue-200 border border-blue-800/70">
                              งานล่าสุด
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2">
                          อัปเดตล่าสุด {task.updatedAt ? formatDateTime(task.updatedAt) : '-'}
                        </p>
                        <p className="text-[11px] text-blue-300 mt-2">กดเพื่อไปหน้าจัดการงานนี้</p>
                      </div>
                      <MiniBadge tone={status.tone} text={status.label} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-lg font-bold text-white leading-tight">{value}</p>
    </div>
  )
}

function MiniBadge({ tone, text }: { tone: 'blue' | 'amber' | 'orange' | 'green'; text: string }) {
  const toneMap = {
    blue: 'text-blue-300 bg-blue-950/30 border-blue-800/50',
    amber: 'text-amber-300 bg-amber-950/30 border-amber-800/50',
    orange: 'text-orange-300 bg-orange-950/30 border-orange-800/50',
    green: 'text-green-300 bg-green-950/30 border-green-800/50',
  } as const

  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${toneMap[tone]}`}>{text}</span>
}

function statusIconClass(tone: 'blue' | 'amber' | 'orange' | 'green') {
  const toneMap = {
    blue: 'border-blue-800/60 bg-blue-950/40 text-blue-200',
    amber: 'border-amber-800/60 bg-amber-950/40 text-amber-200',
    orange: 'border-orange-800/60 bg-orange-950/40 text-orange-200',
    green: 'border-green-800/60 bg-green-950/40 text-green-200',
  } as const

  return toneMap[tone]
}

function sortProjectTasks(tasks: ProjectTask[]) {
  return [...tasks].sort((left, right) => {
    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0
    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0

    if (rightTime !== leftTime) return rightTime - leftTime
    return left.name.localeCompare(right.name, 'th')
  })
}

function InlineNotice({
  tone,
  title,
  message,
}: {
  tone: 'red' | 'green'
  title: string
  message: string
}) {
  const toneClass =
    tone === 'green'
      ? 'border-green-800/70 bg-green-950/40 text-green-100'
      : 'border-red-800/70 bg-red-950/40 text-red-100'

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs mt-1 opacity-90">{message}</p>
    </div>
  )
}

function PanelState({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-5 text-center">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-slate-400 mt-2">{message}</p>
    </div>
  )
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
}

function displayName(user?: { display_name?: string; username?: string } | null) {
  return user?.display_name || user?.username || ''
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('th-TH')
}

function isOverdue(project: Project) {
  return project.status_project === 'active' && new Date(project.deadline).getTime() < Date.now()
}
