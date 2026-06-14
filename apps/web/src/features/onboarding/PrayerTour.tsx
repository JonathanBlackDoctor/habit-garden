import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useIsPremium } from '@/lib/features';
import SpotlightTour, { type Step } from './SpotlightTour';

const BASE_STEPS: Step[] = [
  {
    target: '[data-tour="prayer-tab"]',
    title: '기도 탭이 열렸어요',
    body: '하단 기도 탭에서 오늘의 기도제목을 모아보고 체크할 수 있어요. 새 기도제목은 상단 + 추가 버튼으로 적어요.',
    route: '/prayers',
  },
  {
    target: '[data-tour="prayer-segments"]',
    title: '기도제목이 관리되는 원리',
    body: '오늘 = 우선순위별 주기(높음 2일·보통 5일·낮음 10일)로 자동 선별돼요. 오래 안 본 기도는 노출이 점점 줄다가(망각) 잠든 기도로 내려가고, 응답되면 응답 보관함으로 옮겨집니다. 📌 고정은 망각 없이 매일 노출돼요.',
    route: '/prayers',
  },
];

// 무더기 정리는 프리미엄 전용 버튼이라, 버튼이 있는 사용자에게만 단계를 노출한다.
const BULK_STEP: Step = {
  target: '[data-tour="prayer-bulk"]',
  title: '무더기 정리',
  body: '카톡·메모에서 받은 기도제목 덩어리를 그대로 붙여넣으면 AI가 사람별·항목별로 쪼개 정리해줘요. 검토·수정 후 한 번에 저장합니다.',
  route: '/prayers',
};

// 말씀 적용 — 큐티·설교에서 받은 적용을 매일 실천으로 추적
const APPLICATION_STEP: Step = {
  target: '[data-tour="application-add"]',
  title: '말씀 적용',
  body: '큐티·주일설교·LGM·묵상에서 받은 ‘적용’(무엇을 실천할지)을 적어두고, 이후 며칠간 "오늘 실천했어요"를 체크해 정착시키는 곳이에요. + 버튼으로 추가하고, 정리한 노트를 붙여넣으면 AI가 본문·깨달음·여러 적용점까지 정리해줘요.',
  route: '/applications',
};

/**
 * 기도 튜토리얼 오케스트레이터.
 * 더보기에서 신앙 기능을 켤 때마다(startPrayerTour) 기도 화면으로 이동해 가이드를 진행한다.
 * 메인 온보딩과 달리 완료 플래그가 없어 켤 때마다 매번 다시 진행된다.
 */
export default function PrayerTour() {
  const open = useAppStore((s) => s.prayerTourOpen);
  const close = useAppStore((s) => s.closePrayerTour);
  const isPremium = useIsPremium();
  const navigate = useNavigate();
  const location = useLocation();

  const steps = isPremium
    ? [...BASE_STEPS, BULK_STEP, APPLICATION_STEP]
    : [...BASE_STEPS, APPLICATION_STEP];

  // 열릴 때 기도 화면으로 이동(탭이 막 활성화됐을 수 있음)
  useEffect(() => {
    if (!open) return;
    if (location.pathname !== '/prayers') navigate('/prayers');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <SpotlightTour key="prayer-tour" steps={steps} onDone={close} />
      )}
    </AnimatePresence>
  );
}
