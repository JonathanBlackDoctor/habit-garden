import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { animate, motion, useMotionValue } from 'framer-motion';
import { useVisibleTabs } from '@/lib/tabs';

const LOCK_PX = 10;           // 가로 제스처로 확정하는 최소 이동
const COMMIT_RATIO = 0.26;    // 화면 폭 대비 탭 전환 임계
const COMMIT_VELOCITY = 0.45; // px/ms 이상이면 거리와 무관하게 전환
const SPRING = { type: 'spring' as const, stiffness: 420, damping: 42, restDelta: 0.4 };
const EXIT = { type: 'spring' as const, stiffness: 560, damping: 52, restDelta: 0.5 };

export default function SwipeTabs() {
  const tabs = useVisibleTabs();
  const location = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();

  const containerRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const dragX = useMotionValue(0);

  const tabIndex = tabs.findIndex((t) =>
    t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to),
  );
  const isTabRoute = tabIndex !== -1;

  const pathInDir = useCallback(
    (dir: 1 | -1) => {
      const i = tabIndex + dir;
      return i >= 0 && i < tabs.length ? tabs[i].to : null;
    },
    [tabIndex, tabs],
  );

  // 폭 측정
  useEffect(() => {
    const measure = () => { widthRef.current = containerRef.current?.clientWidth || window.innerWidth; };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // 네비게이션(탭 탭 / 스와이프 커밋 / 뒤로가기) 시 새 화면이 방향에 맞게 슬라이드-인.
  // useLayoutEffect로 paint 전에 시작 오프셋을 적용해 깜빡임 방지.
  const prevPath = useRef(location.pathname);
  useLayoutEffect(() => {
    if (prevPath.current === location.pathname) return;
    const oldI = tabs.findIndex((t) =>
      t.to === '/' ? prevPath.current === '/' : prevPath.current.startsWith(t.to),
    );
    const newI = tabIndex;
    prevPath.current = location.pathname;
    if (oldI === -1 || newI === -1 || oldI === newI) { dragX.set(0); return; }
    const W = widthRef.current || 1;
    dragX.set(newI > oldI ? W : -W);
    animate(dragX, 0, SPRING);
  }, [location.pathname, tabIndex, tabs, dragX]);

  const gesture = useRef({ startX: 0, startY: 0, lastX: 0, lastT: 0, locked: false, ignore: false, vx: 0 });
  const animating = useRef(false);

  const resetScroll = () => {
    window.scrollTo({ top: 0 });
    for (let n = containerRef.current?.parentElement; n; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight) n.scrollTop = 0;
    }
  };

  // 커밋: 현재 화면을 드래그 방향으로 끝까지 밀어낸 뒤 1회 navigate → 새 화면 슬라이드-인(단일 마운트)
  const settle = useCallback(
    (commitPath: string | null, dir: 1 | -1) => {
      if (!commitPath) { animate(dragX, 0, SPRING); return; }
      animating.current = true;
      const W = widthRef.current || 1;
      animate(dragX, dir === 1 ? -W : W, EXIT).then(() => {
        resetScroll();
        navigate(commitPath);
        animating.current = false;
      });
    },
    [dragX, navigate],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isTabRoute) return;

    const onStart = (e: TouchEvent) => {
      const g = gesture.current;
      if (animating.current || e.touches.length !== 1) { g.ignore = true; return; }
      const target = e.target as Element;
      if (target.closest('[data-bed-pager]') || target.closest('[data-no-swipe]')) { g.ignore = true; return; }
      const t = e.touches[0];
      g.startX = t.clientX; g.startY = t.clientY; g.lastX = t.clientX;
      g.lastT = performance.now(); g.locked = false; g.ignore = false; g.vx = 0;
    };

    const onMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (g.ignore) return;
      const t = e.touches[0];
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;
      if (!g.locked) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { g.ignore = true; return; } // 세로 스크롤
        if (Math.abs(dx) > LOCK_PX && Math.abs(dx) >= Math.abs(dy)) g.locked = true;
        else return;
      }
      e.preventDefault();
      const now = performance.now();
      const dt = now - g.lastT || 16;
      g.vx = (t.clientX - g.lastX) / dt;
      g.lastX = t.clientX; g.lastT = now;
      const hasNeighbor = !!pathInDir(dx < 0 ? 1 : -1);
      dragX.set(hasNeighbor ? dx : dx * 0.3); // 끝에서는 고무줄 저항
    };

    const onEnd = () => {
      const g = gesture.current;
      if (g.ignore || !g.locked) { g.ignore = false; g.locked = false; return; }
      g.locked = false;
      const W = widthRef.current || 1;
      const offset = dragX.get();
      const dir: 1 | -1 = offset < 0 ? 1 : -1;
      const dest = pathInDir(dir);
      const commit = !!dest && (Math.abs(offset) > W * COMMIT_RATIO || Math.abs(g.vx) > COMMIT_VELOCITY);
      settle(commit ? dest : null, dir);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [isTabRoute, pathInDir, dragX, settle]);

  if (!isTabRoute) return <>{outlet}</>;

  return (
    <div ref={containerRef} className="relative" style={{ touchAction: 'pan-y' }}>
      <motion.div style={{ x: dragX }}>{outlet}</motion.div>
    </div>
  );
}
