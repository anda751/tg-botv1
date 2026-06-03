import { useEffect, useMemo, useState } from 'react'
import ManagerNav from '../../components/ManagerNav'
import { projectApi } from '../../api'

type Project = {
  id: number
  name: string
  deadline: string
  status_project: 'active' | 'closed'
}

type ExportLink = {
  label: string
  description: string
  url: string
}

const DAY_OPTIONS = [7, 14, 30, 60]
const AUTH_TOKEN_KEY = 'auth-token'

export default function ExportPage() {
  const [days, setDays] = useState(30)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('')
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [pageError, setPageError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [bundleLinks, setBundleLinks] = useState<ExportLink[]>([])

  useEffect(() => {
    void loadProjects()
  }, [])

  async function loadProjects() {
    setLoadingProjects(true)
    setPageError('')
    try {
      const { data } = await projectApi.getHome()
      setProjects(Array.isArray(data?.projects) ? data.projects : [])
    } catch (error: any) {
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

  const allLinks = useMemo(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY) || ''
    const baseUrl = normalizeApiBaseUrl(import.meta.env.VITE_STRAPI_URL)
    const createUrl = (path: string, params: Record<string, string | number | undefined> = {}) => {
      const url = new URL(`/api${path}`, baseUrl)
      url.searchParams.set('export_token', token)
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value))
        }
      })
      return url.toString()
    }

    return {
      reports: createUrl('/dashboard/export/reports'),
      kpi: createUrl('/dashboard/export/kpi', { days }),
      history: createUrl('/dashboard/export/history', { days }),
      tasks: createUrl('/dashboard/export/tasks'),
      projects: createUrl('/projects/export/list'),
      projectDetail: selectedProjectId ? createUrl(`/projects/${selectedProjectId}/export`) : '',
    }
  }, [days, selectedProjectId])

  function handleOpen(url: string, successMessage: string) {
    if (!url) {
      setActionError('ลิงก์ส่งออกยังไม่พร้อมใช้งาน')
      return
    }

    setActionError('')
    setActionSuccess(successMessage)
    openExportLink(url)
  }

  function prepareBundle() {
    const links: ExportLink[] = [
      {
        label: 'รายงานภาพรวม',
        description: 'สรุปจำนวนงาน โปรเจกต์ และภาระงานทีม',
        url: allLinks.reports,
      },
      {
        label: `KPI รายคน (${days} วัน)`,
        description: 'คะแนนรวม ผลงานรายคน และข้อสังเกตที่ควรตามต่อ',
        url: allLinks.kpi,
      },
      {
        label: `ประวัติการทำรายการ (${days} วัน)`,
        description: 'รวมการอนุมัติ ส่งกลับ และการจัดการโปรเจกต์ย้อนหลัง',
        url: allLinks.history,
      },
      {
        label: 'งานที่ยังไม่ปิด',
        description: 'งานที่กำลังทำ รอตรวจ และรอรับช่วงต่อ',
        url: allLinks.tasks,
      },
    ]

    setBundleLinks(links)
    setActionError('')
    setActionSuccess('เตรียมชุดลิงก์ส่งออกแล้ว ใน Telegram แนะนำให้กดทีละไฟล์จากรายการด้านล่าง')
  }

  return (
    <div className="panel-shell min-h-screen bg-slate-950 flex flex-col transition-colors">
      <div className="panel-header bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4 transition-colors">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-white">ศูนย์ส่งออกรายงาน</h1>
          <p className="text-sm text-slate-400 mt-1">
            ส่งออกผ่านลิงก์จากระบบโดยตรง เพื่อให้ใช้งานได้ดีขึ้นใน Telegram และ webview
          </p>
        </div>
        <ManagerNav />
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 pb-8 page-enter">
        {pageError && <NoticeBox tone="red" title="โหลดข้อมูลไม่สำเร็จ" message={pageError} />}
        {actionError && <NoticeBox tone="red" title="ส่งออกไม่สำเร็จ" message={actionError} />}
        {actionSuccess && <NoticeBox tone="blue" title="พร้อมใช้งาน" message={actionSuccess} />}

        <section className="panel-surface bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-4 panel-enter interactive-lift">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">ชุดส่งออกหลัก</p>
              <p className="text-xs text-slate-400 mt-1">
                สำหรับ Telegram แนะนำให้เตรียมชุดลิงก์ก่อน แล้วกดทีละไฟล์จากรายการด้านล่าง
              </p>
            </div>
            <button
              onClick={prepareBundle}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 transition"
            >
              เตรียมชุดส่งออกหลัก
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
        </section>

        {bundleLinks.length > 0 && (
          <section className="panel-surface bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 panel-enter interactive-lift">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">ลิงก์ชุดส่งออกหลัก</p>
                <p className="text-xs text-slate-400 mt-1">กดเปิดทีละไฟล์ได้เลย ถ้า Telegram ไม่ยอมโหลดหลายไฟล์พร้อมกัน</p>
              </div>
              <button
                onClick={() => setBundleLinks([])}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 active:bg-slate-700 transition"
              >
                ล้างรายการ
              </button>
            </div>

            <div className="space-y-2">
              {bundleLinks.map((item) => (
                <DirectExportRow
                  key={item.label}
                  title={item.label}
                  description={item.description}
                  onOpen={() => handleOpen(item.url, `กำลังเปิด ${item.label}`)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <ExportCard
            title="รายงานภาพรวม"
            description="สรุปจำนวนงาน โปรเจกต์ และภาระงานทีม"
            onOpen={() => handleOpen(allLinks.reports, 'กำลังเปิดไฟล์รายงานภาพรวม')}
          />
          <ExportCard
            title={`KPI รายคน (${days} วัน)`}
            description="คะแนนรวม ผลงานรายคน และข้อสังเกตที่ควรตามต่อ"
            onOpen={() => handleOpen(allLinks.kpi, 'กำลังเปิดไฟล์ KPI รายคน')}
          />
          <ExportCard
            title={`ประวัติการทำรายการ (${days} วัน)`}
            description="รวมการอนุมัติ ส่งกลับ และการจัดการโปรเจกต์ย้อนหลัง"
            onOpen={() => handleOpen(allLinks.history, 'กำลังเปิดไฟล์ประวัติการทำรายการ')}
          />
          <ExportCard
            title="งานที่ยังไม่ปิด"
            description="งานที่กำลังทำ รอตรวจ และรอรับช่วงต่อในมุมของหัวหน้า"
            onOpen={() => handleOpen(allLinks.tasks, 'กำลังเปิดไฟล์งานที่ยังไม่ปิด')}
          />
          <ExportCard
            title="รายการโปรเจกต์"
            description="ภาพรวมโปรเจกต์ทั้งหมดพร้อมสถานะและกำหนดส่ง"
            onOpen={() => handleOpen(allLinks.projects, 'กำลังเปิดไฟล์รายการโปรเจกต์')}
          />

          <div className="panel-surface bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 panel-enter interactive-lift">
            <div>
              <p className="text-sm font-semibold text-white">รายละเอียดงานตามโปรเจกต์</p>
              <p className="text-xs text-slate-400 mt-1">
                เลือกโปรเจกต์หนึ่งตัว แล้วเปิดไฟล์งานทั้งหมดในโปรเจกต์นั้นพร้อมสถานะและผู้รับผิดชอบ
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
              onClick={() => handleOpen(allLinks.projectDetail, `กำลังเปิดไฟล์ของโปรเจกต์ ${selectedProject?.name || ''}`)}
              disabled={!selectedProjectId}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition"
            >
              เปิดไฟล์โปรเจกต์
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
  onOpen,
}: {
  title: string
  description: string
  onOpen: () => void
}) {
  return (
    <div className="panel-surface bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 panel-enter interactive-lift">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>
      <button
        onClick={onOpen}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 transition"
      >
        เปิดไฟล์ส่งออก
      </button>
    </div>
  )
}

function DirectExportRow({
  title,
  description,
  onOpen,
}: {
  title: string
  description: string
  onOpen: () => void
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white break-all">{title}</p>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>
      <button
        onClick={onOpen}
        className="px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white active:bg-blue-700 transition"
      >
        เปิดไฟล์
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

function normalizeApiBaseUrl(value?: string) {
  const fallback = window.location.origin
  if (!value) return fallback
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function openExportLink(url: string) {
  const telegramOpenLink = (window as any)?.Telegram?.WebApp?.openLink
  if (typeof telegramOpenLink === 'function') {
    telegramOpenLink(url)
    return
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    window.location.href = url
  }
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
}
