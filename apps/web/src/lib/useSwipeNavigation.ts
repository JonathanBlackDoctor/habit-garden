import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useVisibleTabs } from '@/lib/tabs';

const SWIPE_THRESHOLD = 60;

// 좌우 스와이프로 인접 하단 탭 이동. data-bed-pager 영역에서 시작한 제스처는 무시(화단 넘기기에 양보).
export function useSwipeNavigation() {
  const tabs = useVisibleTabs();
  const navigate = useNavigate();
  const location = useLocation();
  const start = useRef<{ x: number; y: number } | null>(null);

  const currentIndex = tabs.findIndex((t) =>
    t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to),
  );

  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as Element).closest('[data-bed-pager]')) {
      start.current = null;
      return;
    }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || currentIndex < 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
    const next = dx < 0 ? currentIndex + 1 : currentIndex - 1;
    if (next >= 0 && next < tabs.length) navigate(tabs[next].to);
  };

  return { onTouchStart, onTouchEnd };
}
