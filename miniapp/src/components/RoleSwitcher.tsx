export default function RoleSwitcher({
  currentRole,
  onSwitchRole,
}: {
  currentRole: 'manager' | 'staff'
  onSwitchRole: () => void
}) {
  return (
    <button
      onClick={onSwitchRole}
      className="fixed right-4 bottom-24 z-40 px-4 py-2 rounded-full text-xs font-semibold text-white bg-slate-900/90 border border-slate-700 shadow-lg backdrop-blur active:bg-slate-800 transition"
    >
      {currentRole === 'manager' ? 'Manager' : 'Staff'} · สลับบทบาท
    </button>
  )
}
