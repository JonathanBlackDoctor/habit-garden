import { describe, expect, it } from 'vitest';
import { nextBinaryAction } from './binaryCycle';

describe('binary habit quick action', () => {
  it('cycles success, failure, skip and undo in that order', () => {
    expect(['todo', 'achieved', 'missed', 'skipped'].map((status) =>
      nextBinaryAction(status as Parameters<typeof nextBinaryAction>[0]),
    )).toEqual(['success', 'failure', 'skip', 'undo']);
  });
});
