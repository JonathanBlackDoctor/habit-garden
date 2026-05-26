import { useCallback, useRef } from 'react';
import TabBar from './TabBar';
import CelebrationOverlay from '@/features/habits/CelebrationOverlay';
import LevelUpModal from '@/features/garden/LevelUpModal';
import { useLevelUpWatcher } from '@/features/garden/useLevelUpWatcher';
import { ScrollTopContext } from '@/lib/scrollContext';
import SwipeTabs from './SwipeTabs';

export default function AppLayout() {
  useLevelUpWatcher();
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollToTop = useCallback(() => {
    // 실제 스크롤러는 활성 탭 패널(없으면 비탭 라우트 컨테이너)
    const target = hostRef.current?.querySelector<HTMLElement>('[data-active-panel]')
      ?? hostRef.current?.firstElementChild as HTMLElement | null;
    target?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  return (
    <ScrollTopContext.Provider value={scrollToTop}>
      <div
        className="mx-auto flex max-w-[480px] flex-col bg-[var(--bg-base)]"
        style={{ height: '100dvh', paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        <div ref={hostRef} className="flex-1 min-h-0 overflow-hidden">
          <SwipeTabs />
        </div>
        <TabBar />
        <CelebrationOverlay />
        <LevelUpModal />
      </div>
    </ScrollTopContext.Provider>
  );
}
