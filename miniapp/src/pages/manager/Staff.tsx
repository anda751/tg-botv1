import { useEffect, useMemo, useState } from 'react'
import ManagerNav from '../../components/ManagerNav'
import { dashboardApi } from '../../api'

type StaffMember = {
  id: number
  display_name: string
  username: string
  active_tasks: number
}

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const { data } = await dashboardApi.staffOverview()
      setStaff(Array.isArray(data) ? data : [])
    } catch (err) {
      setStaff([])
      setError(extractMessage(err, 'โหลดรายชื่อพนักงานไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }

  const filteredStaff = useMemo(
    () =>
      staff.filter(
        (member) =>
          !search
          || (member.display_name || member.username).toLowerCase().includes(search.toLowerCase())
          || member.username.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, staff],
  )

  function workloadColor(taskCount: number) {
    if (taskCount === 0) return 'text-slate-500'
    if (taskCount >= 4) return 'text-red-400'
    if (taskCount >= 2) return 'text-amber-400'
    return 'text-green-400'
  }

  const isSearching = search.trim().length > 0

  return (
    <div className="panel-shell min-h-screen bg-slate-950 flex flex-col transition-colors">
      <div className="panel-header bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">พนักงาน</h1>
            <p className="text-xs text-slate-400 mt-0.5">{staff.length} คน</p>
          </div>
          <button
            onClick={() => void loadData()}
            className="panel-icon-button w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition"
            title="รีเฟรช"
            aria-label="รีเฟรช"
          >
            ↻
          </button>
        </div>

        <ManagerNav />

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ค้น</span>
          <input
            type="text"
            placeholder="ค้นหาชื่อพนักงาน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">
        {loading && [1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-900 rounded-2xl h-20 animate-pulse" />
        ))}

        {!loading && error && (
          <StateBox
            title="โหลดรายชื่อพนักงานไม่สำเร็จ"
            message={error}
            actionLabel="ลองใหม่"
            onAction={() => void loadData()}
          />
        )}

        {!loading && !error && filteredStaff.length === 0 && (
          <StateBox
            title={isSearching ? 'ไม่พบพนักงานที่ค้นหา' : 'ยังไม่มีรายชื่อพนักงาน'}
            message={
              isSearching
                ? 'ลองค้นหาด้วยชื่อหรือชื่อผู้ใช้อีกแบบ'
                : 'เมื่อมีพนักงานในระบบ รายการจะแสดงที่นี่'
            }
          />
        )}

        {!loading && !error &&
          filteredStaff.map((member) => (
            <div key={member.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center text-base font-bold text-slate-200 shrink-0">
                {(member.display_name || member.username)?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{member.display_name || member.username}</p>
                <p className="text-slate-500 text-xs mt-0.5">@{member.username}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-lg font-bold leading-none ${workloadColor(member.active_tasks)}`}>{member.active_tasks}</p>
                <p className="text-xs text-slate-600 mt-0.5">งาน</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
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
  )
}
