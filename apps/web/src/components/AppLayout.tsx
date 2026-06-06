import { useCallback, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { animate } from 'framer-motion';
import TabBar from './TabBar';
import CelebrationOverlay from '@/features/habits/CelebrationOverlay';
import LevelUpModal from '@/features/garden/LevelUpModal';
import { useLevelUpWatcher } from '@/features/garden/useLevelUpWatcher';
import { ScrollTopContext } from '@/lib/scrollContext';
import { TabActiveContext } from '@/lib/tabActive';
import { useVisibleTabs } from '@/lib/tabs';
import SwipeTabs from './SwipeTabs';
import OnboardingFlow from '@/features/onboarding/OnboardingFlow';
import { useOnboardingTrigger } from '@/features/onboarding/useOnboardingTrigger';

export default function AppLayout() {
  useLevelUpWatcher();
  useOnboardingTrigger();
  const hostRef = useRef<HTMLDivElement>(null);
  const tabs = useVisibleTabs();
  const location = useLocation();
  const [retapNonce, setRetapNonce] = useState(0);

  const activePath =
    tabs.find((t) => (t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to)))?.to ?? null;

  // 재탭: 활성 패널을 빠르게 최상단으로(커스텀 0.3s) + 진입 애니메이션 재생 신호(nonce++)
  const onReTap = useCallback(() => {
    // 습관 탭은 재탭 시 자체적으로 '현재 시간대로 스크롤'을 수행하므로 맨 위로 스크롤을 건너뛴다
    if (activePath === '/habits') {
      setRetapNonce((n) => n + 1);
      return;
    }
    const el =
      hostRef.current?.querySelector<HTMLElement>('[data-active-panel]')
      ?? (hostRef.current?.firstElementChild as HTMLElement | null);
    if (el && el.scrollTop > 0) {
      animate(el.scrollTop, 0, {
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (v) => { el.scrollTop = v; },
      });
    }
    setRetapNonce((n) => n + 1);
  }, [activePath]);

  return (
    <ScrollTopContext.Provider value={onReTap}>
      <TabActiveContext.Provider value={{ path: activePath, nonce: retapNonce }}>
        <div
          className="fixed inset-0 mx-auto flex max-w-[480px] flex-col bg-[var(--bg-base)]"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'calc(64px + env(safe-area-inset-bottom))',
          }}
        >
          <div ref={hostRef} className="flex-1 min-h-0 overflow-hidden">
            <SwipeTabs />
          </div>
          <TabBar />
          <CelebrationOverlay />
          <LevelUpModal />
          <OnboardingFlow />
        </div>
      </TabActiveContext.Provider>
    </ScrollTopContext.Provider>
  );
}
