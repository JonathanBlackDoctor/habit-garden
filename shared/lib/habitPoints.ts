/**
 * 습관 체크 → 포인트 변환 (Phase 4-4 부분 달성 인정).
 * 클라이언트(useHabits)와 Cloud Function(awardEngine) 양쪽에서 import 해서
 * 동일한 식을 쓰게 한다. "0점 두려움"을 줄이기 위해 임계 미만이어도
 * 시도 자체에 약간의 포인트를 지급한다.
 *
 * 규칙: 5점 척도 '달성'(3점)을 완료형 '완료'(weight×2)와 동급으로 맞춘다.
 *  - scaled(1~5):
 *      score=1 → 0 (미이행 = 미완료)
 *      score=2 → weight × 1.0 (미달성·시도 인정)
 *      score=3 → weight × 2.0 (달성 = 완료 동급)
 *      score=4 → weight × 2.5
 *      score=5 → weight × 3.0 + 3 (PERFECT 보너스)
 *  - binary(0|1):
 *      score=0 → 0
 *      score=1 → weight × 2
 *  - score=null(pass) → 0
 *
 * achieved 여부는 habit.achieveThreshold 와 비교해 별도로 계산한다
 *  (포인트와 무관, 스트릭/배지/dayScore 산정에 사용).
 */

/**
 * 5점 척도 달성 임계값. 모든 scaled 습관에 획일적으로 적용한다 —
 * 습관별 achieveThreshold 필드가 과거 잘못 저장돼 있어도 이 값을 기준으로 판정한다.
 * (1·2점=미달성, 3점부터 달성)
 */
export const SCALED_ACHIEVE_THRESHOLD = 3;

const SCALED_MULTIPLIER: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0,   // 미이행 — 아래에서 0 반환 (보상 없음)
  2: 1.0,
  3: 2.0, // 달성 임계 — 완료형 '완료'(×2)와 동급
  4: 2.5,
  5: 3.0, // 5점은 별도 보너스 +PERFECT_BONUS
};

export const PERFECT_BONUS = 3;

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
  // 5점 척도 1점("매우 부족")은 미이행으로 간주 — 보상 없음
  if (s === 1) return 0;
  const mul = SCALED_MULTIPLIER[s];
  let pts = Math.round(weight * mul);
  if (s === 5) pts += PERFECT_BONUS;
  // 최소 1 — 시도 인정 (score>=1 인데 weight 가 너무 작아도 0 되지 않게)
  return Math.max(pts, 1);
}
