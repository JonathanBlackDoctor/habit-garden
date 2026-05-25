import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import TabBar from './TabBar';
import CelebrationOverlay from '@/features/habits/CelebrationOverlay';
import LevelUpModal from '@/features/garden/LevelUpModal';
import { useLevelUpWatcher } from '@/features/garden/useLevelUpWatcher';
import { useSwipeNavigation } from '@/lib/useSwipeNavigation';
import { ScrollTopContext } from '@/lib/scrollContext';
import { useVisibleTabs } from '@/lib/tabs';

const SLIDE = 28;
const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? SLIDE : dir < 0 ? -SLIDE : 0, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -SLIDE : dir < 0 ? SLIDE : 0, opacity: 0 }),
};

export default function AppLayout() {
  useLevelUpWatcher();
  const scrollRef = useRef<HTMLDivElement>(null);
  const swipe = useSwipeNavigation();
  const location = useLocation();
  const outlet = useOutlet();
  const tabs = useVisibleTabs();

  const scrollToTop = useCallback(() => {
    // 실제 스크롤러가 내부 컨테이너일 수도, document일 수도 있어 둘 다 호출(비스크롤러는 no-op)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // 탭 순서 기준 이동 방향(+1 오른쪽 / -1 왼쪽)으로 슬라이드 방향 결정
  const tabIndexOf = (path: string) =>
    tabs.findIndex((t) => (t.to === '/' ? path === '/' : path.startsWith(t.to)));
  const prevPath = useRef(location.pathname);
  const from = tabIndexOf(prevPath.current);
  const to = tabIndexOf(location.pathname);
  const direction = from === -1 || to === -1 ? 0 : Math.sign(to - from);
  useEffect(() => { prevPath.current = location.pathname; }, [location.pathname]);

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
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={location.pathname}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </div>
        <TabBar />
        <CelebrationOverlay />
        <LevelUpModal />
      </div>
    </ScrollTopContext.Provider>
  );
}
