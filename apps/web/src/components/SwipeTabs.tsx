import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { animate, motion, useMotionValue } from 'framer-motion';
import { useVisibleTabs } from '@/lib/tabs';
import { useUiDesign } from '@/lib/features';
import Main from '@/routes/Main';
import Habits from '@/routes/Habits';
import Prayers from '@/routes/Prayers';
import More from '@/routes/More';

// 탭 페이지를 한 번만 마운트해 트랙에 나란히 유지(keep-alive)
// 진척(/progress)은 하단 탭이 아니라 더보기 안의 일반 라우트라 여기 포함하지 않는다.
const TAB_ELEMENTS: Record<string, ReactElement> = {
  '/': <Main />,
  '/habits': <Habits />,
  '/prayers': <Prayers />,
  '/more': <More />,
};

const LOCK_PX = 10;            // 가로 제스처로 확정하는 최소 이동
const PROJECT_MS = 120;        // 놓는 순간 속도를 이만큼(ms) 투영해 목표 패널 결정
const SPRING = { type: 'spring' as const, stiffness: 360, damping: 40, restDelta: 0.5 };

function PullRefreshFeedback({ distance, refreshing }: { distance: number; refreshing: boolean }) {
  if (!distance && !refreshing) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center"
      style={{ top: Math.round(distance / 2), opacity: refreshing ? 1 : Math.min(1, distance / 24) }}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] text-[var(--fg-muted)] shadow-sm">
        <span className={refreshing ? 'animate-spin' : ''} aria-hidden="true">↻</span>
        {refreshing ? '새로고침 중' : distance >= 61 ? '놓으면 새로고침' : '아래로 당겨 새로고침'}
      </span>
    </div>
  );
}

export default function SwipeTabs() {
  const tabs = useVisibleTabs();
  const uiDesign = useUiDesign();
  const location = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();

  const activeIndex = tabs.findIndex((t) =>
    t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to),
  );
  const isTabRoute = activeIndex !== -1;

  const containerRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [w, setW] = useState(0);
  const trackX = useMotionValue(0);

  // 뷰포트 폭 측정
  useLayoutEffect(() => {
    if (!isTabRoute) return;
    const container = containerRef.current;
    const measure = () => setW(container?.clientWidth || window.innerWidth);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (container) observer?.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
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

    // 터치 지점에서 컨테이너까지 올라가며 실제로 가로 스크롤되는 요소가 있는지 검사.
    // 1년 잔디 히트맵·칩 필터 등 내부 가로 스크롤 영역에서는 탭 스와이프를 양보해
    // 네이티브 스크롤이 동작하게 한다.
    const inHorizontalScroller = (tgt: Element | null) => {
      for (let n = tgt; n && n !== el; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 1) {
          const ox = getComputedStyle(n).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
        }
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      const g = gesture.current;
      if (e.touches.length !== 1) { g.ignore = true; return; }
      const tgt = e.target as Element;
      if (tgt.closest('[data-bed-pager]') || tgt.closest('[data-no-swipe]')) { g.ignore = true; return; }
      if (inHorizontalScroller(tgt)) { g.ignore = true; return; }
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
      if (target !== activeIndex) navigate(tabs[target].to);
      // 라우팅/리렌더 타이밍에 의존하지 않고 항상 트랙을 목표 경계로 애니메이션 →
      // 두 탭 사이에 멈추는 현상 방지. 전환 시엔 activeIndex 이펙트도 같은 목표로
      // 애니메이션하지만 목표가 동일하므로 매끄럽게 수렴한다.
      animate(trackX, -target * w, SPRING);
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

  // 모바일: 활성 페이지 맨 위에서 아래로 당기면 전체 새로고침.
  // 실제 스크롤 패널에만 연결해 좌우 탭 전환과 내부 스크롤을 방해하지 않는다.
  useEffect(() => {
    const panel = isTabRoute
      ? containerRef.current?.querySelector<HTMLElement>('[data-active-panel]')
      : detailPanelRef.current;
    if (!panel) return;

    let started = false;
    let pulling = false;
    let startX = 0;
    let startY = 0;
    let travel = 0;

    const reset = () => {
      started = false;
      pulling = false;
      travel = 0;
      setPullDistance(0);
    };

    const onStart = (event: TouchEvent) => {
      reset();
      if (refreshing || event.touches.length !== 1 || panel.scrollTop > 1) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [data-no-pull]')) return;
      // 별도 세로 스크롤 컨테이너 안의 제스처는 그 컨테이너가 처리한다.
      for (let node: Element | null = target; node && node !== panel; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2) return;
      }
      started = true;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    };

    const onMove = (event: TouchEvent) => {
      if (!started) return;
      if (event.touches.length !== 1 || panel.scrollTop > 1) { reset(); return; }
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      // 위로 스크롤·좌우 탭 스와이프는 그대로 통과.
      if (dy <= 0 || Math.abs(dx) >= Math.abs(dy)) { reset(); return; }
      if (dy < 9) return;
      pulling = true;
      travel = dy;
      if (event.cancelable) event.preventDefault();
      setPullDistance(Math.min(70, dy * 0.65));
    };

    const onEnd = () => {
      const reload = pulling && travel >= 95;
      reset();
      if (reload) {
        setRefreshing(true);
        window.location.reload();
      }
    };

    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
    panel.addEventListener('touchend', onEnd);
    panel.addEventListener('touchcancel', reset);
    return () => {
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
      panel.removeEventListener('touchcancel', reset);
    };
  }, [isTabRoute, activeIndex, location.pathname, refreshing]);

  // 비탭 라우트(상세 페이지 등)는 캐러셀 없이 자체 스크롤 컨테이너로
  if (!isTabRoute) {
    return <div ref={detailPanelRef} className="no-scrollbar relative h-full overflow-y-auto overflow-x-hidden overscroll-contain">{outlet}<PullRefreshFeedback distance={pullDistance} refreshing={refreshing} /></div>;
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ touchAction: 'pan-y' }}
      // 트랙 위치는 transform(trackX)으로만 잡으므로 컨테이너의 scrollLeft 는 항상 0이어야 한다.
      // 외부 코드(예: scrollIntoView)가 가로로 스크롤시키면 탭 정렬이 어긋나므로 즉시 되돌린다.
      onScroll={(e) => {
        if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
        if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
      }}
    >
      <PullRefreshFeedback distance={pullDistance} refreshing={refreshing} />
      <motion.div className="flex h-full" style={{ x: trackX, width: w ? tabs.length * w : '100%' }}>
        {tabs.map((t, i) => (
          <div
            key={t.to}
            data-active-panel={i === activeIndex ? '' : undefined}
            aria-hidden={i !== activeIndex}
            className="no-scrollbar h-full shrink-0 overflow-y-auto overflow-x-hidden overscroll-contain"
            style={{ width: w || '100%' }}
          >
            {uiDesign === 'editorial' && t.to === '/' ? <Habits /> : TAB_ELEMENTS[t.to]}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
