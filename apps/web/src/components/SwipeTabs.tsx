import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useVisibleTabs } from '@/lib/tabs';
import Main from '@/routes/Main';
import Habits from '@/routes/Habits';
import Garden from '@/routes/Garden';
import Prayers from '@/routes/Prayers';
import Progress from '@/routes/Progress';
import More from '@/routes/More';

// 인접 탭을 드래그 중에만 렌더하기 위한 경로 → 페이지 매핑
const TAB_ELEMENTS: Record<string, ReactElement> = {
  '/': <Main />,
  '/habits': <Habits />,
  '/garden': <Garden />,
  '/prayers': <Prayers />,
  '/progress': <Progress />,
  '/more': <More />,
};

const LOCK_PX = 10;          // 가로 제스처로 확정하는 최소 이동
const COMMIT_RATIO = 0.26;   // 화면 폭 대비 탭 전환 임계
const COMMIT_VELOCITY = 0.45; // px/ms 이상이면 거리와 무관하게 전환
const SPRING = { type: 'spring' as const, stiffness: 420, damping: 42, restDelta: 0.4 };

type Neighbor = { path: string; side: 'left' | 'right' };

export default function SwipeTabs() {
  const tabs = useVisibleTabs();
  const location = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();

  const containerRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const dragX = useMotionValue(0);
  const [neighbor, setNeighbor] = useState<Neighbor | null>(null);

  const tabIndex = tabs.findIndex((t) =>
    t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to),
  );
  const isTabRoute = tabIndex !== -1;

  const neighborX = useTransform(dragX, (v) =>
    v + (neighbor?.side === 'right' ? widthRef.current : -widthRef.current),
  );

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

  // 탭 탭(또는 뒤로가기 등 외부 이동) 시 방향성 슬라이드-인 (paint 전에 오프셋 적용해 깜빡임 방지)
  const prevPath = useRef(location.pathname);
  const internalNav = useRef(false);
  useLayoutEffect(() => {
    if (prevPath.current === location.pathname) return;
    const oldI = tabs.findIndex((t) => (t.to === '/' ? prevPath.current === '/' : prevPath.current.startsWith(t.to)));
    const newI = tabIndex;
    prevPath.current = location.pathname;
    if (internalNav.current) { internalNav.current = false; return; }
    if (oldI === -1 || newI === -1 || oldI === newI) return;
    const W = widthRef.current || 1;
    dragX.set(newI > oldI ? W : -W);
    animate(dragX, 0, SPRING);
  }, [location.pathname, tabIndex, tabs, dragX]);

  // 제스처 처리 (touchmove는 preventDefault 위해 non-passive로 직접 등록)
  const gesture = useRef({ startX: 0, startY: 0, lastX: 0, lastT: 0, locked: false, ignore: false, vx: 0 });
  const animating = useRef(false);

  const settle = useCallback(
    (commit: boolean, nb: Neighbor | null) => {
      const W = widthRef.current || 1;
      animating.current = true;
      if (commit && nb) {
        const target = nb.side === 'right' ? -W : W;
        animate(dragX, target, SPRING).then(() => {
          internalNav.current = true;
          // 새 탭은 최상단부터 — 실제 스크롤러(document 또는 조상 컨테이너)를 모두 초기화
          window.scrollTo({ top: 0 });
          for (let n = containerRef.current?.parentElement; n; n = n.parentElement) {
            if (n.scrollHeight > n.clientHeight) n.scrollTop = 0;
          }
          navigate(nb.path);
          dragX.set(0);
          // 새 화면이 뒤에서 중앙에 깔린 뒤 인접 레이어 제거(깜빡임 방지)
          requestAnimationFrame(() => requestAnimationFrame(() => {
            setNeighbor(null);
            animating.current = false;
          }));
        });
      } else {
        animate(dragX, 0, SPRING).then(() => {
          setNeighbor(null);
          animating.current = false;
        });
      }
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
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { g.ignore = true; return; }
        if (Math.abs(dx) > LOCK_PX && Math.abs(dx) >= Math.abs(dy)) {
          g.locked = true;
          const dir: 1 | -1 = dx < 0 ? 1 : -1;
          const path = pathInDir(dir);
          setNeighbor(path ? { path, side: dir === 1 ? 'right' : 'left' } : null);
        } else {
          return;
        }
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
      const nb = pathInDir(dir) ? ({ path: pathInDir(dir) as string, side: dir === 1 ? 'right' : 'left' } as Neighbor) : null;
      const commit = !!nb && (Math.abs(offset) > W * COMMIT_RATIO || Math.abs(g.vx) > COMMIT_VELOCITY);
      settle(commit, nb);
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
      {neighbor && (
        <motion.div
          style={{ x: neighborX, height: '100dvh' }}
          className="fixed inset-0 z-30 mx-auto max-w-[480px] overflow-hidden bg-[var(--bg-base)]"
        >
          {TAB_ELEMENTS[neighbor.path]}
        </motion.div>
      )}
    </div>
  );
}
