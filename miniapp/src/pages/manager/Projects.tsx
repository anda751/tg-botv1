import { useEffect, useMemo, useState } from 'react';
import ManagerNav from '../../components/ManagerNav';
import { projectApi } from '../../api';

type Project = {
  id: number
  name: string
  deadline: string
  status_project: 'active' | 'closed'
  members?: { id: number; display_name: string; username: string }[]
}

type JoinRequest = {
  id: number
  note?: string
  project?: { id: number; name: string }
  requested_by?: { id: number; display_name: string; username: string }
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError('');

    const [projectRes, requestRes] = await Promise.allSettled([
      projectApi.getAll(),
      projectApi.getPendingJoinRequests(),
    ]);

    if (projectRes.status === 'fulfilled') {
      const projectList = Array.isArray(projectRes.value.data)
        ? projectRes.value.data
        : (projectRes.value.data.data ?? []);
      setProjects(projectList);
    } else {
      setProjects([]);
      setError(extractMessage(projectRes.reason, 'โหลดรายการโปรเจกต์ไม่สำเร็จ'));
    }

    if (requestRes.status === 'fulfilled') {
      const requestList = Array.isArray(requestRes.value.data)
        ? requestRes.value.data
        : (requestRes.value.data.data ?? []);
      setRequests(requestList);
    } else {
      setRequests([]);
      if (!error) {
        setError(extractMessage(requestRes.reason, 'โหลดคำขอเข้าโปรเจกต์ไม่สำเร็จ'));
      }
    }

    setLoading(false);
  }

  async function handleCreate() {
    if (!newName.trim() || !newDeadline) {
      setError('กรอกชื่อโปรเจกต์และกำหนดส่ง');
      return;
    }

    setCreating(true);
    setError('');
    try {
      await projectApi.create({
        name: newName.trim(),
        deadline: new Date(newDeadline).toISOString(),
      });
      setNewName('');
      setNewDeadline('');
      await loadAll();
    } catch (err: any) {
      setError(extractMessage(err, 'สร้างโปรเจกต์ไม่สำเร็จ'));
    } finally {
      setCreating(false);
    }
  }

  async function handleCloseProject(projectId: number) {
    if (!confirm('ปิดโปรเจกต์นี้?')) return;

    try {
      await projectApi.close(projectId);
      await loadAll();
    } catch (err: any) {
      alert(extractMessage(err, 'ปิดโปรเจกต์ไม่สำเร็จ'));
    }
  }

  async function handleApproveRequest(requestId: number) {
    setApprovingId(requestId);
    try {
      await projectApi.approveJoinRequest(requestId);
      await loadAll();
    } catch (err: any) {
      alert(extractMessage(err, 'อนุมัติไม่สำเร็จ'));
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRejectRequest(requestId: number) {
    const reason = prompt('เหตุผลการปฏิเสธ (ไม่บังคับ)') ?? '';
    setRejectingId(requestId);
    try {
      await projectApi.rejectJoinRequest(requestId, reason);
      await loadAll();
    } catch (err: any) {
      alert(extractMessage(err, 'ปฏิเสธไม่สำเร็จ'));
    } finally {
      setRejectingId(null);
    }
  }

  const visibleProjects = useMemo(() => {
    if (filter === 'all') return projects;
    return projects.filter((p) => p.status_project === filter);
  }, [projects, filter]);

  const activeCount = projects.filter((p) => p.status_project === 'active').length;
  const closedCount = projects.filter((p) => p.status_project === 'closed').length;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">โปรเจกต์</h1>
            <p className="text-xs text-slate-400 mt-0.5">จัดการโปรเจกต์และคำขอเข้าร่วม</p>
          </div>
          <button
            onClick={loadAll}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 bg-slate-800 active:bg-slate-700 transition"
            title="รีเฟรช"
          >
            รี
          </button>
        </div>
        <ManagerNav />
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="คำขอรออนุมัติ" value={String(requests.length)} />
          <StatCard label="โปรเจกต์ที่เปิด" value={String(activeCount)} />
          <StatCard label="โปรเจกต์ที่ปิดแล้ว" value={String(closedCount)} />
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
          <p className="text-sm font-semibold text-white mb-3">สร้างโปรเจกต์ใหม่</p>
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อโปรเจกต์"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
            />
            <input
              type="datetime-local"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-50"
            >
              {creating ? 'กำลังสร้าง...' : 'สร้างโปรเจกต์'}
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">คำขอเข้าโปรเจกต์</p>
            <span className="text-xs text-slate-400">{requests.length} รายการ</span>
          </div>
          {loading ? (
            <div className="h-12 bg-slate-800 rounded-xl animate-pulse" />
          ) : requests.length === 0 ? (
            <p className="text-sm text-slate-500">ไม่มีคำขอค้าง</p>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                  <p className="text-sm text-white leading-snug">
                    {(r.requested_by?.display_name || r.requested_by?.username || 'Unknown')} ขอเข้าโปรเจกต์{' '}
                    <span className="font-semibold">{r.project?.name || '-'}</span>
                  </p>
                  {r.note && <p className="text-xs text-slate-400 mt-1">หมายเหตุ: {r.note}</p>}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleRejectRequest(r.id)}
                      disabled={rejectingId === r.id}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-red-300 bg-red-950/40 border border-red-800/60 disabled:opacity-40"
                    >
                      {rejectingId === r.id ? '...' : 'ปฏิเสธ'}
                    </button>
                    <button
                      onClick={() => handleApproveRequest(r.id)}
                      disabled={approvingId === r.id}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-green-600 disabled:opacity-40"
                    >
                      {approvingId === r.id ? '...' : 'อนุมัติ'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">รายการโปรเจกต์</p>
            <div className="flex gap-1">
              {(['active', 'closed', 'all'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    filter === tab ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab === 'active' ? 'เปิดอยู่' : tab === 'closed' ? 'ปิดแล้ว' : 'ทั้งหมด'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-16 bg-slate-800 rounded-xl animate-pulse" />
          ) : visibleProjects.length === 0 ? (
            <p className="text-sm text-slate-500">ไม่มีโปรเจกต์ในหมวดนี้</p>
          ) : (
            <div className="space-y-2">
              {visibleProjects.map((p) => (
                <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        กำหนดส่ง {new Date(p.deadline).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">สมาชิก {p.members?.length ?? 0} คน</p>
                    </div>
                    {p.status_project === 'active' ? (
                      <button
                        onClick={() => handleCloseProject(p.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-red-950/40 border border-red-800/60"
                      >
                        ปิดโปรเจกต์
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-xs text-slate-400 bg-slate-900">ปิดแล้ว</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function extractMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-lg font-bold text-white leading-tight">{value}</p>
    </div>
  );
}
