import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { markOnboarded } from './onboardingState';
import WelcomeCarousel from './WelcomeCarousel';
import SpotlightTour, { type Step } from './SpotlightTour';

type Phase = 'welcome' | 'tour';

const MAIN_TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="hero"]',
    title: '내 정원 현황',
    body: '레벨 · 🔥스트릭 · 사용 가능 포인트를 여기서 한눈에 확인해요.',
  },
  {
    target: '[data-tour="today"]',
    title: '오늘의 습관',
    body: '오늘 달성률과 시간대별 현황이 보여요. 탭하면 바로 체크 화면으로 이동합니다.',
  },
  {
    target: '[data-tour="tabbar"]',
    title: '화면 이동',
    body: '하단 탭으로 오늘 · 습관 · 정원 · 진척 · 더보기를 자유롭게 오갈 수 있어요.',
  },
  {
    target: '[data-tour="habit-first"]',
    title: '습관 체크하기',
    body: '습관을 눌러 0~5점을 매겨요. 둘러보기를 마치면 직접 한번 체크해보세요!',
    route: '/habits',
  },
];

/**
 * 온보딩 오케스트레이터: 웰컴 캐러셀 → 인터랙티브 스포트라이트 가이드.
 * AppLayout 안(탭바·오버레이의 형제)에 마운트되어 앱 전체를 덮는다.
 */
export default function OnboardingFlow() {
  const open = useAppStore((s) => s.onboardingOpen);
  const close = useAppStore((s) => s.closeOnboarding);
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>('welcome');

  // 열릴 때마다 웰컴부터 시작하고, 스포트라이트 타깃이 있는 메인('/')으로 이동
  useEffect(() => {
    if (!open) return;
    setPhase('welcome');
    if (location.pathname !== '/') navigate('/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const finish = () => {
    markOnboarded();
    close();
    toast.success('이제 정원을 가꿔볼까요? 🌱');
  };

  const skip = () => {
    markOnboarded();
    close();
  };

  return (
    <AnimatePresence>
      {open && (
        phase === 'welcome' ? (
          <WelcomeCarousel
            key="welcome"
            onStart={() => setPhase('tour')}
            onSkip={skip}
          />
        ) : (
          <SpotlightTour key="tour" steps={MAIN_TOUR_STEPS} onDone={finish} />
        )
      )}
    </AnimatePresence>
  );
}
