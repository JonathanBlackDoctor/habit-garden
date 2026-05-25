import { useCallback, useRef } from 'react';
import TabBar from './TabBar';
import CelebrationOverlay from '@/features/habits/CelebrationOverlay';
import LevelUpModal from '@/features/garden/LevelUpModal';
import { useLevelUpWatcher } from '@/features/garden/useLevelUpWatcher';
import { ScrollTopContext } from '@/lib/scrollContext';
import SwipeTabs from './SwipeTabs';

export default function AppLayout() {
  useLevelUpWatcher();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollToTop = useCallback(() => {
    // 실제 스크롤러가 내부 컨테이너일 수도, document일 수도 있어 둘 다 호출(비스크롤러는 no-op)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  return (
    <ScrollTopContext.Provider value={scrollToTop}>
      <div
        className="mx-auto flex max-w-[480px] flex-col bg-[var(--bg-base)]"
        style={{ minHeight: '100dvh', paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
          <SwipeTabs />
        </div>
        <TabBar />
        <CelebrationOverlay />
        <LevelUpModal />
      </div>
    </ScrollTopContext.Provider>
  );
}
