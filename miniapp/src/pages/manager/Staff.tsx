import { useEffect, useMemo, useState } from 'react';
import ManagerNav from '../../components/ManagerNav';
import { dashboardApi } from '../../api';

type StaffMember = {
  id: number
  display_name: string
  username: string
  active_tasks: number
}

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data } = await dashboardApi.staffOverview();
      setStaff(Array.isArray(data) ? data : []);
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredStaff = useMemo(
    () =>
      staff.filter(
        (s) =>
          !search ||
          (s.display_name || s.username).toLowerCase().includes(search.toLowerCase()) ||
          s.username.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, staff],
  );

  function workloadColor(n: number) {
    if (n === 0) return 'text-slate-500';
    if (n >= 4) return 'text-red-400';
    if (n >= 2) return 'text-amber-400';
    return 'text-green-400';
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Staff</h1>
            <p className="text-xs text-slate-400 mt-0.5">{staff.length} คน</p>
          </div>
          <button
            onClick={loadData}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 bg-slate-800 active:bg-slate-700 transition"
          >
            ↻
          </button>
        </div>

        <ManagerNav />

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
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

        {!loading && filteredStaff.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">👥</div>
            <p className="text-slate-300 font-semibold">ไม่พบพนักงาน</p>
          </div>
        )}

        {!loading &&
          filteredStaff.map((s) => (
            <div key={s.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center text-base font-bold text-slate-200 shrink-0">
                {(s.display_name || s.username)?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{s.display_name || s.username}</p>
                <p className="text-slate-500 text-xs mt-0.5">@{s.username}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-lg font-bold leading-none ${workloadColor(s.active_tasks)}`}>{s.active_tasks}</p>
                <p className="text-xs text-slate-600 mt-0.5">งาน</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
