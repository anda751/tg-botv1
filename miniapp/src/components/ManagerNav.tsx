import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { label: 'ภาพรวม', path: '/' },
  { label: 'โปรเจกต์', path: '/projects' },
  { label: 'งานรอตรวจ', path: '/tasks' },
  { label: 'ทีมงาน', path: '/staff' },
  { label: 'KPI', path: '/kpi' },
  { label: 'ประวัติ', path: '/history' },
  { label: 'รายงาน', path: '/reports' },
  { label: 'ตั้งค่า', path: '/settings' },
]

export default function ManagerNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map((tab) => (
        <button
          key={tab.path}
          onClick={() => navigate(tab.path)}
          className={`manager-tab px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
            pathname === tab.path
              ? 'manager-tab-active bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 active:bg-slate-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
