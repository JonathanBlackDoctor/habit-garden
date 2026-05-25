import { useCallback, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';
import CelebrationOverlay from '@/features/habits/CelebrationOverlay';
import LevelUpModal from '@/features/garden/LevelUpModal';
import { useLevelUpWatcher } from '@/features/garden/useLevelUpWatcher';
import { useSwipeNavigation } from '@/lib/useSwipeNavigation';
import { ScrollTopContext } from '@/lib/scrollContext';

export default function AppLayout() {
  useLevelUpWatcher();
  const scrollRef = useRef<HTMLDivElement>(null);
  const swipe = useSwipeNavigation();
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  return (
    <ScrollTopContext.Provider value={scrollToTop}>
      <div
        className="mx-auto flex max-w-[480px] flex-col bg-[var(--bg-base)]"
        style={{ minHeight: '100dvh', paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          onTouchStart={swipe.onTouchStart}
          onTouchEnd={swipe.onTouchEnd}
        >
          <Outlet />
        </div>
        <TabBar />
        <CelebrationOverlay />
        <LevelUpModal />
      </div>
    </ScrollTopContext.Provider>
  );
}
