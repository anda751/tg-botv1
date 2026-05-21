import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Projects',  path: '/projects' },
  { label: 'Tasks',     path: '/tasks' },
  { label: 'Staff',     path: '/staff' },
  { label: 'Reports',   path: '/reports' },
]

export default function ManagerNav() {
  const navigate  = useNavigate()
  const { pathname } = useLocation()

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map(tab => (
        <button
          key={tab.path}
          onClick={() => navigate(tab.path)}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
            pathname === tab.path
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 active:bg-slate-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}