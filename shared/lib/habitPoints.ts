/**
 * 습관 달성 판정 공용 상수 — 클라이언트(useHabits 등)와 Cloud Function 양쪽에서
 * import 해서 동일한 기준을 쓰게 한다.
 */

/**
 * 5점 척도 달성 임계값. 모든 scaled 습관에 획일적으로 적용한다 —
 * 습관별 achieveThreshold 필드가 과거 잘못 저장돼 있어도 이 값을 기준으로 판정한다.
 * (1·2점=미달성, 3점부터 달성)
 */
export const SCALED_ACHIEVE_THRESHOLD = 3;
