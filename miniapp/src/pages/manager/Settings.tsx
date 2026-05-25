import ManagerNav from '../../components/ManagerNav';
import ProfileSettingsForm from '../../components/ProfileSettingsForm';

export default function Settings() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <ManagerNav />
      </div>

      <ProfileSettingsForm
        title="Settings"
        subtitle="แก้ไขข้อมูลหัวหน้า รหัสผ่าน และ Telegram"
        showTelegramFields
      />
    </div>
  );
}
