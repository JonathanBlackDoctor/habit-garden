import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import SpotlightTour, { type Step } from './SpotlightTour';

const PRAYER_TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="prayer-tab"]',
    title: '기도 탭이 열렸어요',
    body: '하단 기도 탭에서 오늘의 기도제목을 모아보고 체크할 수 있어요.',
    route: '/prayers',
  },
  {
    target: '[data-tour="prayer-quickadd"]',
    title: '기도제목 빠른 추가',
    body: '한 줄로 적어 바로 추가해요. 예) #교회 청년부 부흥 high — 모임·우선순위까지 한 번에.',
    route: '/prayers',
  },
  {
    target: '[data-tour="prayer-segments"]',
    title: '오늘 · 전체 · 응답 · 잠든',
    body: '오늘 추천된 기도부터 응답·잠든 기도까지 상태별로 살펴볼 수 있어요.',
    route: '/prayers',
  },
];

/**
 * 기도 튜토리얼 오케스트레이터.
 * 더보기에서 신앙 기능을 켤 때마다(startPrayerTour) 기도 화면으로 이동해 가이드를 진행한다.
 * 메인 온보딩과 달리 완료 플래그가 없어 켤 때마다 매번 다시 진행된다.
 */
export default function PrayerTour() {
  const open = useAppStore((s) => s.prayerTourOpen);
  const close = useAppStore((s) => s.closePrayerTour);
  const navigate = useNavigate();
  const location = useLocation();

  // 열릴 때 기도 화면으로 이동(탭이 막 활성화됐을 수 있음)
  useEffect(() => {
    if (!open) return;
    if (location.pathname !== '/prayers') navigate('/prayers');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <SpotlightTour key="prayer-tour" steps={PRAYER_TOUR_STEPS} onDone={close} />
      )}
    </AnimatePresence>
  );
}
