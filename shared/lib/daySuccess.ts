/**
 * '성공한 날' 판정 기준 — 그날 기록(체크)된 습관 중 달성 비율이 이 값 이상이면 성공.
 * dayScore 트리거(실시간 스트릭 증가)와 dailyReset(전날 스트릭 정산)이 공유한다.
 */
export const SUCCESS_THRESHOLD = 0.6;
