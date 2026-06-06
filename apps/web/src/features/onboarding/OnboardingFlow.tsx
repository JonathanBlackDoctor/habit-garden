import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { markOnboarded } from './onboardingState';
import WelcomeCarousel from './WelcomeCarousel';
import SpotlightTour from './SpotlightTour';

type Phase = 'welcome' | 'tour';

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
          <SpotlightTour key="tour" onDone={finish} />
        )
      )}
    </AnimatePresence>
  );
}
