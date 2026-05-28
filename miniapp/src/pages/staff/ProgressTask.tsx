import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { taskApi } from '../../api';

type Task = { id: number; name: string; project?: { name: string } };

export default function ProgressTask() {
  const navigate = useNavigate();
  const location = useLocation();
  const { taskId } = useParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [task, setTask] = useState<Task | null>(null);
  const [reportText, setReportText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const navTask = (location.state as any)?.task as Task | undefined;
    const idNum = Number(taskId);

    if (!Number.isFinite(idNum) || idNum <= 0) {
      navigate('/');
      return;
    }

    if (navTask && navTask.id === idNum) {
      setTask(navTask);
      return;
    }

    taskApi
      .getMyTasks()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data.data ?? []);
        const found = list.find((t: any) => Number(t.id) === idNum);
        if (!found) {
          navigate('/');
          return;
        }
        setTask(found);
      })
      .catch(() => navigate('/'));
  }, [taskId, location.state, navigate]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
    setError('');
  }

  function handleRemoveImage() {
    setImageFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit() {
    if (reportText.trim().length < 5) {
      setError('รายงานความคืบหน้าต้องมีอย่างน้อย 5 ตัวอักษร');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('report_text', reportText.trim());
      if (imageFile) fd.append('proof_image', imageFile);
      await taskApi.progress(Number(taskId), fd);
      navigate('/', { state: { successMessage: 'บันทึกความคืบหน้าเรียบร้อยแล้ว' } });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'บันทึกความคืบหน้าไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  const isValid = reportText.trim().length >= 5;

  return (
    <div className="panel-shell min-h-screen bg-slate-950 flex flex-col transition-colors">
      <div className="panel-header bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4 flex items-center gap-3 transition-colors">
        <button
          onClick={() => navigate('/')}
          className="panel-icon-button w-9 h-9 rounded-full flex items-center justify-center text-slate-400 bg-slate-800 active:bg-slate-700 transition"
          title="ย้อนกลับ"
          aria-label="ย้อนกลับ"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white">อัปเดตความคืบหน้า</h1>
          {task && (
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {task.project ? `โปรเจกต์ ${task.project.name} · ` : ''}{task.name}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 block">
            ความคืบหน้า <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reportText}
            onChange={(e) => { setReportText(e.target.value); setError(''); }}
            placeholder="อัปเดตสิ่งที่ทำไปแล้วหรือสิ่งที่กำลังทำอยู่"
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 block">
            รูปประกอบ (ไม่บังคับ)
          </label>
          {preview ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-700">
              <img src={preview} alt="progress" className="w-full object-cover max-h-64" />
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-black/60"
                >
                  เปลี่ยน
                </button>
                <button
                  onClick={handleRemoveImage}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-black/60"
                >
                  ลบ
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-2 active:bg-slate-900 transition"
            >
              <span className="text-3xl">รูป</span>
              <span className="text-sm text-slate-400 font-medium">แนบรูปความคืบหน้าเพิ่มเติม</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
      </div>

      <div className="px-4 pb-8 pt-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !isValid}
          className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-40"
        >
          {submitting ? 'กำลังบันทึก...' : 'บันทึกความคืบหน้า'}
        </button>
      </div>
    </div>
  );
}
