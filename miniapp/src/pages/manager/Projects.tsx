import { useEffect, useState } from 'react';
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
  status_request: 'pending' | 'approved' | 'rejected'
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

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [projectRes, requestRes] = await Promise.all([
        projectApi.getAll(),
        projectApi.getPendingJoinRequests(),
      ]);
      const projectList = Array.isArray(projectRes.data) ? projectRes.data : (projectRes.data.data ?? []);
      const requestList = Array.isArray(requestRes.data) ? requestRes.data : (requestRes.data.data ?? []);
      setProjects(projectList);
      setRequests(requestList);
    } catch {
      setProjects([]);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim() || !newDeadline) {
      setError('Please provide project name and deadline');
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
      setError(err?.response?.data?.error?.message || 'Create project failed');
    } finally {
      setCreating(false);
    }
  }

  async function handleCloseProject(projectId: number) {
    if (!confirm('Close this project?')) return;
    try {
      await projectApi.close(projectId);
      await loadAll();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Close project failed');
    }
  }

  async function handleApproveRequest(requestId: number) {
    setApprovingId(requestId);
    try {
      await projectApi.approveJoinRequest(requestId);
      await loadAll();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Approve failed');
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRejectRequest(requestId: number) {
    const reason = prompt('Reason for rejection (optional):') ?? '';
    setRejectingId(requestId);
    try {
      await projectApi.rejectJoinRequest(requestId, reason);
      await loadAll();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Reject failed');
    } finally {
      setRejectingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Projects</h1>
            <p className="text-xs text-slate-400 mt-0.5">Manage projects and join requests</p>
          </div>
          <button
            onClick={loadAll}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 bg-slate-800 active:bg-slate-700 transition"
          >
            ↻
          </button>
        </div>
        <ManagerNav />
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
          <p className="text-sm font-semibold text-white mb-3">Create Project</p>
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
            />
            <input
              type="datetime-local"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Join Requests</p>
            <span className="text-xs text-slate-400">{requests.length} pending</span>
          </div>
          {loading ? (
            <div className="h-12 bg-slate-800 rounded-xl animate-pulse" />
          ) : requests.length === 0 ? (
            <p className="text-sm text-slate-500">No pending requests</p>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                  <p className="text-sm text-white">
                    {(r.requested_by?.display_name || r.requested_by?.username || 'Unknown')} wants to join{' '}
                    <span className="font-semibold">{r.project?.name || '-'}</span>
                  </p>
                  {r.note && <p className="text-xs text-slate-400 mt-1">Note: {r.note}</p>}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleRejectRequest(r.id)}
                      disabled={rejectingId === r.id}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-red-300 bg-red-950/40 border border-red-800/60 disabled:opacity-40"
                    >
                      {rejectingId === r.id ? '...' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleApproveRequest(r.id)}
                      disabled={approvingId === r.id}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-green-600 disabled:opacity-40"
                    >
                      {approvingId === r.id ? '...' : 'Approve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 pb-8">
          <p className="text-sm font-semibold text-white">All Projects</p>
          {loading ? (
            <div className="h-16 bg-slate-800 rounded-xl animate-pulse" />
          ) : projects.length === 0 ? (
            <p className="text-sm text-slate-500">No projects</p>
          ) : (
            projects.map((p) => (
              <div key={p.id} className="bg-slate-900 border border-slate-700 rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(p.deadline).toLocaleString()} · members {p.members?.length ?? 0}
                    </p>
                  </div>
                  {p.status_project === 'active' ? (
                    <button
                      onClick={() => handleCloseProject(p.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-red-950/40 border border-red-800/60"
                    >
                      Close
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">Closed</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
