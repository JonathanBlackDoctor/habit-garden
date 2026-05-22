import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { signOutUser } from '@/lib/auth';
import { Cloud, BookOpen, Settings, LogOut, Bell, Vibrate, Volume2, HandHeart, Download } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { enablePushNotifications, disablePushNotifications, isFcmEnabled } from '@/lib/fcm';
import {
  isHapticEnabled, setHapticEnabled,
  isSoundEnabled,  setSoundEnabled,
  feedback,
} from '@/lib/feedback';
import { useFaithEnabled, setFaithEnabled } from '@/lib/features';
import { usePwaInstall } from '@/lib/pwaInstall';

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
  const faithEnabled = useFaithEnabled();
  const { canInstall, isStandalone, isIOS, promptInstall } = usePwaInstall();

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

  const onFaithToggle = async () => {
    if (!uid) return;
    await setFaithEnabled(uid, !faithEnabled);
  };

  const onInstallClick = async () => {
    if (isIOS) {
      toast('Safari 공유 메뉴 → "홈 화면에 추가"를 눌러주세요', {
        description: 'iOS는 16.4 이상에서 푸시 알림이 지원됩니다',
      });
      return;
    }
    if (canInstall) {
      await promptInstall();
      return;
    }
    toast('지금은 설치할 수 없어요', {
      description: '브라우저 메뉴의 "앱 설치" 항목을 사용해보세요',
    });
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
        <ToggleRow
          icon={<HandHeart size={18} className="text-[var(--leaf)]" />}
          label="신앙 기능"
          desc="경건·기도제목 메뉴 표시"
          value={faithEnabled}
          onToggle={onFaithToggle}
        />
      </div>

      {!isStandalone && (
        <button
          onClick={onInstallClick}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] active:opacity-70 mt-4 text-left"
        >
          <Download size={18} className="text-[var(--leaf)]" />
          <div className="flex-1">
            <p>앱으로 설치</p>
            <p className="text-[10px] text-[var(--fg-faint)]">홈 화면에 설치하면 푸시 알림이 크롬과 분리됩니다</p>
          </div>
        </button>
      )}

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
