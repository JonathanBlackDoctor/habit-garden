import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { useIsPremium } from '@/lib/features';
import { useHealthForecast } from '@/features/garden/useHealthForecast';
import { getGameDayKST } from '@/features/garden/useGarden';

type NudgeKind = 'success-up' | 'success-down' | 'wither';

/** 같은 종류의 넛지는 게임일당 1회만 — 빠른 체크/해제 스팸 방지 (passive yield 토스트와 동일 패턴). */
function alreadyNudged(uid: string, kind: NudgeKind, gameDay: string): boolean {
  const key = `hg:forecastToast:${uid}:${kind}:${gameDay}`;
  try {
    if (localStorage.getItem(key) === gameDay) return true;
    localStorage.setItem(key, gameDay);
  } catch { /* private mode — 게이트 없이 진행 */ }
  return false;
}

/**
 * 선제적 생기 넛지 — 오늘의 행동이 '내일 생기' 예보의 임계(성공/시들기)를 넘는 순간 토스트로 알린다.
 * 엣지 트리거(경계를 넘는 그 순간만) + 게임일당 1회 게이트로 과한 알림을 막는다. (승인 사용자 전용)
 */
export function useForecastNudge() {
  const uid = useAppStore((s) => s.uid);
  const isPremium = useIsPremium();
  const forecast = useHealthForecast();
  const prev = useRef<{ daySuccess: boolean; intoWitheringZone: boolean } | null>(null);

  useEffect(() => {
    if (!uid || !isPremium || !forecast) return;
    const cur = { daySuccess: forecast.daySuccess, intoWitheringZone: forecast.intoWitheringZone };
    const before = prev.current;
    prev.current = cur;
    if (!before) return;                         // 첫 관측 — 변화 비교 기준만 잡고 끝
    if (!forecast.hasAnyCheck) return;           // 기록 전 상태로 되돌아온 경우는 알리지 않음

    const gameDay = getGameDayKST();

    // 시들기 진입이 가장 중요 — 먼저 검사
    if (!before.intoWitheringZone && cur.intoWitheringZone) {
      if (!alreadyNudged(uid, 'wither', gameDay)) {
        toast('⚠️ 시들기 경고', {
          description: '이대로면 내일 생기가 50 이하로 떨어져 식물이 시들 수 있어요.',
          duration: 8000,
          action: { label: '정원에서 보기', onClick: () => { window.location.hash = '#/garden'; } },
        });
      }
      return;
    }

    if (!before.daySuccess && cur.daySuccess) {
      if (!alreadyNudged(uid, 'success-up', gameDay)) {
        toast('🌱 오늘 목표 달성!', {
          description: `이대로 마치면 내일 생기 +${forecast.successDelta} 예정이에요.`,
          duration: 6000,
          action: { label: '정원에서 보기', onClick: () => { window.location.hash = '#/garden'; } },
        });
      }
      return;
    }

    if (before.daySuccess && !cur.daySuccess) {
      if (!alreadyNudged(uid, 'success-down', gameDay)) {
        const more = forecast.flipsToSuccessNeeded > 0 ? ` ${forecast.flipsToSuccessNeeded}개만 더 달성해요!` : '';
        toast('내일 생기가 줄어들 수 있어요', {
          description: `지금 멈추면 오늘이 실패로 마쳐져요.${more}`,
          duration: 7000,
        });
      }
    }
  }, [uid, isPremium, forecast]);
}
