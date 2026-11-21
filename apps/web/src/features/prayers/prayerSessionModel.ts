import type { PrayerSessionDoc } from 'shared/types/firestore';

/** A prayer session is always assigned to its start-day (04:00 KST boundary). */
export const PRAYER_HEARTBEAT_MS = 15_000;
export const PRAYER_STALE_MS = PRAYER_HEARTBEAT_MS * 3;

export type PrayerSessionStatus = 'active' | 'completed' | 'interrupted';

export interface LocalPrayerSession {
  id: string;
  date: string;
  startedAtMs: number;
  lastActiveAtMs: number;
  endedAtMs?: number;
  status: PrayerSessionStatus;
}

/** Never calculate a running session from the current wall clock: only confirmed activity counts. */
export function elapsedPrayerSeconds(startedAtMs: number, lastActiveAtMs: number): number {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(lastActiveAtMs)) return 0;
  return Math.max(0, Math.floor((lastActiveAtMs - startedAtMs) / 1000));
}

export function shouldRecoverPrayerSession(session: LocalPrayerSession, nowMs: number): boolean {
  return session.status !== 'active' || (nowMs - session.lastActiveAtMs >= PRAYER_STALE_MS);
}

export function prayerDurationLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  if (hours) return hours + '시간' + (mins ? ' ' + mins + '분' : '');
  if (mins) return mins + '분';
  return safe + '초';
}

export function prayerTimeLabel(value: PrayerSessionDoc['startedAt'] | undefined): string {
  const date = value?.toDate?.();
  if (!date || !Number.isFinite(date.getTime())) return '—';
  return date.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function prayerSessionsSeconds(sessions: PrayerSessionDoc[]): number {
  return sessions.reduce((sum, session) => {
    const seconds = session.durationSeconds;
    return sum + (Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0);
  }, 0);
}

/** An abandoned session never accrues extra minutes after its last heartbeat. */
export function prayerSessionIsStale(session: PrayerSessionDoc, nowMs: number): boolean {
  return session.status === 'active'
    && (nowMs - (session.lastActiveAt?.toMillis?.() ?? 0)) >= PRAYER_STALE_MS;
}
