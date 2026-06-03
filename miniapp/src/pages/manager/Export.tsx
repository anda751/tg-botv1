import { useEffect, useMemo, useState } from 'react'
import ManagerNav from '../../components/ManagerNav'
import { dashboardApi, projectApi } from '../../api'

type Project = {
  id: number
  name: string
  deadline: string
  status_project: 'active' | 'closed'
}

type StaffStat = {
  id: number
  display_name: string
  username: string
  telegram_id: string
  active_tasks: number
}

type ReportsResponse = {
  summary: {
    tasks: { total: number; in_progress: number; under_review: number; waiting_pickup: number; done: number }
    projects: { total: number; active: number; overdue: number }
    staff: { total: number }
  }
  staff: StaffStat[]
}

type KpiMember = {
  display_name: string
  username: string
  completed_tasks: number
  rejection_rate: number
  active_tasks: number
  active_in_progress: number
  active_under_review: number
  active_waiting_pickup: number
  stale_active_tasks: number
  on_time_rate: number | null
  avg_completion_hours: number | null
  update_rate: number
  total_score: number
  focus_note: string
  status: { label: string }
}

type KpiResponse = {
  window_days: number
  generated_at: string
  staff: KpiMember[]
}

type HistoryItem = {
  occurred_at: string
  category: string
  action: string
  title: string
  summary: string
  detail: string
  actor: string
  subject_user: string
  task: { name: string } | null
  project: { name: string } | null
}

type HistoryResponse = {
  window_days: number
  generated_at: string
  items: HistoryItem[]
}

type PendingTask = {
  id: number
  name: string
  status_task: string
  current_owner: { display_name?: string; username?: string } | null
  created_at: string
  log_count: number
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
  tasks: Array<{
    id: number
    name: string
    status_task: string
    updatedAt?: string
    current_owner?: { display_name?: string; username?: string } | null
  }>
}

type GeneratedFile = {
  name: string
  url: string
  content: string
}

const DAY_OPTIONS = [7, 14, 30, 60]

export default function ExportPage() {
  const [days, setDays] = useState(30)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('')
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [pageError, setPageError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])

  useEffect(() => {
    void loadProjects()
  }, [])

  useEffect(() => {
    return () => {
      generatedFiles.forEach((file) => URL.revokeObjectURL(file.url))
    }
  }, [generatedFiles])

  async function loadProjects() {
    setLoadingProjects(true)
    setPageError('')
    try {
      const { data } = await projectApi.getHome()
      setProjects(Array.isArray(data?.projects) ? data.projects : [])
    } catch (error) {
      setProjects([])
      setPageError(extractMessage(error, 'โหลดรายการโปรเจกต์สำหรับส่งออกไม่สำเร็จ'))
    } finally {
      setLoadingProjects(false)
    }
  }

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  async function runExport(key: string, work: () => Promise<GeneratedFile[]>) {
    setBusyKey(key)
    setActionError('')
    setActionSuccess('')
    try {
      const files = await work()
      setGeneratedFiles((previous) => {
        previous.forEach((file) => URL.revokeObjectURL(file.url))
        return files
      })
      files.forEach((file) => {
        const didDownload = triggerDownload(file)
        if (!didDownload) {
          openFilePreview(file)
        }
      })
      setActionSuccess(
        files.length > 1
          ? `เตรียมไฟล์ส่งออก ${files.length} ไฟล์แล้ว ถ้าดาวน์โหลดไม่เริ่มเอง ให้กด ดาวน์โหลด เปิดดู หรือ คัดลอก CSV จากรายการด้านล่าง`
          : 'เตรียมไฟล์ส่งออกเรียบร้อยแล้ว ถ้าดาวน์โหลดไม่เริ่มเอง ให้กด ดาวน์โหลด เปิดดู หรือ คัดลอก CSV จากรายการด้านล่าง',
      )
    } catch (error) {
      setActionError(extractMessage(error, 'ส่งออกข้อมูลไม่สำเร็จ'))
    } finally {
      setBusyKey(null)
    }
  }

  async function exportBundle() {
    await runExport('bundle', async () => {
      const [reportsRes, kpiRes, historyRes, tasksRes] = await Promise.all([
        dashboardApi.reports(),
        dashboardApi.staffKpi(days),
        dashboardApi.history(days),
        dashboardApi.pendingTasks(),
      ])

      return [
        createCsvDownload(`reports-summary-${dateStamp()}.csv`, buildReportsRows(reportsRes.data as ReportsResponse)),
        createCsvDownload(`kpi-${days}d-${dateStamp()}.csv`, buildKpiRows(kpiRes.data as KpiResponse)),
        createCsvDownload(`history-${days}d-${dateStamp()}.csv`, buildHistoryRows(historyRes.data as HistoryResponse)),
        createCsvDownload(`tasks-open-${dateStamp()}.csv`, buildPendingTaskRows(reportsSafeArray(tasksRes.data))),
      ]
    })
  }

  async function exportReports() {
    await runExport('reports', async () => {
      const { data } = await dashboardApi.reports()
      return [createCsvDownload(`reports-summary-${dateStamp()}.csv`, buildReportsRows(data as ReportsResponse))]
    })
  }

  async function exportKpi() {
    await runExport('kpi', async () => {
      const { data } = await dashboardApi.staffKpi(days)
      return [createCsvDownload(`kpi-${days}d-${dateStamp()}.csv`, buildKpiRows(data as KpiResponse))]
    })
  }

  async function exportHistory() {
    await runExport('history', async () => {
      const { data } = await dashboardApi.history(days)
      return [createCsvDownload(`history-${days}d-${dateStamp()}.csv`, buildHistoryRows(data as HistoryResponse))]
    })
  }

  async function exportTasks() {
    await runExport('tasks', async () => {
      const { data } = await dashboardApi.pendingTasks()
      return [createCsvDownload(`tasks-open-${dateStamp()}.csv`, buildPendingTaskRows(reportsSafeArray(data)))]
    })
  }

  async function exportProjects() {
    await runExport('projects', async () => {
      return [createCsvDownload(`projects-${dateStamp()}.csv`, buildProjectRows(projects))]
    })
  }

  async function exportProjectDetail() {
    if (!selectedProjectId) {
      setActionError('เลือกโปรเจกต์ก่อนส่งออกรายละเอียด')
      return
    }

    await runExport('project-detail', async () => {
      const { data } = await projectApi.getDetail(Number(selectedProjectId))
      return [
        createCsvDownload(
          `project-${slugify(selectedProject?.name || String(selectedProjectId))}-${dateStamp()}.csv`,
          buildProjectDetailRows(data as ProjectDetail),
        ),
      ]
    })
  }

  function clearGeneratedFiles() {
    setGeneratedFiles((previous) => {
      previous.forEach((file) => URL.revokeObjectURL(file.url))
      return []
    })
  }

  async function copyCsv(file: GeneratedFile) {
    try {
      await navigator.clipboard.writeText(file.content)
      setActionError('')
      setActionSuccess(`คัดลอก ${file.name} ไปยังคลิปบอร์ดแล้ว`)
    } catch {
      setActionError('คัดลอกข้อมูลไม่สำเร็จ ลองใช้ปุ่มเปิดดูแล้วคัดลอกจากแท็บที่เปิดแทน')
    }
  }

  return (
    <div className="panel-shell min-h-screen bg-slate-950 flex flex-col transition-colors">
      <div className="panel-header bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4 transition-colors">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-white">ศูนย์ส่งออกรายงาน</h1>
          <p className="text-sm text-slate-400 mt-1">
            รวมปุ่มส่งออกไว้หน้าเดียว เลือกใช้ได้ทั้งรายงาน KPI ประวัติ งาน และโปรเจกต์
          </p>
        </div>
        <ManagerNav />
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 pb-8 page-enter">
        {pageError && <NoticeBox tone="red" title="โหลดข้อมูลไม่สำเร็จ" message={pageError} />}
        {actionError && <NoticeBox tone="red" title="ส่งออกไม่สำเร็จ" message={actionError} />}
        {actionSuccess && <NoticeBox tone="blue" title="ไฟล์พร้อมใช้งาน" message={actionSuccess} />}

        {generatedFiles.length > 0 && (
          <section className="panel-surface bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 panel-enter interactive-lift">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">ไฟล์ที่พร้อมใช้งาน</p>
                <p className="text-xs text-slate-400 mt-1">
                  ถ้าใน Telegram หรือ webview ไม่ยอมดาวน์โหลด ให้ใช้ปุ่ม เปิดดู หรือ คัดลอก CSV แทนได้ทันที
                </p>
              </div>
              <button
                onClick={clearGeneratedFiles}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 active:bg-slate-700 transition"
              >
                ล้างรายการ
              </button>
            </div>

            <div className="space-y-2">
              {generatedFiles.map((file) => (
                <div
                  key={file.url}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white break-all">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-1">ไฟล์ CSV พร้อมเปิดด้วย Excel หรือคัดลอกไปใช้งานต่อ</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => triggerDownload(file)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white active:bg-blue-700 transition"
                    >
                      ดาวน์โหลด
                    </button>
                    <button
                      onClick={() => openFilePreview(file)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 active:bg-slate-700 transition"
                    >
                      เปิดดู
                    </button>
                    <button
                      onClick={() => void copyCsv(file)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white active:bg-emerald-700 transition"
                    >
                      คัดลอก CSV
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="panel-surface bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-4 panel-enter interactive-lift">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">ชุดส่งออกหลัก</p>
              <p className="text-xs text-slate-400 mt-1">
                ดาวน์โหลดไฟล์ที่หัวหน้าใช้บ่อยในครั้งเดียว: รายงานภาพรวม, KPI, ประวัติการทำรายการ และงานที่ยังไม่ปิด
              </p>
            </div>
            <button
              onClick={() => void exportBundle()}
              disabled={busyKey !== null}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition"
            >
              {busyKey === 'bundle' ? 'กำลังเตรียมไฟล์...' : 'ส่งออกชุดหลัก'}
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {DAY_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setDays(option)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                  days === option ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 active:bg-slate-700'
                }`}
              >
                {option} วัน
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5">
            <p className="text-xs text-slate-300">
              ช่วงเวลานี้จะใช้กับ <span className="font-semibold text-white">KPI</span> และ{' '}
              <span className="font-semibold text-white">ประวัติการทำรายการ</span>
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ExportCard
            title="รายงานภาพรวม"
            description="สรุปจำนวนงาน โปรเจกต์ และภาระงานทีม"
            buttonLabel="ส่งออก CSV"
            busy={busyKey === 'reports'}
            onExport={() => void exportReports()}
          />
          <ExportCard
            title={`KPI รายคน (${days} วัน)`}
            description="คะแนนรวม ผลงานรายคน และข้อสังเกตที่ควรตามต่อ"
            buttonLabel="ส่งออก CSV"
            busy={busyKey === 'kpi'}
            onExport={() => void exportKpi()}
          />
          <ExportCard
            title={`ประวัติการทำรายการ (${days} วัน)`}
            description="รวมการอนุมัติ ส่งกลับ และการจัดการโปรเจกต์ย้อนหลัง"
            buttonLabel="ส่งออก CSV"
            busy={busyKey === 'history'}
            onExport={() => void exportHistory()}
          />
          <ExportCard
            title="งานที่ยังไม่ปิด"
            description="งานที่กำลังทำ รอตรวจ และรอรับช่วงต่อในมุมของหัวหน้า"
            buttonLabel="ส่งออก CSV"
            busy={busyKey === 'tasks'}
            onExport={() => void exportTasks()}
          />
          <ExportCard
            title="รายการโปรเจกต์"
            description="ภาพรวมโปรเจกต์ทั้งหมดพร้อมสถานะและกำหนดส่ง"
            buttonLabel="ส่งออก CSV"
            busy={busyKey === 'projects'}
            onExport={() => void exportProjects()}
          />

          <div className="panel-surface bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 panel-enter interactive-lift">
            <div>
              <p className="text-sm font-semibold text-white">รายละเอียดงานตามโปรเจกต์</p>
              <p className="text-xs text-slate-400 mt-1">
                เลือกโปรเจกต์หนึ่งตัว แล้วส่งออกงานทั้งหมดในโปรเจกต์นั้นพร้อมสถานะและผู้รับผิดชอบ
              </p>
            </div>
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value ? Number(event.target.value) : '')}
              disabled={loadingProjects}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
            >
              <option value="">{loadingProjects ? 'กำลังโหลดโปรเจกต์...' : 'เลือกโปรเจกต์'}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => void exportProjectDetail()}
              disabled={busyKey !== null || !selectedProjectId}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition"
            >
              {busyKey === 'project-detail' ? 'กำลังเตรียมไฟล์...' : 'ส่งออกรายละเอียดโปรเจกต์'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function ExportCard({
  title,
  description,
  buttonLabel,
  busy,
  onExport,
}: {
  title: string
  description: string
  buttonLabel: string
  busy: boolean
  onExport: () => void
}) {
  return (
    <div className="panel-surface bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 panel-enter interactive-lift">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>
      <button
        onClick={onExport}
        disabled={busy}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition"
      >
        {busy ? 'กำลังเตรียมไฟล์...' : buttonLabel}
      </button>
    </div>
  )
}

function NoticeBox({ tone, title, message }: { tone: 'blue' | 'red'; title: string; message: string }) {
  const toneClass =
    tone === 'blue'
      ? 'border-blue-800/70 bg-blue-950/40 text-blue-100'
      : 'border-red-800/70 bg-red-950/40 text-red-100'
  return (
    <div className={`notice-enter rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs mt-1 opacity-90 whitespace-pre-line">{message}</p>
    </div>
  )
}

function buildReportsRows(data: ReportsResponse): string[][] {
  const rows: string[][] = [
    ['หมวด', 'รายการ', 'ค่า'],
    ['สรุปงาน', 'งานทั้งหมด', String(data.summary.tasks.total)],
    ['สรุปงาน', 'กำลังทำ', String(data.summary.tasks.in_progress)],
    ['สรุปงาน', 'รอตรวจ', String(data.summary.tasks.under_review)],
    ['สรุปงาน', 'รอรับช่วงต่อ', String(data.summary.tasks.waiting_pickup)],
    ['สรุปงาน', 'เสร็จแล้ว', String(data.summary.tasks.done)],
    ['สรุปโปรเจกต์', 'โปรเจกต์ทั้งหมด', String(data.summary.projects.total)],
    ['สรุปโปรเจกต์', 'โปรเจกต์ที่เปิดอยู่', String(data.summary.projects.active)],
    ['สรุปโปรเจกต์', 'โปรเจกต์เกินกำหนด', String(data.summary.projects.overdue)],
    ['สรุปทีม', 'พนักงานทั้งหมด', String(data.summary.staff.total)],
    [],
    ['พนักงาน', 'ชื่อแสดง', 'ชื่อผู้ใช้', 'งานที่เปิดอยู่'],
  ]

  for (const member of data.staff) {
    rows.push(['พนักงาน', member.display_name || '-', member.username || '-', String(member.active_tasks)])
  }

  return rows
}

function buildKpiRows(data: KpiResponse): string[][] {
  return [
    [
      'ชื่อแสดง',
      'ชื่อผู้ใช้',
      'สถานะ',
      'คะแนนรวม',
      'งานที่เสร็จแล้ว',
      'งานที่กำลังทำ',
      'กำลังทำ',
      'รอตรวจ',
      'รอรับช่วงต่อ',
      'งานค้างนิ่ง',
      'อัตราตีกลับ (%)',
      'อัตราตรงเวลา (%)',
      'เวลาปิดเฉลี่ย (ชม.)',
      'อัตราอัปเดต (%)',
      'ข้อสังเกต',
    ],
    ...data.staff.map((member) => [
      member.display_name,
      member.username,
      member.status.label,
      String(member.total_score),
      String(member.completed_tasks),
      String(member.active_tasks),
      String(member.active_in_progress),
      String(member.active_under_review),
      String(member.active_waiting_pickup),
      String(member.stale_active_tasks),
      String(member.rejection_rate),
      member.on_time_rate == null ? '-' : String(member.on_time_rate),
      member.avg_completion_hours == null ? '-' : String(member.avg_completion_hours),
      String(member.update_rate),
      member.focus_note,
    ]),
  ]
}

function buildHistoryRows(data: HistoryResponse): string[][] {
  return [
    ['วันที่', 'หมวด', 'การกระทำ', 'หัวข้อ', 'สรุป', 'รายละเอียด', 'ผู้ดำเนินการ', 'ผู้เกี่ยวข้อง', 'งาน', 'โปรเจกต์'],
    ...data.items.map((item) => [
      item.occurred_at,
      item.category,
      item.action,
      item.title,
      item.summary,
      item.detail,
      item.actor,
      item.subject_user,
      item.task?.name || '-',
      item.project?.name || '-',
    ]),
  ]
}

function buildPendingTaskRows(tasks: PendingTask[]): string[][] {
  return [
    ['ชื่องาน', 'สถานะ', 'ผู้รับผิดชอบ', 'สร้างเมื่อ', 'จำนวนความเคลื่อนไหว'],
    ...tasks.map((task) => [
      task.name,
      task.status_task,
      task.current_owner?.display_name || task.current_owner?.username || '-',
      task.created_at,
      String(task.log_count),
    ]),
  ]
}

function buildProjectRows(projects: Project[]): string[][] {
  return [['ชื่อโปรเจกต์', 'สถานะ', 'กำหนดส่ง'], ...projects.map((project) => [project.name, project.status_project, project.deadline])]
}

function buildProjectDetailRows(detail: ProjectDetail): string[][] {
  const rows: string[][] = [
    ['ชื่อโปรเจกต์', detail.project.name],
    ['สถานะ', detail.project.status_project],
    ['กำหนดส่ง', detail.project.deadline],
    ['งานทั้งหมด', String(detail.summary.total)],
    ['กำลังทำ', String(detail.summary.in_progress)],
    ['รอตรวจ', String(detail.summary.under_review)],
    ['รอรับช่วงต่อ', String(detail.summary.waiting_pickup)],
    ['เสร็จแล้ว', String(detail.summary.done)],
    [],
    ['ชื่องาน', 'สถานะ', 'ผู้รับผิดชอบ', 'อัปเดตล่าสุด'],
  ]

  for (const task of detail.tasks) {
    rows.push([
      task.name,
      task.status_task,
      task.current_owner?.display_name || task.current_owner?.username || '-',
      task.updatedAt || '-',
    ])
  }

  return rows
}

function reportsSafeArray(value: unknown) {
  return Array.isArray(value) ? (value as PendingTask[]) : []
}

function createCsvDownload(filename: string, rows: string[][]): GeneratedFile {
  const content = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  return {
    name: filename,
    url: URL.createObjectURL(blob),
    content,
  }
}

function triggerDownload(file: GeneratedFile) {
  try {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.name
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    return true
  } catch {
    return false
  }
}

function openFilePreview(file: GeneratedFile) {
  const opened = window.open(file.url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    const fallback = document.createElement('a')
    fallback.href = file.url
    fallback.target = '_blank'
    fallback.rel = 'noopener noreferrer'
    document.body.appendChild(fallback)
    fallback.click()
    fallback.remove()
  }
}

function escapeCsvCell(value: string | undefined) {
  const normalized = String(value ?? '')
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

function dateStamp() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9ก-๙-]/g, '')
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
}
