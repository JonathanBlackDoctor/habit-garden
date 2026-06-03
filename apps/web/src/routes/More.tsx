import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { signOutUser } from '@/lib/auth';
import { Cloud, BookOpen, Settings, LogOut, Bell, Vibrate, Volume2, HandHeart, Download, GraduationCap, Palmtree, Thermometer } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { enablePushNotifications, disablePushNotifications, isFcmEnabled } from '@/lib/fcm';
import {
  isHapticEnabled, setHapticEnabled,
  isSoundEnabled,  setSoundEnabled,
  feedback,
} from '@/lib/feedback';
import { useFaithEnabled, setFaithEnabled, useIsGuest, useIsPremium } from '@/lib/features';
import { usePwaInstall } from '@/lib/pwaInstall';
import SignupCTA from '@/components/SignupCTA';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/switch';
import { useConfirm, usePrompt } from '@/components/ui/DialogProvider';

const NAV_ITEMS = [
  { icon: GraduationCap, label: '튜토리얼', to: '/tutorial' },
  { icon: Cloud,         label: '컨디션',   to: '/condition' },
  { icon: BookOpen,      label: '플래너',   to: '/planner' },
  { icon: Settings,      label: '관리',     to: '/admin' },
];

export default function More() {
  const navigate = useNavigate();
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [push, setPush]   = useState(false);
  const [haptic, setHapt] = useState(false);
  const [sound, setSnd]   = useState(false);
  const [vacationUntil, setVacationUntil] = useState<string | null>(null);
  const [sickDays, setSickDays] = useState<{ month: string; daysUsed: number } | null>(null);
  const faithEnabled = useFaithEnabled();
  const isGuest = useIsGuest();
  const isPremium = useIsPremium();
  const { canInstall, isStandalone, isIOS, promptInstall } = usePwaInstall();
  const confirm = useConfirm();
  const promptInput = usePrompt();

  useEffect(() => {
    setPush(isFcmEnabled());
    setHapt(isHapticEnabled());
    setSnd(isSoundEnabled());
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid, 'progress', 'main'), (snap) => {
      const p = snap.data();
      setVacationUntil(p?.vacationUntil ?? null);
      setSickDays(p?.sickDays ?? null);
    });
  }, [uid]);

  const startVacation = async () => {
    if (!uid) return;
    const input = await promptInput({
      title: '휴가 모드',
      description: '며칠간 스트릭을 동결할까요? (1–60일)',
      defaultValue: '7',
      inputType: 'number',
      inputMode: 'numeric',
      confirmLabel: '시작',
    });
    if (!input) return;
    const days = Math.max(1, Math.min(60, Number(input) || 0));
    if (!days) return;
    const until = new Date(`${today}T00:00:00`);
    until.setDate(until.getDate() + days - 1);
    const untilStr = until.toISOString().slice(0, 10);
    await setDoc(doc(db, 'users', uid, 'progress', 'main'),
      { vacationUntil: untilStr, updatedAt: serverTimestamp() }, { merge: true });
    toast.success(`${untilStr}까지 휴가 모드`);
  };

  const endVacation = async () => {
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'progress', 'main'),
      { vacationUntil: null, updatedAt: serverTimestamp() }, { merge: true });
    toast('휴가 모드를 해제했어요');
  };

  const takeSickDay = async () => {
    if (!uid) return;
    const month = today.slice(0, 7);
    const usedThisMonth = sickDays?.month === month ? sickDays.daysUsed : 0;
    if (usedThisMonth >= 1) {
      toast.error('이번 달 아픔 데이를 이미 사용했어요');
      return;
    }
    const ok = await confirm({
      title: '오늘 아픔 데이를 사용할까요?',
      description: '이번 달 1회만 사용할 수 있으며, 오늘 하루 스트릭이 보호됩니다.',
      confirmLabel: '사용하기',
    });
    if (!ok) return;
    await setDoc(doc(db, 'users', uid, 'progress', 'main'), {
      sickDays: { month, daysUsed: usedThisMonth + 1 },
      vacationUntil: today,   // 오늘 하루 스트릭 보호
      updatedAt: serverTimestamp(),
    }, { merge: true });
    toast.success('오늘은 푹 쉬세요. 스트릭은 지켜드릴게요');
  };

  const vacationActive = !!vacationUntil && vacationUntil >= today;
  const sickUsedThisMonth = sickDays?.month === today.slice(0, 7) ? sickDays.daysUsed : 0;

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

  const onLogout = async () => {
    if (isGuest) {
      const ok = await confirm({
        title: '게스트 종료',
        description: '로그아웃하면 이 기기에서 지금까지 가꾼 정원에 다시 접근할 수 없어요. 계속할까요?',
        confirmLabel: '종료',
        destructive: true,
      });
      if (!ok) return;
    }
    signOutUser();
  };

  return (
    <div className="min-h-full p-4 pb-6">
      <h2 className="py-2 text-lg font-semibold text-[var(--fg-primary)]">더보기</h2>

      {/* 가입 유도 — 게스트/미승인 사용자 */}
      {!isPremium && (
        <SignupCTA
          title={isGuest ? '가입하고 내 정원 지키기' : '승인 대기 중'}
          desc="AI 코치·주간 인사이트·여러 기기 동기화·푸시 알림이 열려요. 지금까지 가꾼 정원은 그대로 유지됩니다."
        />
      )}

      {/* 바로가기 */}
      <SectionLabel>바로가기</SectionLabel>
      <Card padding="none" className="divide-y divide-[var(--border-soft)]">
        {NAV_ITEMS
          .filter((it) => !(isGuest && it.to === '/admin'))
          .map(({ icon: Icon, label, to }) => (
            <ListRow
              key={to}
              icon={<Icon size={18} />}
              label={label}
              onClick={() => navigate(to)}
            />
          ))}
      </Card>

      {/* 설정 */}
      <SectionLabel>설정</SectionLabel>
      <Card padding="none" className="divide-y divide-[var(--border-soft)]">
        {isPremium && (
          <ListRow
            icon={<Bell size={18} />}
            label="푸시 알림"
            desc="시간대별 리마인더 (FCM)"
            trailing={<Switch checked={push} onCheckedChange={onPushToggle} />}
          />
        )}
        <ListRow
          icon={<Vibrate size={18} />}
          label="햅틱"
          desc="체크 시 진동"
          trailing={
            <Switch
              checked={haptic}
              onCheckedChange={(v) => { setHapticEnabled(v); setHapt(v); if (v) feedback('check'); }}
            />
          }
        />
        <ListRow
          icon={<Volume2 size={18} />}
          label="사운드"
          desc="체크 시 짧은 음"
          trailing={
            <Switch
              checked={sound}
              onCheckedChange={(v) => { setSoundEnabled(v); setSnd(v); if (v) feedback('achieve'); }}
            />
          }
        />
        <ListRow
          icon={<HandHeart size={18} />}
          label="신앙 기능"
          desc="경건·기도제목 메뉴 표시"
          trailing={<Switch checked={faithEnabled} onCheckedChange={onFaithToggle} />}
        />
      </Card>

      {/* 스트릭 보호 (B-4) */}
      <SectionLabel>스트릭 보호</SectionLabel>
      <Card className="space-y-3">
        <p className="text-xs leading-snug text-[var(--fg-faint)]">
          매주 1회는 자동 그레이스로 스트릭이 보호돼요. 길게 쉴 땐 휴가 모드, 아픈 날엔 아픔 데이(월 1회)를 쓰세요.
        </p>

        {vacationActive ? (
          <ListRow
            className="rounded-[var(--radius-sm)] bg-[var(--leaf-soft)] px-3 py-2.5"
            icon={<Palmtree size={18} />}
            label={`휴가 모드 켜짐 — ${vacationUntil}까지`}
            desc="탭하면 해제"
            onClick={endVacation}
            chevron={false}
          />
        ) : (
          <ListRow
            className="rounded-[var(--radius-sm)] bg-[var(--bg-base)] px-3 py-2.5"
            icon={<Palmtree size={18} />}
            label="휴가 모드 시작"
            onClick={startVacation}
            chevron={false}
          />
        )}

        <ListRow
          className="rounded-[var(--radius-sm)] bg-[var(--bg-base)] px-3 py-2.5"
          icon={<Thermometer size={18} className="text-[var(--bloom)]" />}
          label="오늘 아픔 데이"
          onClick={takeSickDay}
          disabled={sickUsedThisMonth >= 1}
          trailing={
            <Badge variant={sickUsedThisMonth >= 1 ? 'neutral' : 'bloom-soft'}>
              {sickUsedThisMonth >= 1 ? '이번 달 사용 완료' : '이번 달 1회'}
            </Badge>
          }
        />
      </Card>

      {/* 계정 */}
      <SectionLabel>계정</SectionLabel>
      <Card padding="none" className="divide-y divide-[var(--border-soft)]">
        {!isStandalone && (
          <ListRow
            icon={<Download size={18} />}
            label="앱으로 설치"
            desc="홈 화면에 설치하면 푸시 알림이 크롬과 분리됩니다"
            onClick={onInstallClick}
          />
        )}
        <ListRow
          icon={<LogOut size={18} />}
          label={isGuest ? '게스트 종료' : '로그아웃'}
          tone="danger"
          onClick={onLogout}
          chevron={false}
        />
      </Card>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-1.5 pt-4 text-xs font-medium text-[var(--fg-faint)]">{children}</p>
  );
}
