export default function PendingApproval() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-xs">
        <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center text-4xl bg-slate-900 border border-slate-700">
          ⏳
        </div>
        <h1 className="text-xl font-bold text-white mb-2">รอการอนุมัติ</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          หัวหน้าได้รับคำขอของคุณแล้ว
          <br />
          กรุณารอการอนุมัติก่อนเข้าใช้งาน
        </p>

        {/* Status steps */}
        <div className="mt-8 space-y-3 text-left">
          <Step done label="ส่งคำขอเข้าระบบแล้ว" />
          <Step active label="รอหัวหน้าอนุมัติ" />
          <Step label="เข้าใช้งานได้" />
        </div>

        <p className="mt-8 text-xs text-slate-600">
          คุณจะได้รับแจ้งเตือนทาง Telegram เมื่ออนุมัติแล้ว
        </p>
      </div>
    </div>
  )
}

function Step({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${
        done   ? 'bg-green-500 text-white' :
        active ? 'bg-blue-500 text-white animate-pulse' :
                 'bg-slate-800 text-slate-600'
      }`}>
        {done ? '✓' : active ? '·' : '·'}
      </div>
      <span className={`text-sm ${
        done ? 'text-green-400' : active ? 'text-white font-medium' : 'text-slate-600'
      }`}>
        {label}
      </span>
    </div>
  )
}