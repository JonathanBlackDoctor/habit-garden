import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { signOutUser, isOwner } from '@/lib/auth';
import { Cloud, BookOpen, Settings, LogOut, Bell, ChevronRight, Vibrate, Volume2, HandHeart, Download, GraduationCap, Palmtree, Thermometer, ShieldCheck, Sparkles, Share2, MessageCircle, Tags, BarChart2, LayoutGrid } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { isFcmEnabled } from '@/lib/fcm';
import ToggleRow from '@/components/ToggleRow';
import {
  isHapticEnabled, setHapticEnabled,
  isSoundEnabled,  setSoundEnabled,
  feedback,
} from '@/lib/feedback';
import { useFaithEnabled, setFaithEnabled, useIsGuest, useIsPremium } from '@/lib/features';
import { usePwaInstall } from '@/lib/pwaInstall';
import { APP_SHARE_URL } from '@/lib/inquiries';
import ContactDialog from '@/features/contact/ContactDialog';
import PrayerTaxonomyManager from '@/features/prayers/PrayerTaxonomyManager';
import SignupCTA from '@/components/SignupCTA';

const items = [
  { icon: BarChart2,     label: '진척 현황', to: '/progress' },
  { icon: GraduationCap, label: '사용 설명서', to: '/tutorial' },
  { icon: Cloud,         label: '컨디션',   to: '/condition' },
  { icon: BookOpen,      label: '플래너',   to: '/planner' },
  { icon: Settings,      label: '관리',     to: '/admin' },
];

export default function More() {
  const navigate = useNavigate();
  const startOnboarding = useAppStore((s) => s.startOnboarding);
  const startPrayerTour = useAppStore((s) => s.startPrayerTour);
  const openWidgetEdit  = useAppStore((s) => s.openWidgetEdit);
  const uid = useAppStore((s) => s.uid);
  const realUid = useAppStore((s) => s.realUid);
  const today = useAppStore((s) => s.currentDate);
  const [push, setPush]   = useState(false);
  const [haptic, setHapt] = useState(false);
  const [sound, setSnd]   = useState(false);
  const [vacationUntil, setVacationUntil] = useState<string | null>(null);
  const [sickDays, setSickDays] = useState<{ month: string; daysUsed: number } | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);
  const faithEnabled = useFaithEnabled();
  const isGuest = useIsGuest();
  const isPremium = useIsPremium();
  const { canInstall, isStandalone, isIOS, promptInstall } = usePwaInstall();

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
    const input = prompt('며칠간 휴가 모드로 스트릭을 동결할까요?', '7');
    if (!input) return;
    const days = Math.max(1, Math.min(60, Number(input) || 0));
    if (!days) return;
    const until = new Date(`${today}T00:00:00`);
    until.setDate(until.getDate() + days - 1);
    const untilStr = until.toISOString().slice(0, 10);
    await setDoc(doc(db, 'users', uid, 'progress', 'main'),
      { vacationUntil: untilStr, updatedAt: serverTimestamp() }, { merge: true });
    toast.success(`🌴 ${untilStr}까지 휴가 모드`);
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
    if (!window.confirm('오늘 아픔 데이를 사용할까요?\n이번 달 1회만 사용할 수 있으며, 오늘 하루 스트릭이 보호됩니다.')) {
      return;
    }
    await setDoc(doc(db, 'users', uid, 'progress', 'main'), {
      sickDays: { month, daysUsed: usedThisMonth + 1 },
      vacationUntil: today,   // 오늘 하루 스트릭 보호
      updatedAt: serverTimestamp(),
    }, { merge: true });
    toast.success('🤒 오늘은 푹 쉬세요. 스트릭은 지켜드릴게요');
  };

  const vacationActive = !!vacationUntil && vacationUntil >= today;
  const sickUsedThisMonth = sickDays?.month === today.slice(0, 7) ? sickDays.daysUsed : 0;

  const onFaithToggle = async () => {
    if (!uid) return;
    const next = !faithEnabled;
    await setFaithEnabled(uid, next);
    // 신앙 기능을 켤 때마다 기도 튜토리얼을 진행한다.
    if (next) startPrayerTour();
  };

  const onShare = async () => {
    const shareData = {
      title: '습관 정원',
      text: '습관을 체크하면 정원이 자라는 앱, 습관 정원 🌱 같이 해요!',
      url: APP_SHARE_URL,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(APP_SHARE_URL);
      toast.success('링크를 복사했어요. 친구에게 공유해보세요!');
    } catch (e: any) {
      // 사용자가 공유 시트를 취소한 경우(AbortError)는 무시
      if (e?.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(APP_SHARE_URL);
        toast.success('링크를 복사했어요. 친구에게 공유해보세요!');
      } catch {
        toast.error('공유에 실패했어요. 링크: ' + APP_SHARE_URL);
      }
    }
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

      {/* 가입 유도 — 게스트/미승인 사용자 */}
      {!isPremium && (
        <SignupCTA
          title={isGuest ? '가입하고 내 정원 지키기' : '승인 대기 중'}
          desc="AI 코치·주간 인사이트·여러 기기 동기화·푸시 알림이 열려요. 지금까지 가꾼 정원은 그대로 유지됩니다."
        />
      )}

      <p className="px-1 pt-2 text-[11px] font-medium text-[var(--fg-faint)]">바로가기</p>
      {items
        .filter((it) => !(it.to === '/admin' && !isOwner(realUid)))
        .map(({ icon: Icon, label, to }) => (
        <button
          key={to}
          onClick={() => navigate(to)}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] active:opacity-70"
        >
          <Icon size={18} className="text-[var(--leaf)]" />
          {label}
        </button>
      ))}

      {/* 인터랙티브 온보딩 다시 보기 (웰컴 + 화면 가이드) */}
      <button
        onClick={startOnboarding}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] active:opacity-70"
      >
        <Sparkles size={18} className="text-[var(--leaf)]" />
        튜토리얼 다시 보기
      </button>

      {/* 공유 · 문의 */}
      <p className="px-1 pt-3 text-[11px] font-medium text-[var(--fg-faint)]">함께하기</p>
      <button
        onClick={onShare}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] active:opacity-70 text-left"
      >
        <Share2 size={18} className="text-[var(--leaf)]" />
        <div className="flex-1">
          <p>친구에게 공유하기</p>
          <p className="text-[10px] text-[var(--fg-faint)]">습관 정원을 더 많은 사람과 나눠보세요</p>
        </div>
      </button>
      <button
        onClick={() => setContactOpen(true)}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] active:opacity-70 text-left"
      >
        <MessageCircle size={18} className="text-[var(--leaf)]" />
        <div className="flex-1">
          <p>관리자에게 문의</p>
          <p className="text-[10px] text-[var(--fg-faint)]">버그 신고·문의사항을 보내고 답변을 받아요</p>
        </div>
      </button>

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />

      {/* 피드백 / 알림 설정 (Phase 1-2, 3-1) */}
      <p className="px-1 pt-3 text-[11px] font-medium text-[var(--fg-faint)]">설정</p>
      {isPremium && (
        <button
          onClick={() => navigate('/settings/notifications')}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] active:opacity-70 text-left"
        >
          <Bell size={18} className="text-[var(--leaf)]" />
          <div className="flex-1">
            <p>푸시 알림</p>
            <p className="text-[10px] text-[var(--fg-faint)]">
              {push ? '켜짐 · 알림 종류·시간 설정' : '꺼짐 · 탭하여 켜기'}
            </p>
          </div>
          <ChevronRight size={16} className="text-[var(--fg-faint)]" />
        </button>
      )}
      <div className="rounded-[var(--radius)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] divide-y divide-[var(--leaf-soft)]">
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

      {/* 오늘 탭 위젯 순서 편집 */}
      <button
        onClick={() => { openWidgetEdit(); navigate('/'); }}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] active:opacity-70 text-left"
      >
        <LayoutGrid size={18} className="text-[var(--leaf)]" />
        <div className="flex-1">
          <p>오늘 탭 위젯 편집</p>
          <p className="text-[10px] text-[var(--fg-faint)]">위젯 순서를 바꾸거나 필요 없는 위젯을 숨겨요</p>
        </div>
      </button>

      {/* 기도 분류 관리 — 모임/대상 이름 변경·병합 */}
      {faithEnabled && (
        <button
          onClick={() => setTaxonomyOpen(true)}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] active:opacity-70 text-left"
        >
          <Tags size={18} className="text-[var(--leaf)]" />
          <div className="flex-1">
            <p>기도 분류 관리</p>
            <p className="text-[10px] text-[var(--fg-faint)]">모임·대상 이름을 바꾸거나 하나로 합쳐요</p>
          </div>
        </button>
      )}
      {faithEnabled && <PrayerTaxonomyManager open={taxonomyOpen} onOpenChange={setTaxonomyOpen} />}

      {/* 스트릭 보호 (B-4) */}
      <div className="mt-4 rounded-[var(--radius)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)] space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-[var(--leaf)]" />
          <p className="text-sm font-medium text-[var(--fg-primary)]">스트릭 보호</p>
        </div>
        <p className="text-[11px] leading-snug text-[var(--fg-faint)]">
          매주 1회는 자동 그레이스로 스트릭이 보호돼요. 길게 쉴 땐 휴가 모드, 아픈 날엔 아픔 데이(월 1회)를 쓰세요.
        </p>

        {vacationActive ? (
          <button
            onClick={endVacation}
            className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--leaf-soft)] px-3 py-2.5 text-left text-sm active:opacity-70"
          >
            <Palmtree size={16} className="text-[var(--leaf)]" />
            <div className="flex-1">
              <p className="text-[var(--fg-primary)]">휴가 모드 켜짐 — {vacationUntil}까지</p>
              <p className="text-[10px] text-[var(--fg-faint)]">탭하면 해제</p>
            </div>
          </button>
        ) : (
          <button
            onClick={startVacation}
            className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--bg-base)] px-3 py-2.5 text-left text-sm active:opacity-70"
          >
            <Palmtree size={16} className="text-[var(--leaf)]" />
            <span className="text-[var(--fg-primary)]">🌴 휴가 모드 시작</span>
          </button>
        )}

        <button
          onClick={takeSickDay}
          disabled={sickUsedThisMonth >= 1}
          className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--bg-base)] px-3 py-2.5 text-left text-sm active:opacity-70 disabled:opacity-40"
        >
          <Thermometer size={16} className="text-[var(--bloom)]" />
          <div className="flex-1">
            <p className="text-[var(--fg-primary)]">🤒 오늘 아픔 데이</p>
            <p className="text-[10px] text-[var(--fg-faint)]">
              {sickUsedThisMonth >= 1 ? '이번 달 사용 완료' : '이번 달 1회 남음'}
            </p>
          </div>
        </button>
      </div>

      <p className="px-1 pt-3 text-[11px] font-medium text-[var(--fg-faint)]">계정</p>
      {!isStandalone && (
        <button
          onClick={onInstallClick}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] active:opacity-70 text-left"
        >
          <Download size={18} className="text-[var(--leaf)]" />
          <div className="flex-1">
            <p>앱으로 설치</p>
            <p className="text-[10px] text-[var(--fg-faint)]">홈 화면에 설치하면 푸시 알림이 크롬과 분리됩니다</p>
          </div>
        </button>
      )}

      <button
        onClick={() => {
          if (isGuest && !window.confirm('게스트로 둘러보는 중이에요. 로그아웃하면 이 기기에서 지금까지 가꾼 정원에 다시 접근할 수 없어요. 계속할까요?')) {
            return;
          }
          signOutUser();
        }}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-red-500 shadow-[var(--shadow-sm)] active:opacity-70 mt-2"
      >
        <LogOut size={18} />
        {isGuest ? '게스트 종료' : '로그아웃'}
      </button>
    </div>
  );
}

