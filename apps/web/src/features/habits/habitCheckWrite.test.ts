import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HabitDoc } from 'shared/types/firestore';

const mocks = vi.hoisted(() => ({ setDoc: vi.fn(), deleteDoc: vi.fn(), date: '2026-10-19' }));
vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('@/lib/store', () => ({ useAppStore: (selector: any) => selector({ uid: 'test-user', currentDate: mocks.date }) }));
vi.mock('@/lib/feedback', () => ({ feedback: vi.fn() }));
vi.mock('sonner', () => ({ toast: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(), orderBy: vi.fn(),
  doc: (...parts: any[]) => parts.slice(1).join('/'), setDoc: mocks.setDoc, deleteDoc: mocks.deleteDoc,
  serverTimestamp: () => 'server-timestamp',
}));
import { useSaveHabitCheck, useClearHabitCheck } from './useHabits';
const habit: HabitDoc = { id: 'h', title: '운동', weight: 5, timeOfDay: 'anytime', order: 0, scoreMode: 'scaled', achieveThreshold: 3, iconName: 'leaf', active: true };

describe('habit check writes', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('merges a score edit so existing and concurrently saved metadata survive', async () => {
    let stored: any = { score: 2, achieved: false, note: '이전 메모', mood: 3, tags: ['회복'], whyMissed: '피곤', futureMetadata: true };
    mocks.setDoc.mockImplementation(async (_path, patch, options) => {
      stored.note = '다른 창에서 저장한 메모';
      stored = options?.merge ? { ...stored, ...patch } : patch;
    });
    await useSaveHabitCheck('2026-10-18')(habit, 5, { score: 2 } as any);
    expect(stored).toMatchObject({ score: 5, achieved: true, note: '다른 창에서 저장한 메모', mood: 3, tags: ['회복'], whyMissed: '피곤', futureMetadata: true });
    expect(mocks.setDoc.mock.calls[0][0]).toBe('users/test-user/days/2026-10-18/habitChecks/h');
  });
  it('creates an explicit skip from an absent record', async () => {
    await useSaveHabitCheck()(habit, null);
    expect(mocks.setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ score: null, achieved: false }), { merge: true });
  });
  it('does not write an unchanged score', async () => {
    await useSaveHabitCheck()(habit, 3, { score: 3 } as any);
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
  it('refuses future save and delete operations', async () => {
    await useSaveHabitCheck('2026-10-20')(habit, 5);
    await useClearHabitCheck('2026-10-20')(habit, { score: 3 } as any);
    expect(mocks.setDoc).not.toHaveBeenCalled();
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
  });
  it('propagates save failures so the editor can keep the selection open', async () => {
    mocks.setDoc.mockRejectedValueOnce(new Error('offline'));
    await expect(useSaveHabitCheck()(habit, 5)).rejects.toThrow('offline');
  });
});
