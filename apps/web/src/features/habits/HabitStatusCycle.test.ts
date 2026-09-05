import { describe, expect, it, vi } from 'vitest';
import type { HabitStatus } from './habitStatus';

function applyBinaryCircle(status: HabitStatus, onScore: (score: number | null) => void, onClear: () => void) {
  if (status === 'todo') onScore(1);
  else if (status === 'achieved') onScore(0);
  else onClear();
}

describe('binary habit status circle cycle', () => {
  it('cycles todo to achieved to missed to cleared', () => {
    const onScore = vi.fn();
    const onClear = vi.fn();

    applyBinaryCircle('todo', onScore, onClear);
    applyBinaryCircle('achieved', onScore, onClear);
    applyBinaryCircle('missed', onScore, onClear);

    expect(onScore.mock.calls).toEqual([[1], [0]]);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('clears an existing skipped record instead of adding skip to the quick cycle', () => {
    const onScore = vi.fn();
    const onClear = vi.fn();

    applyBinaryCircle('skipped', onScore, onClear);

    expect(onScore).not.toHaveBeenCalled();
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
