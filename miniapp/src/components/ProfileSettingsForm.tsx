import { useEffect, useState } from 'react';
import { userApi } from '../api';

type Profile = {
  id: number
  username: string
  email: string
  display_name: string
  role_app: 'manager' | 'staff'
  telegram_id?: string
  telegram_chat_id?: string
}

type Props = {
  title: string
  subtitle: string
  showTelegramFields: boolean
}

export default function ProfileSettingsForm({
  title,
  subtitle,
  showTelegramFields,
}: Props) {
  const [form, setForm] = useState({
    display_name: '',
    telegram_id: '',
    telegram_chat_id: '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await userApi.me();
      setProfile(data);
      setForm({
        display_name: data.display_name || '',
        telegram_id: data.telegram_id || '',
        telegram_chat_id: data.telegram_chat_id || '',
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.display_name.trim()) {
      setError('กรุณากรอกชื่อที่แสดง');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload: {
        display_name: string
        telegram_id?: string
        telegram_chat_id?: string
        current_password?: string
        new_password?: string
        confirm_password?: string
      } = {
        display_name: form.display_name.trim(),
        current_password: form.current_password,
        new_password: form.new_password,
        confirm_password: form.confirm_password,
      };

      if (showTelegramFields) {
        payload.telegram_id = form.telegram_id.trim();
        payload.telegram_chat_id = form.telegram_chat_id.trim();
      }

      const { data } = await userApi.updateMe(payload);
      setProfile(data.user);
      setForm({
        display_name: data.user.display_name || '',
        telegram_id: data.user.telegram_id || '',
        telegram_chat_id: data.user.telegram_chat_id || '',
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      setSuccess(data.message || 'บันทึกข้อมูลเรียบร้อย');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-surface flex-1 px-4 py-5 space-y-4 transition-colors">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-900 rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : error && !profile ? (
        <StateBox title="โหลดข้อมูลไม่สำเร็จ" message={error} actionLabel="ลองใหม่" onAction={loadProfile} />
      ) : (
        <>
          {error && <NoticeBox tone="red" title="บันทึกข้อมูลไม่สำเร็จ" message={error} />}
          {success && <NoticeBox tone="green" title="บันทึกสำเร็จ" message={success} />}

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-white">ข้อมูลบัญชี</p>
            <div className="grid gap-3">
              <ReadOnlyField label="ชื่อผู้ใช้" value={profile?.username || '-'} />
              <ReadOnlyField label="อีเมล" value={profile?.email || '-'} />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-white">ข้อมูลที่แก้ไขได้</p>
            <Field label="ชื่อที่แสดง">
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                placeholder="ชื่อที่แสดง"
              />
            </Field>

            {showTelegramFields && (
              <>
                <Field label="Telegram ID">
                  <input
                    type="text"
                    value={form.telegram_id}
                    onChange={(e) => setForm((f) => ({ ...f, telegram_id: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                    placeholder="Telegram ID"
                  />
                </Field>
                <Field label="Telegram Chat ID">
                  <input
                    type="text"
                    value={form.telegram_chat_id}
                    onChange={(e) => setForm((f) => ({ ...f, telegram_chat_id: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                    placeholder="Telegram Chat ID"
                  />
                </Field>
                <p className="text-xs text-slate-500">
                  ใช้สำหรับแจ้งเตือนฝั่งหัวหน้าเท่านั้น ถ้ากรอกผิดสามารถกลับมาแก้ที่หน้านี้ได้ตลอด
                </p>
              </>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-white">เปลี่ยนรหัสผ่าน</p>
            <Field label="รหัสผ่านปัจจุบัน">
              <input
                type="password"
                value={form.current_password}
                onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                placeholder="รหัสผ่านปัจจุบัน"
              />
            </Field>
            <Field label="รหัสผ่านใหม่">
              <input
                type="password"
                value={form.new_password}
                onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                placeholder="รหัสผ่านใหม่"
              />
            </Field>
            <Field label="ยืนยันรหัสผ่านใหม่">
              <input
                type="password"
                value={form.confirm_password}
                onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                placeholder="ยืนยันรหัสผ่านใหม่"
              />
            </Field>
            <p className="text-xs text-slate-500">
              ถ้ายังไม่ต้องการเปลี่ยนรหัสผ่าน ปล่อยสามช่องนี้ว่างไว้ได้เลย
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      <div className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
        {value}
      </div>
    </div>
  );
}

function NoticeBox({
  tone,
  title,
  message,
}: {
  tone: 'red' | 'green'
  title: string
  message: string
}) {
  const toneClass = tone === 'green'
    ? 'border-green-800/70 bg-green-950/40 text-green-100'
    : 'border-red-800/70 bg-red-950/40 text-red-100';

  return (
    <div className={`rounded-2xl border px-4 py-3 notice-enter ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs mt-1 opacity-90">{message}</p>
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
