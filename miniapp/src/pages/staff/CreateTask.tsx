import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectApi, taskApi } from '../../api';

type Project = {
  id: number
  name: string
  status_project: 'active' | 'closed'
}

export default function CreateTask() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [joinableProjects, setJoinableProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestingProjectId, setRequestingProjectId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoadingProjects(true);
    setProjectsError('');
    try {
      const [myRes, allRes] = await Promise.all([projectApi.getMyProjects(), projectApi.getAll()]);
      const myList = (Array.isArray(myRes.data) ? myRes.data : (myRes.data.data ?? [])) as Project[];
      const allList = (Array.isArray(allRes.data) ? allRes.data : (allRes.data.data ?? [])) as Project[];

      setProjects(myList);
      const myIds = new Set(myList.map((p) => Number(p.id)));
      setJoinableProjects(
        allList.filter((p) => p.status_project === 'active' && !myIds.has(Number(p.id))),
      );
    } catch (err: any) {
      setProjects([]);
      setJoinableProjects([]);
      setProjectsError(err?.response?.data?.error?.message || 'โหลดรายการโปรเจกต์ไม่สำเร็จ');
    } finally {
      setLoadingProjects(false);
    }
  }

  async function handleCreate() {
    if (!name || name.trim().length < 5) {
      setError('ชื่องานต้องมีอย่างน้อย 5 ตัวอักษร');
      return;
    }
    if (!/[a-zA-Zก-๙]/.test(name)) {
      setError('ชื่องานต้องมีตัวอักษรไทยหรืออังกฤษอย่างน้อย 1 ตัว');
      return;
    }

    setError('');
    setSuccessMessage('');
    setSubmitting(true);
    try {
      await taskApi.create({
        name: name.trim(),
        project: selectedProject as number,
      });
      navigate('/', { state: { successMessage: 'สร้างงานเรียบร้อยแล้ว' } });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'สร้างงานไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestJoin(projectId: number) {
    setRequestingProjectId(projectId);
    setError('');
    setSuccessMessage('');
    try {
      await projectApi.requestJoin(projectId, '');
      setJoinableProjects((prev) => prev.filter((p) => p.id !== projectId));
      setSuccessMessage('ส่งคำขอเข้าโปรเจกต์เรียบร้อยแล้ว');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'ส่งคำขอเข้าโปรเจกต์ไม่สำเร็จ');
    } finally {
      setRequestingProjectId(null);
    }
  }

  const isValid = name.trim().length >= 5 && /[a-zA-Zก-๙]/.test(name);

  return (
    <div className="panel-shell min-h-screen bg-slate-950 flex flex-col transition-colors">
      <div className="panel-header bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4 flex items-center gap-3 transition-colors">
        <button
          onClick={() => navigate('/')}
          className="panel-icon-button w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition"
          title="ย้อนกลับ"
          aria-label="ย้อนกลับ"
        >
          ←
        </button>
        <h1 className="text-lg font-bold text-white">สร้างงานใหม่</h1>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">
        {successMessage && (
          <div className="bg-green-950/50 border border-green-800 text-green-300 text-sm px-4 py-3 rounded-xl">
            {successMessage}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">
            ชื่องาน <span className="text-red-400">*</span>
          </label>
          <textarea
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="อธิบายงานที่ต้องทำแบบสั้น ๆ"
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 block">
            โปรเจกต์ของฉัน
          </label>
          {loadingProjects ? (
            <div className="h-10 rounded-xl bg-slate-800 animate-pulse" />
          ) : projectsError ? (
            <StateBox title="โหลดรายการโปรเจกต์ไม่สำเร็จ" message={projectsError} actionLabel="ลองใหม่" onAction={loadProjects} />
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedProject(null)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                  selectedProject === null
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                ไม่ระบุ
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                    selectedProject === p.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {!loadingProjects && !projectsError && joinableProjects.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 block">
              โปรเจกต์ที่ขอเข้าร่วมได้
            </label>
            <div className="space-y-2">
              {joinableProjects.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5">
                  <p className="text-sm text-white truncate">{p.name}</p>
                  <button
                    onClick={() => handleRequestJoin(p.id)}
                    disabled={requestingProjectId === p.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-200 bg-blue-900/60 border border-blue-700 active:bg-blue-800 transition disabled:opacity-40"
                  >
                    {requestingProjectId === p.id ? 'กำลังส่ง...' : 'ขอเข้า'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
      </div>

      <div className="px-4 pb-8 pt-2">
        <button
          onClick={handleCreate}
          disabled={submitting || !isValid}
          className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
        >
          {submitting ? 'กำลังสร้าง...' : 'สร้างงาน'}
        </button>
      </div>
    </div>
  );
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
  );
}
