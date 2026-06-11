// 습관 휴면(Hibernation) 판정 헬퍼 — 순수 함수, Firestore 의존 없음.
//
// 휴면 = 습관을 지우지 않고 일시적으로 재워두는 상태. `active`(영구 on/off)와 직교한다.
// 휴면 중인 습관은 `active: true`를 유지하되 일일 목록·집계에서 빠진다.
// 자동 복귀는 없고(수동으로만 깨움), 스트릭 보존을 위해 휴면 구간 [since, until]을 기록한다.

interface HibernationFields {
  hibernatedSince?: string | null;
  hibernatedUntil?: string | null;
}

/** 현재 휴면 중인가 = 시작일 있고 아직 깨우지 않음(종료일 없음). */
export const isHibernating = (h: HibernationFields): boolean =>
  !!h.hibernatedSince && !h.hibernatedUntil;

/**
 * 해당 날짜가 휴면 구간 안인가 (스트릭 브리지용).
 * 아직 휴면 중이면 종료가 열려 있으므로 today를 끝으로 본다.
 */
export const inHibernationWindow = (
  h: HibernationFields,
  dateKey: string,
  today: string,
): boolean =>
  !!h.hibernatedSince &&
  h.hibernatedSince <= dateKey &&
  dateKey <= (h.hibernatedUntil ?? today);
