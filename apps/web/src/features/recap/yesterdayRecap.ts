import type { HabitCheckDoc, HabitDoc } from 'shared/types/firestore';
import { SCALED_ACHIEVE_THRESHOLD } from 'shared/lib/habitPoints';

export interface MissedEntry {
  habit: HabitDoc;
  score: number;            // 기록했지만 임계값 미달인 점수
  whyMissed?: string;
}

export interface YesterdayRecap {
  achieved: number;
  intended: number;          // 건너뜀(score=null) 제외한 어제 목표 수
  missed: MissedEntry[];     // 시도했지만 미달 — 가중치 내림차순
  unrecorded: HabitDoc[];    // 체크 자체가 없음 — 가중치 내림차순
  allDone: boolean;          // 미달·미기록 없이 어제를 마침
  focus: HabitDoc | null;    // 오늘 가장 먼저 챙길 습관 — 미달·미기록 중 가중치 최고
}

/**
 * 어제의 체크 기록으로 '다음날 아침 피드백' 요약을 만든다.
 *
 * 달성 판정은 저장된 achieved 필드가 아니라 점수 ≥ 현재 임계값으로 재계산한다
 * (useHabitStreaks 와 동일 — 과거에 굳은 잘못된 achieved 를 무시하고 항상 정합하도록).
 *
 * null 반환 = 보여줄 피드백 없음:
 *  - 어제 체크가 하나도 없는 날(앱 첫날·완전 미사용)은 잔소리 대신 침묵
 *  - 전부 건너뜀 처리한 날도 마찬가지
 */
export function buildYesterdayRecap(
  habits: HabitDoc[],
  checks: Record<string, HabitCheckDoc>,
): YesterdayRecap | null {
  if (habits.length === 0) return null;
  if (!habits.some((h) => checks[h.id] !== undefined)) return null;

  let achieved = 0;
  let skipped = 0;
  const missed: MissedEntry[] = [];
  const unrecorded: HabitDoc[] = [];

  for (const h of habits) {
    const c = checks[h.id];
    if (c === undefined) { unrecorded.push(h); continue; }
    if (c.score === null) { skipped++; continue; }
    const threshold = h.scoreMode === 'scaled' ? SCALED_ACHIEVE_THRESHOLD : h.achieveThreshold;
    if (c.score >= threshold) achieved++;
    else missed.push({ habit: h, score: c.score, whyMissed: c.whyMissed });
  }

  const intended = habits.length - skipped;
  if (intended === 0) return null; // 전부 건너뜀 — 피드백 대상 없음

  missed.sort((a, b) => b.habit.weight - a.habit.weight);
  unrecorded.sort((a, b) => b.weight - a.weight);

  const candidates = [...missed.map((m) => m.habit), ...unrecorded];
  const focus = candidates.reduce<HabitDoc | null>(
    (best, h) => (best === null || h.weight > best.weight ? h : best),
    null,
  );

  return {
    achieved,
    intended,
    missed,
    unrecorded,
    allDone: missed.length === 0 && unrecorded.length === 0,
    focus,
  };
}
