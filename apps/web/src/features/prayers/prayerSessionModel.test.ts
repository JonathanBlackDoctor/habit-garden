import { describe, expect, it } from 'vitest';
import type { PrayerSessionDoc } from 'shared/types/firestore';
import {
  elapsedPrayerSeconds, prayerDurationLabel, prayerSessionsSeconds,
  prayerSessionIsStale, shouldRecoverPrayerSession, PRAYER_STALE_MS,
} from './prayerSessionModel';
import { plannerDate } from '@/lib/dayBoundary';

describe('prayer session recording', () => {
  it('counts only confirmed time and never negative durations', () => {
    expect(elapsedPrayerSeconds(100_000, 123_990)).toBe(23);
    expect(elapsedPrayerSeconds(100_000, 99_000)).toBe(0);
    expect(elapsedPrayerSeconds(NaN, 100_000)).toBe(0);
  });
  it('recovers abandoned active sessions from the last heartbeat, not from reopening', () => {
    const old = { id: 'a', date: '2026-11-21', startedAtMs: 1000, lastActiveAtMs: 31000, status: 'active' as const };
    expect(shouldRecoverPrayerSession(old, 31000 + PRAYER_STALE_MS - 1)).toBe(false);
    expect(shouldRecoverPrayerSession(old, 31000 + PRAYER_STALE_MS)).toBe(true);
    expect(elapsedPrayerSeconds(old.startedAtMs, old.lastActiveAtMs)).toBe(30);
    expect(shouldRecoverPrayerSession({ ...old, status: 'interrupted' }, 32000)).toBe(true);
  });
  it('totals only saved durations, never a live wall-clock estimate', () => {
    const list = [{ status: 'completed', durationSeconds: 125 }, { status: 'active', durationSeconds: 48 }, { status: 'interrupted', durationSeconds: 30 }] as PrayerSessionDoc[];
    expect(prayerSessionsSeconds(list)).toBe(203);
    expect(prayerSessionIsStale({ ...list[1], lastActiveAt: { toMillis: () => 30_000 } } as PrayerSessionDoc, 30_000 + PRAYER_STALE_MS)).toBe(true);
  });
  it('shows readable totals', () => {
    expect(prayerDurationLabel(0)).toBe('0초');
    expect(prayerDurationLabel(23)).toBe('23초');
    expect(prayerDurationLabel(62)).toBe('1분');
    expect(prayerDurationLabel(3720)).toBe('1시간 2분');
  });
  it('keeps sessions starting before 04:00 KST on the previous planner day', () => {
    expect(plannerDate(new Date('2026-11-20T18:59:59Z'))).toBe('2026-11-20');
    expect(plannerDate(new Date('2026-11-20T19:00:00Z'))).toBe('2026-11-21');
  });
});
