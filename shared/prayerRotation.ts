/**
 * 기도 로테이션 & 망각 알고리즘 (설계 §5)
 *
 * 클라이언트(apps/web)와 Functions 양쪽에서 공유하는 순수 함수 모듈.
 * Timestamp 종류(client/admin)에 의존하지 않도록 모든 입력은 epoch ms(number)로 받는다.
 */
import {
  PRAYER_ROTATION_DEFAULTS,
  PRAYER_ROTATION_LIMIT,
  PRAYER_NEW_PER_DAY,
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
  target?: string;             // 기도 대상(사람) — 다양성 소프트 페널티용
}

/** 미시작 항목 — 한 번도 기도하지 않음 (A: 신규 우대 대상) */
function isUnstarted(item: RotationInput): boolean {
  return item.lastPrayedAtMs == null;
}

/**
 * 활성 수 기반 적응형 일일 상한 (E).
 * override(사용자 설정 dailyPrayerLimit)가 양수면 그 값을 우선한다.
 * 활성이 적으면 7, 많으면 최대 15까지 늘려 큰 목록도 합리적 주기로 순환.
 */
export function adaptiveDailyLimit(activeCount: number, override?: number): number {
  if (override && override > 0) return override;
  // 하한 = PRAYER_ROTATION_LIMIT(기존 기본 9) 보존, 활성이 많아지면 최대 15까지.
  return Math.min(15, Math.max(PRAYER_ROTATION_LIMIT, Math.ceil(activeCount / 12)));
}

/**
 * 일자 고정 jitter (B) — 같은 날엔 항상 같은 값, 날이 바뀌면 미세 변동.
 * 정렬 동점을 깨고 매일 목록을 살짝 신선하게 한다. 범위 ≈ [0.92, 1.08].
 */
export function dayJitter(id: string, dayIndex: number): number {
  let h = 2166136261 ^ dayIndex;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  const unit = ((h >>> 0) % 1000) / 1000; // 0..1
  return 0.92 + unit * 0.16;
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

export interface SelectTodayOptions {
  limit?: number;       // 일일 상한 직접 지정. 없으면 adaptiveDailyLimit(활성 수, override)
  override?: number;    // 사용자 설정 dailyPrayerLimit (limit 미지정 시 적응형에 전달)
  newPerDay?: number;   // 하루 신규(미시작) 노출 상한. 기본 PRAYER_NEW_PER_DAY
}

/**
 * 오늘의 기도 목록 선정 (설계 §5.3 + 개선 A·B·E)
 * 입력은 status === 'active' 인 항목만 넘긴다.
 *
 *  - 고정(pinned): 항상 노출 (망각/backoff 무시)
 *  - 신규 슬롯(A): 미시작 항목을 받은날 최신순으로 최대 newPerDay개 — dueScore 무관하게
 *    다음날 바로 등장 보장. 무더기로 받아도 며칠에 걸쳐 나눠 노출된다.
 *  - 로테이션: 시작됨 & dueScore≥1 후보를 dueScore×weight×jitter 로 점수화하고,
 *    같은 대상(target)이 연속 뽑힐수록 점수를 감점하는 소프트 페널티 그리디로 선정(B).
 */
export function selectTodayPrayers(
  activeItems: RotationInput[],
  todayMs: number,
  opts: SelectTodayOptions = {},
): { pinnedIds: string[]; rotationIds: string[] } {
  const limit = Math.max(0, opts.limit ?? adaptiveDailyLimit(activeItems.length, opts.override));
  const newPerDay = opts.newPerDay ?? PRAYER_NEW_PER_DAY;
  const dayIndex = Math.floor(todayMs / DAY_MS);

  // 1) 고정 — 항상 노출
  const pinnedIds = activeItems.filter((it) => it.pinned).map((it) => it.id);
  const nonPinned = activeItems.filter((it) => !it.pinned);

  // 2) 신규(미시작) 슬롯 — 받은날 최신순, 최대 newPerDay (단 limit 초과 금지)
  const newIds = nonPinned
    .filter(isUnstarted)
    .sort((a, b) => b.receivedAtMs - a.receivedAtMs)
    .slice(0, Math.max(0, Math.min(newPerDay, limit)))
    .map((it) => it.id);

  // 3) 로테이션 후보 — 시작됨 & dueScore ≥ 1
  const pool = nonPinned
    .filter((it) => !isUnstarted(it) && dueScore(it, todayMs) >= 1)
    .map((it) => ({
      id: it.id,
      target: it.target && it.target.trim() ? it.target.trim() : `__id:${it.id}`,
      base:
        dueScore(it, todayMs) *
        PRAYER_ROTATION_DEFAULTS[it.priority].weight *
        dayJitter(it.id, dayIndex),
    }));

  // 4) 소프트 페널티 그리디 — 같은 target 누적마다 0.6^count 로 감점 (완전 배제 아님)
  const remaining = Math.max(0, limit - newIds.length);
  const targetCount = new Map<string, number>();
  const picked: string[] = [];
  const left = [...pool];
  while (picked.length < remaining && left.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < left.length; i++) {
      const c = left[i];
      const score = c.base * Math.pow(0.6, targetCount.get(c.target) ?? 0);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    const [chosen] = left.splice(bestIdx, 1);
    picked.push(chosen.id);
    targetCount.set(chosen.target, (targetCount.get(chosen.target) ?? 0) + 1);
  }

  return { pinnedIds, rotationIds: [...newIds, ...picked] };
}

/**
 * "오늘 기도 더 받기" — 오늘 목록(excludeIds)에 없는 활성 항목 중
 * 가장 오래 기도하지 않은(dueScore 높은) 순으로 count개를 추가 선정한다.
 * dueScore < 1 (아직 주기 전)인 항목도 포함한다.
 */
export function selectMorePrayers(
  activeItems: RotationInput[],
  excludeIds: Iterable<string>,
  todayMs: number,
  count: number
): string[] {
  const excluded = new Set(excludeIds);
  return activeItems
    .filter((it) => !it.pinned && !excluded.has(it.id))
    .map((it) => ({ id: it.id, score: dueScore(it, todayMs) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, count))
    .map((c) => c.id);
}
