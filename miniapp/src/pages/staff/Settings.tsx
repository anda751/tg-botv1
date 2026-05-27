import { useNavigate } from 'react-router-dom';
import ProfileSettingsForm from '../../components/ProfileSettingsForm';

export default function StaffSettings() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 bg-slate-800 active:bg-slate-700 transition"
          title="ย้อนกลับ"
          aria-label="ย้อนกลับ"
        >
          ←
        </button>
        <div>
          <p className="text-xs text-slate-400">บัญชีผู้ใช้งาน</p>
          <p className="text-sm text-white font-semibold">ตั้งค่าโปรไฟล์</p>
        </div>
      </div>

      <ProfileSettingsForm
        title="ตั้งค่าโปรไฟล์"
        subtitle="แก้ชื่อที่แสดงและเปลี่ยนรหัสผ่านได้จากหน้านี้"
        showTelegramFields={false}
      />
    </div>
  );
}
