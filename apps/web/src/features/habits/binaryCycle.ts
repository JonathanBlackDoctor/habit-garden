import type { HabitStatus } from './habitStatus';

export type BinaryQuickAction = 'success' | 'failure' | 'skip' | 'undo';

/** 탭할 때의 순서: 미기록 → 성공 → 실패 → 건너뜀 → 미기록. */
export function nextBinaryAction(status: HabitStatus): BinaryQuickAction {
  const actions: Record<HabitStatus, BinaryQuickAction> = {
    todo: 'success',
    achieved: 'failure',
    missed: 'skip',
    skipped: 'undo',
  };
  return actions[status];
}
