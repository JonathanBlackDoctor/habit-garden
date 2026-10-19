import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ settings: null as any, setDoc: vi.fn() }));
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./store', () => ({ useAppStore: (select: any) => select({ settings: mocks.settings }) }));
vi.mock('firebase/firestore', () => ({ doc: (...parts: any[]) => parts.slice(1).join('/'), setDoc: mocks.setDoc, serverTimestamp: () => 'server-time' }));
import { setWeeklyHabitMode, useWeeklyHabitMode } from './features';

describe('optional weekly habit mode', () => {
  beforeEach(() => { mocks.settings = null; vi.clearAllMocks(); });
  it('keeps original behavior until explicitly enabled', () => {
    expect(useWeeklyHabitMode()).toBe(false);
    mocks.settings = { features: { faith: true } };
    expect(useWeeklyHabitMode()).toBe(false);
    mocks.settings.weeklyHabitMode = true;
    expect(useWeeklyHabitMode()).toBe(true);
    mocks.settings.weeklyHabitMode = false;
    expect(useWeeklyHabitMode()).toBe(false);
  });
  it.each([true, false])('persists %s without replacing other settings or habit records', async (enabled) => {
    await setWeeklyHabitMode('test-user', enabled);
    expect(mocks.setDoc).toHaveBeenCalledWith('users/test-user/settings/main', { weeklyHabitMode: enabled, updatedAt: 'server-time' }, { merge: true });
  });
  it('propagates a failed save so the setting can show retry feedback', async () => {
    mocks.setDoc.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(setWeeklyHabitMode('test-user', true)).rejects.toThrow('permission-denied');
  });
});
