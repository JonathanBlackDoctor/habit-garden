/**
 * 기도 로테이션 & 망각 알고리즘 (설계 §5)
 *
 * 클라이언트(apps/web)와 Functions 양쪽에서 공유하는 순수 함수 모듈.
 * Timestamp 종류(client/admin)에 의존하지 않도록 모든 입력은 epoch ms(number)로 받는다.
 */
import {
  PRAYER_ROTATION_DEFAULTS,
  PRAYER_ROTATION_LIMIT,
  type PrayerPriority,
} from './types/firestore';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RotationInput {
  id: string;
  priority: PrayerPriority;
  pinned: boolean;
  rotationDays?: number;       // 희망 주기(일). 없으면 priority 기본값
  receivedAtMs: number;        // 받은 날짜
  lastPrayedAtMs?: number;     // 마지막 기도 시각(없으면 receivedAt 사용)
}

/** 우선순위 기본 주기 (rotationDays가 지정되면 그 값 우선) */
export function baseInterval(priority: PrayerPriority, rotationDays?: number): number {
  if (rotationDays && rotationDays > 0) return rotationDays;
  return PRAYER_ROTATION_DEFAULTS[priority].baseInterval;
}

/** 망각 backoff 계수 — 4주마다 +50% */
export function backoffFactor(receivedAtMs: number, todayMs: number): number {
  const ageWeeks = Math.floor((todayMs - receivedAtMs) / (7 * DAY_MS));
  return 1 + Math.floor(Math.max(0, ageWeeks) / 4) * 0.5;
}

/** 망각이 적용된 실효 주기 */
export function effectiveInterval(item: RotationInput, todayMs: number): number {
  return baseInterval(item.priority, item.rotationDays) * backoffFactor(item.receivedAtMs, todayMs);
}

/** 마지막 기도(혹은 받은 날) 이후 경과 일수 */
export function daysSince(item: RotationInput, todayMs: number): number {
  const ref = item.lastPrayedAtMs ?? item.receivedAtMs;
  return (todayMs - ref) / DAY_MS;
}

/** dueScore ≥ 1 이면 '오늘 대상' */
export function dueScore(item: RotationInput, todayMs: number): number {
  const interval = effectiveInterval(item, todayMs);
  if (interval <= 0) return Number.POSITIVE_INFINITY;
  return daysSince(item, todayMs) / interval;
}

/** 잠듦 전이 대상 여부 (pinned 제외, 활성 항목에만 적용) */
export function shouldBecomeDormant(item: RotationInput, todayMs: number): boolean {
  if (item.pinned) return false;
  const threshold = PRAYER_ROTATION_DEFAULTS[item.priority].dormantThreshold;
  return daysSince(item, todayMs) > threshold;
}

/**
 * 오늘의 기도 목록 선정 (설계 §5.3)
 * 입력은 status === 'active' 인 항목만 넘긴다.
 */
export function selectTodayPrayers(
  activeItems: RotationInput[],
  todayMs: number,
  limit: number = PRAYER_ROTATION_LIMIT
): { pinnedIds: string[]; rotationIds: string[] } {
  // 1) 고정 — 항상 노출 (망각/backoff 무시)
  const pinnedIds = activeItems.filter((it) => it.pinned).map((it) => it.id);

  // 2) 고정 아님 & dueScore ≥ 1 후보 수집
  const candidates = activeItems
    .filter((it) => !it.pinned && dueScore(it, todayMs) >= 1)
    .map((it) => ({
      id: it.id,
      sortKey: dueScore(it, todayMs) * PRAYER_ROTATION_DEFAULTS[it.priority].weight,
    }));

  // 3) 정렬키 내림차순
  candidates.sort((a, b) => b.sortKey - a.sortKey);

  // 4) 상한 N까지
  const rotationIds = candidates.slice(0, Math.max(0, limit)).map((c) => c.id);

  return { pinnedIds, rotationIds };
}
