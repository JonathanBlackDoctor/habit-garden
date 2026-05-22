/**
 * 습관 체크 → 포인트 변환 (Phase 4-4 부분 달성 인정).
 * 클라이언트(useHabits)와 Cloud Function(awardEngine) 양쪽에서 import 해서
 * 동일한 식을 쓰게 한다. "0점 두려움"을 줄이기 위해 임계 미만이어도
 * 시도 자체에 약간의 포인트를 지급한다.
 *
 * 규칙:
 *  - scaled(1~5):
 *      score=1 → weight × 0.4 (반올림, 최소 1)
 *      score=2 → weight × 0.8
 *      score=3 → weight × 1.5 (achieve 임계 가정)
 *      score=4 → weight × 2
 *      score=5 → weight × 2 + 5 (PERFECT 보너스)
 *  - binary(0|1):
 *      score=0 → 0
 *      score=1 → weight × 2
 *  - score=null(pass) → 0
 *
 * achieved 여부는 habit.achieveThreshold 와 비교해 별도로 계산한다
 *  (포인트와 무관, 스트릭/배지/dayScore 산정에 사용).
 */

const SCALED_MULTIPLIER: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0.4,
  2: 0.8,
  3: 1.5,
  4: 2.0,
  5: 2.0, // 5점은 별도 보너스 +5
};

export const PERFECT_BONUS = 5;

export function pointsForCheck(
  weight: number,
  scoreMode: 'scaled' | 'binary',
  score: number | null,
): number {
  if (score === null) return 0;
  if (scoreMode === 'binary') {
    return score >= 1 ? weight * 2 : 0;
  }
  // scaled
  const s = Math.max(1, Math.min(5, Math.round(score))) as 1 | 2 | 3 | 4 | 5;
  const mul = SCALED_MULTIPLIER[s];
  let pts = Math.round(weight * mul);
  if (s === 5) pts += PERFECT_BONUS;
  // 최소 1 — 시도 인정 (score>=1 인데 weight 가 너무 작아도 0 되지 않게)
  return Math.max(pts, 1);
}
