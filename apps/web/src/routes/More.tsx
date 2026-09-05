import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { signOutUser, isOwner } from '@/lib/auth';
import { Cloud, BookOpen, Settings, LogOut, Bell, ChevronRight, Vibrate, Volume2, HandHeart, Download, GraduationCap, Sparkles, Share2, MessageCircle, Tags, BarChart2, LayoutGrid, Leaf } from 'lucide-react';
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
import LifeContextEditor from '@/features/applications/LifeContextEditor';
import { hasLifeContext } from 'shared/lib/lifeContext';
import SignupCTA from '@/components/SignupCTA';
import { PageHeader } from '@/components/Editorial';

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
  const [push, setPush]   = useState(false);
  const [haptic, setHapt] = useState(false);
  const [sound, setSnd]   = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);
  const [lifeCtxOpen, setLifeCtxOpen] = useState(false);
  const lifeCtxSet = useAppStore((s) => hasLifeContext(s.settings?.lifeContext));
  const faithEnabled = useFaithEnabled();
  const isGuest = useIsGuest();
  const isPremium = useIsPremium();
  const { canInstall, isStandalone, isIOS, promptInstall } = usePwaInstall();

  useEffect(() => {
    setPush(isFcmEnabled());
    setHapt(isHapticEnabled());
    setSnd(isSoundEnabled());
  }, []);

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
      text: '매일의 작은 습관을 기록하고 돌아보는 앱, 습관 정원 🌱 같이 해요!',
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
    <div className="more-editorial page-pad min-h-full space-y-2">
      <PageHeader
        kicker="더보기"
        title="기록과 설정"
        summary="매일 쓰지 않는 화면은 여기 모았어요."
        className="pb-3"
      />

      {/* 가입 유도 — 게스트/미승인 사용자 */}
      {!isPremium && (
        <SignupCTA
          title={isGuest ? '가입하고 내 기록 지키기' : '승인 대기 중'}
          desc="AI 코치·주간 인사이트·여러 기기 동기화·푸시 알림이 열려요. 지금까지 쌓은 기록은 그대로 유지됩니다."
        />
      )}

      <p className="kicker px-0 pt-4">기록과 돌아보기</p>
      {items
        .filter((it) => !(it.to === '/admin' && !isOwner(realUid)))
        .map(({ label, to }) => (
        <button
          key={to}
          onClick={() => navigate(to)}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] active:opacity-70"
        >
          {label}
        </button>
      ))}

      {/* 인터랙티브 온보딩 다시 보기 (웰컴 + 화면 가이드) */}
      <button
        onClick={startOnboarding}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] active:opacity-70"
      >
        <Sparkles size={18} className="text-[var(--leaf)]" />
        튜토리얼 다시 보기
      </button>

      {/* 공유 · 문의 */}
      <p className="kicker px-0 pt-5">함께하기</p>
      <button
        onClick={onShare}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] active:opacity-70 text-left"
      >
        <Share2 size={18} className="text-[var(--leaf)]" />
        <div className="flex-1">
          <p>친구에게 공유하기</p>
          <p className="text-[10px] text-[var(--fg-faint)]">습관 정원을 더 많은 사람과 나눠보세요</p>
        </div>
      </button>
      <button
        onClick={() => setContactOpen(true)}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] active:opacity-70 text-left"
      >
        <MessageCircle size={18} className="text-[var(--leaf)]" />
        <div className="flex-1">
          <p>관리자에게 문의</p>
          <p className="text-[10px] text-[var(--fg-faint)]">버그 신고·문의사항을 보내고 답변을 받아요</p>
        </div>
      </button>

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />

      {/* 피드백 / 알림 설정 (Phase 1-2, 3-1) */}
      <p className="kicker px-0 pt-5">설정</p>
      {isPremium && (
        <button
          onClick={() => navigate('/settings/notifications')}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] active:opacity-70 text-left"
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
      <div className="settings-list">
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
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] active:opacity-70 text-left"
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
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] active:opacity-70 text-left"
        >
          <Tags size={18} className="text-[var(--leaf)]" />
          <div className="flex-1">
            <p>기도 분류 관리</p>
            <p className="text-[10px] text-[var(--fg-faint)]">모임·대상 이름을 바꾸거나 하나로 합쳐요</p>
          </div>
        </button>
      )}
      {faithEnabled && <PrayerTaxonomyManager open={taxonomyOpen} onOpenChange={setTaxonomyOpen} />}

      {/* 말씀 적용 — 내 생활 환경 (AI 정리는 승인 사용자 전용) */}
      {faithEnabled && isPremium && (
        <button
          onClick={() => setLifeCtxOpen(true)}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] active:opacity-70 text-left"
        >
          <Leaf size={18} className="text-[var(--leaf)]" />
          <div className="flex-1">
            <p>말씀 적용 — 내 생활 환경</p>
            <p className="text-[10px] text-[var(--fg-faint)]">
              {lifeCtxSet
                ? '입력됨 · AI가 내 삶에 맞게 적용을 추천해요'
                : '직업·가정·일과를 알려주면 더 와닿는 적용이 나와요'}
            </p>
          </div>
          <ChevronRight size={16} className="text-[var(--fg-faint)]" />
        </button>
      )}
      {faithEnabled && isPremium && <LifeContextEditor open={lifeCtxOpen} onOpenChange={setLifeCtxOpen} />}

      <p className="kicker px-0 pt-5">계정</p>
      {!isStandalone && (
        <button
          onClick={onInstallClick}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] active:opacity-70 text-left"
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
          if (isGuest && !window.confirm('게스트로 둘러보는 중이에요. 로그아웃하면 이 기기에서 지금까지 쌓은 기록에 다시 접근할 수 없어요. 계속할까요?')) {
            return;
          }
          signOutUser();
        }}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-red-500 active:opacity-70 mt-2"
      >
        <LogOut size={18} />
        {isGuest ? '게스트 종료' : '로그아웃'}
      </button>
    </div>
  );
}

