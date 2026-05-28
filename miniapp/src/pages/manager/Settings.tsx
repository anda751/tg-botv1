import ManagerNav from '../../components/ManagerNav';
import ProfileSettingsForm from '../../components/ProfileSettingsForm';

export default function Settings() {
  return (
    <div className="settings-shell min-h-screen bg-slate-950 flex flex-col transition-colors">
      <div className="settings-header bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4 transition-colors">
        <ManagerNav />
      </div>

      <ProfileSettingsForm
        title="ตั้งค่า"
        subtitle="แก้ไขข้อมูลหัวหน้า รหัสผ่าน และ Telegram"
        showTelegramFields
      />
    </div>
  );
}
