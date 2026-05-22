export default function RoleSwitcher({
  currentRole,
  onSwitchRole,
  onLogout,
}: {
  currentRole: 'manager' | 'staff'
  onSwitchRole: () => void
  onLogout: () => void
}) {
  return (
    <div className="fixed right-4 bottom-24 z-40 flex flex-col gap-2">
      <button
        onClick={onSwitchRole}
        className="px-4 py-2 rounded-full text-xs font-semibold text-white bg-slate-900/90 border border-slate-700 shadow-lg backdrop-blur active:bg-slate-800 transition"
      >
        {currentRole === 'manager' ? 'Manager' : 'Staff'} · สลับบทบาท
      </button>
      <button
        onClick={onLogout}
        className="px-4 py-2 rounded-full text-xs font-semibold text-red-200 bg-red-950/90 border border-red-800 shadow-lg backdrop-blur active:bg-red-900 transition"
      >
        Logout
      </button>
    </div>
  )
}
