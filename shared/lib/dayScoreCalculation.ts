import type { HabitCheckDoc, HabitDoc } from '../types/firestore';
import { SUCCESS_THRESHOLD } from './daySuccess';

export type ScoredCheck = HabitCheckDoc & {
  habitSnapshot?: Partial<Pick<HabitDoc, 'weight' | 'scoreMode'>>;
};

export function calculateDayScore(checks: ScoredCheck[], habits: Record<string, HabitDoc>) {
  let numerator = 0, denominator = 0, achieved = 0, total = 0;
  for (const check of checks) {
    const habit = habits[check.habitId];
    const weight = check.habitSnapshot?.weight ?? habit?.weight;
    const scoreMode = check.habitSnapshot?.scoreMode ?? habit?.scoreMode;
    if (weight == null || !scoreMode) continue;
    total++;
    if (check.achieved) achieved++;
    if (check.score === null) continue;
    const normalized = scoreMode === 'scaled' ? (check.score - 1) / 4 : check.score;
    numerator += normalized * weight;
    denominator += weight;
  }
  return {
    dayScore: denominator > 0 ? Math.round(numerator / denominator * 100) : 0,
    isSuccessDay: total > 0 && achieved / total >= SUCCESS_THRESHOLD,
  };
}

export const canAwardLiveSuccess = (isSuccessDay: boolean, date: string, today: string) => isSuccessDay && date === today;
