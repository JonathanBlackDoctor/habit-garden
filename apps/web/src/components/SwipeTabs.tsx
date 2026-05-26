import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { animate, motion, useMotionValue } from 'framer-motion';
import { useVisibleTabs } from '@/lib/tabs';
import { TabActiveContext } from '@/lib/tabActive';
import Main from '@/routes/Main';
import Habits from '@/routes/Habits';
import Garden from '@/routes/Garden';
import Prayers from '@/routes/Prayers';
import Progress from '@/routes/Progress';
import More from '@/routes/More';

// 탭 페이지를 한 번만 마운트해 트랙에 나란히 유지(keep-alive)
const TAB_ELEMENTS: Record<string, ReactElement> = {
  '/': <Main />,
  '/habits': <Habits />,
  '/garden': <Garden />,
  '/prayers': <Prayers />,
  '/progress': <Progress />,
  '/more': <More />,
};

const LOCK_PX = 10;            // 가로 제스처로 확정하는 최소 이동
const PROJECT_MS = 120;        // 놓는 순간 속도를 이만큼(ms) 투영해 목표 패널 결정
const SPRING = { type: 'spring' as const, stiffness: 360, damping: 40, restDelta: 0.5 };

export default function SwipeTabs() {
  const tabs = useVisibleTabs();
  const location = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();

  const activeIndex = tabs.findIndex((t) =>
    t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to),
  );
  const isTabRoute = activeIndex !== -1;

  const containerRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const trackX = useMotionValue(0);

  // 뷰포트 폭 측정
  useLayoutEffect(() => {
    if (!isTabRoute) return;
    const measure = () => setW(containerRef.current?.clientWidth || window.innerWidth);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isTabRoute]);

  // 활성 탭/폭 변화 시 트랙 위치 — 탭 변경은 스프링 애니메이션, 그 외(초기·리사이즈)는 즉시
  const prevActive = useRef(activeIndex);
  const inited = useRef(false);
  useLayoutEffect(() => {
    if (!w || !isTabRoute) return;
    const target = -activeIndex * w;
    if (inited.current && prevActive.current !== activeIndex) {
      animate(trackX, target, SPRING);
    } else {
      trackX.set(target);
    }
    prevActive.current = activeIndex;
    inited.current = true;
  }, [w, activeIndex, isTabRoute, trackX]);

  const gesture = useRef({ x: 0, y: 0, lastX: 0, lastT: 0, locked: false, ignore: false, vx: 0, startTrack: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isTabRoute || !w) return;
    const minX = -(tabs.length - 1) * w;
    const clamp = (x: number) =>
      x > 0 ? x * 0.3 : x < minX ? minX + (x - minX) * 0.3 : x; // 양 끝 고무줄 저항

    const onStart = (e: TouchEvent) => {
      const g = gesture.current;
      if (e.touches.length !== 1) { g.ignore = true; return; }
      const tgt = e.target as Element;
      if (tgt.closest('[data-bed-pager]') || tgt.closest('[data-no-swipe]')) { g.ignore = true; return; }
      const t = e.touches[0];
      g.x = t.clientX; g.y = t.clientY; g.lastX = t.clientX; g.lastT = performance.now();
      g.locked = false; g.ignore = false; g.vx = 0;
    };

    const onMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (g.ignore) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (!g.locked) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { g.ignore = true; return; } // 세로 스크롤 양보
        if (Math.abs(dx) > LOCK_PX && Math.abs(dx) >= Math.abs(dy)) {
          g.locked = true;
          trackX.stop();                 // 진행 중인 스냅 애니메이션 정지
          g.startTrack = trackX.get();   // 기준점은 route 상태가 아닌 실시간 트랙 위치
        } else return;
      }
      e.preventDefault();
      const now = performance.now();
      const dt = now - g.lastT || 16;
      g.vx = (t.clientX - g.lastX) / dt; g.lastX = t.clientX; g.lastT = now;
      trackX.set(clamp(g.startTrack + dx));
    };

    const onEnd = () => {
      const g = gesture.current;
      if (g.ignore || !g.locked) { g.ignore = false; g.locked = false; return; }
      g.locked = false;
      // 속도를 투영한 위치로 목표 패널 결정 → 위치/속도 부호 불일치로 인한 역방향 버그 방지
      const projected = trackX.get() + g.vx * PROJECT_MS;
      const startIdx = Math.round(-g.startTrack / w);
      let target = Math.round(-projected / w);
      target = Math.max(startIdx - 1, Math.min(startIdx + 1, target)); // 한 번에 최대 한 칸
      target = Math.max(0, Math.min(tabs.length - 1, target));
      if (target !== activeIndex) navigate(tabs[target].to); // 위치 애니메이션은 활성 변경 effect가 처리
      else animate(trackX, -target * w, SPRING);
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
  }, [isTabRoute, activeIndex, w, tabs, trackX, navigate]);

  // 비탭 라우트(상세 페이지 등)는 캐러셀 없이 자체 스크롤 컨테이너로
  if (!isTabRoute) {
    return <div className="no-scrollbar h-full overflow-y-auto overflow-x-hidden">{outlet}</div>;
  }

  return (
    <TabActiveContext.Provider value={tabs[activeIndex]?.to ?? null}>
      <div ref={containerRef} className="h-full w-full overflow-hidden" style={{ touchAction: 'pan-y' }}>
        <motion.div className="flex h-full" style={{ x: trackX, width: w ? tabs.length * w : '100%' }}>
          {tabs.map((t, i) => (
            <div
              key={t.to}
              data-active-panel={i === activeIndex ? '' : undefined}
              aria-hidden={i !== activeIndex}
              className="no-scrollbar h-full shrink-0 overflow-y-auto overflow-x-hidden overscroll-contain"
              style={{ width: w || '100%' }}
            >
              {TAB_ELEMENTS[t.to]}
            </div>
          ))}
        </motion.div>
      </div>
    </TabActiveContext.Provider>
  );
}
