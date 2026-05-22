import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { signOutUser } from '@/lib/auth';
import { Cloud, BookOpen, Settings, LogOut, Bell, Vibrate, Volume2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { enablePushNotifications, disablePushNotifications, isFcmEnabled } from '@/lib/fcm';
import {
  isHapticEnabled, setHapticEnabled,
  isSoundEnabled,  setSoundEnabled,
  feedback,
} from '@/lib/feedback';

const items = [
  { icon: Cloud,    label: '컨디션',   to: '/condition' },
  { icon: BookOpen, label: '플래너',   to: '/planner' },
  { icon: Settings, label: '관리',     to: '/admin' },
];

export default function More() {
  const navigate = useNavigate();
  const uid = useAppStore((s) => s.uid);
  const [push, setPush]   = useState(false);
  const [haptic, setHapt] = useState(false);
  const [sound, setSnd]   = useState(false);

  useEffect(() => {
    setPush(isFcmEnabled());
    setHapt(isHapticEnabled());
    setSnd(isSoundEnabled());
  }, []);

  const onPushToggle = async () => {
    if (!uid) return;
    if (push) { await disablePushNotifications(); setPush(false); }
    else      { const t = await enablePushNotifications(uid); if (t) setPush(true); }
  };

  return (
    <div className="min-h-screen p-4 space-y-2">
      <h2 className="py-2 text-base font-semibold text-[var(--fg-primary)]">더보기</h2>

      {items.map(({ icon: Icon, label, to }) => (
        <button
          key={to}
          onClick={() => navigate(to)}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] active:opacity-70"
        >
          <Icon size={18} className="text-[var(--leaf)]" />
          {label}
        </button>
      ))}

      {/* 피드백 / 알림 설정 (Phase 1-2, 3-1) */}
      <div className="mt-4 rounded-[var(--radius)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] divide-y divide-[var(--leaf-soft)]">
        <ToggleRow
          icon={<Bell size={18} className="text-[var(--leaf)]" />}
          label="푸시 알림"
          desc="시간대별 리마인더 (FCM)"
          value={push}
          onToggle={onPushToggle}
        />
        <ToggleRow
          icon={<Vibrate size={18} className="text-[var(--leaf)]" />}
          label="햅틱"
          desc="체크 시 진동"
          value={haptic}
          onToggle={() => {
            const v = !haptic; setHapticEnabled(v); setHapt(v);
            if (v) feedback('check');
          }}
        />
        <ToggleRow
          icon={<Volume2 size={18} className="text-[var(--leaf)]" />}
          label="사운드"
          desc="체크 시 짧은 음"
          value={sound}
          onToggle={() => {
            const v = !sound; setSoundEnabled(v); setSnd(v);
            if (v) feedback('achieve');
          }}
        />
      </div>

      <button
        onClick={() => signOutUser()}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-red-500 shadow-[var(--shadow-sm)] active:opacity-70 mt-4"
      >
        <LogOut size={18} />
        로그아웃
      </button>
    </div>
  );
}

function ToggleRow({
  icon, label, desc, value, onToggle,
}: { icon: React.ReactNode; label: string; desc?: string; value: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:opacity-70"
    >
      {icon}
      <div className="flex-1">
        <p className="text-sm text-[var(--fg-primary)]">{label}</p>
        {desc && <p className="text-[10px] text-[var(--fg-faint)]">{desc}</p>}
      </div>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          value ? 'bg-[var(--leaf)]' : 'bg-[var(--leaf-soft)]'
        }`}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
          style={{ transform: `translateX(${value ? 18 : 2}px)` }}
        />
      </span>
    </button>
  );
}
