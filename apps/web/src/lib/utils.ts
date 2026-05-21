import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 레벨 n에 필요한 누적 XP */
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

/** 가중평균 dayScore 계산. pass(null)는 분모에서 제외 */
export function calcDayScore(
  checks: Array<{ score: number | null; weight: number; scoreMode: 'scaled' | 'binary' }>
): number {
  let numerator = 0;
  let denominator = 0;
  for (const c of checks) {
    if (c.score === null) continue;
    const normalized = c.scoreMode === 'scaled' ? (c.score - 1) / 4 : c.score;
    numerator   += normalized * c.weight;
    denominator += c.weight;
  }
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}
