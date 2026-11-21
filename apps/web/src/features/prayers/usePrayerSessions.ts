import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, Timestamp, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { lastNDates, plannerDate } from '@/lib/dayBoundary';
import type { PrayerSessionDoc } from 'shared/types/firestore';
import {
  elapsedPrayerSeconds, prayerSessionsSeconds, shouldRecoverPrayerSession,
  PRAYER_HEARTBEAT_MS, type LocalPrayerSession, type PrayerSessionStatus,
} from './prayerSessionModel';

const STORAGE_PREFIX = 'habitGarden.prayerSession.v1:';

function storageKey(uid: string, id: string): string {
  return STORAGE_PREFIX + uid + ':' + id;
}

function remember(uid: string, session: LocalPrayerSession) {
  try { localStorage.setItem(storageKey(uid, session.id), JSON.stringify(session)); }
  catch { /* private browsing may reject storage; Firestore still works */ }
}

function removeRemembered(uid: string, session: LocalPrayerSession) {
  try {
    const key = storageKey(uid, session.id);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const stored = JSON.parse(raw) as LocalPrayerSession;
    if (stored.id === session.id && stored.status === session.status
      && stored.lastActiveAtMs <= session.lastActiveAtMs) {
      localStorage.removeItem(key);
    }
  } catch { /* no local storage */ }
}

function validStoredSession(value: unknown): value is LocalPrayerSession {
  const s = value as LocalPrayerSession | null;
  return !!s && typeof s.id === 'string' && !!s.id
    && typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)
    && Number.isFinite(s.startedAtMs) && Number.isFinite(s.lastActiveAtMs)
    && s.lastActiveAtMs >= s.startedAtMs
    && (s.status === 'active' || s.status === 'completed' || s.status === 'interrupted');
}

function firestoreData(session: LocalPrayerSession): PrayerSessionDoc {
  return {
    startedAt: Timestamp.fromMillis(session.startedAtMs),
    lastActiveAt: Timestamp.fromMillis(session.lastActiveAtMs),
    ...(session.endedAtMs !== undefined
      ? { endedAt: Timestamp.fromMillis(session.endedAtMs) } : {}),
    durationSeconds: elapsedPrayerSeconds(session.startedAtMs, session.lastActiveAtMs),
    status: session.status,
    updatedAt: Timestamp.now(),
  };
}

/** Local backup is written synchronously before the Firestore request. */
function persist(uid: string, session: LocalPrayerSession) {
  remember(uid, session);
  const ref = doc(db, 'users', uid, 'days', session.date, 'prayerSessions', session.id);
  void setDoc(ref, firestoreData(session), { merge: true })
    .then(() => {
      if (session.status !== 'active') removeRemembered(uid, session);
    })
    .catch((error: unknown) => {
      // Keep the local backup for recovery on next launch; avoid repeated alert banners.
      console.warn('Prayer session will be retried on next launch', error);
    });
}

/**
 * On relaunch, close a crashed session at its last heartbeat (not the relaunch time).
 * Also retries a final write that may not have reached Firestore before a page was killed.
 */
function recoverAbandoned(uid: string) {
  try {
    const prefix = STORAGE_PREFIX + uid + ':';
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      .filter((key): key is string => !!key && key.startsWith(prefix));
    const now = Date.now();
    for (const key of keys) {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
        if (!validStoredSession(value)) { localStorage.removeItem(key); continue; }
        if (!shouldRecoverPrayerSession(value, now)) continue;
        const recovered: LocalPrayerSession = value.status === 'active'
          ? { ...value, status: 'interrupted', endedAtMs: value.lastActiveAtMs }
          : value;
        persist(uid, recovered);
      } catch { /* ignore a corrupted local record */ }
    }
  } catch { /* storage unavailable */ }
}

export function usePrayerSessionRecorder() {
  const uid = useAppStore((s) => s.uid);
  const active = useRef<LocalPrayerSession | null>(null);

  const stop = useCallback((status: 'completed' | 'interrupted', when = Date.now()) => {
    const current = active.current;
    if (!uid || !current) return;
    // Idempotent: closing, pagehide and unmount can all run for the same session.
    active.current = null;
    const end = Math.max(current.lastActiveAtMs, current.startedAtMs, when);
    persist(uid, { ...current, lastActiveAtMs: end, endedAtMs: end, status });
  }, [uid]);

  const start = useCallback((when = Date.now()) => {
    if (!uid) return;
    if (active.current) stop('interrupted', when);
    const day = plannerDate(new Date(when));
    const id = doc(collection(db, 'users', uid, 'days', day, 'prayerSessions')).id;
    const session: LocalPrayerSession = {
      id, date: day, startedAtMs: when, lastActiveAtMs: when, status: 'active',
    };
    active.current = session;
    persist(uid, session);
  }, [uid, stop]);

  const heartbeat = useCallback((when = Date.now()) => {
    const current = active.current;
    if (!uid || !current || when <= current.lastActiveAtMs) return;
    const next = { ...current, lastActiveAtMs: when };
    active.current = next;
    persist(uid, next);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    recoverAbandoned(uid);
    const timer = window.setInterval(() => recoverAbandoned(uid), 60_000);
    return () => { window.clearInterval(timer); stop('interrupted'); };
  }, [uid, stop]);

  return { start, heartbeat, stop, heartbeatIntervalMs: PRAYER_HEARTBEAT_MS };
}

/** Realtime last-seven-days view. No collection-group index is required. */
export function usePrayerSessionHistory(date: string) {
  const uid = useAppStore((s) => s.uid);
  const dates = useMemo(() => lastNDates(date, 7), [date]);
  const key = (uid || '') + ':' + date;
  const [state, setState] = useState<{
    key: string; byDate: Record<string, PrayerSessionDoc[]>; loaded: boolean; error: boolean;
  }>({ key: '', byDate: {}, loaded: false, error: false });

  useEffect(() => {
    if (!uid) return;
    let subscribed = true;
    const byDate: Record<string, PrayerSessionDoc[]> = {};
    const loaded = new Set<string>();
    let failed = false;
    setState({ key, byDate: {}, loaded: false, error: false });
    const unsubscribe = dates.map((day) => onSnapshot(
      collection(db, 'users', uid, 'days', day, 'prayerSessions'),
      (snapshot) => {
        if (!subscribed) return;
        byDate[day] = snapshot.docs.map((item) => ({ ...item.data() as PrayerSessionDoc }));
        loaded.add(day);
        setState({ key, byDate: { ...byDate }, loaded: loaded.size === dates.length, error: failed });
      },
      () => {
        if (!subscribed) return;
        failed = true;
        loaded.add(day);
        setState({ key, byDate: { ...byDate }, loaded: loaded.size === dates.length, error: true });
      },
    ));
    return () => { subscribed = false; unsubscribe.forEach((fn) => fn()); };
  }, [uid, date, key, dates]);

  const current = state.key === key
    ? state
    : { key, byDate: {} as Record<string, PrayerSessionDoc[]>, loaded: false, error: false };
  const todaySessions = current.byDate[date] || [];
  const recentSessions = dates.flatMap((day) =>
    (current.byDate[day] || []).map((session) => ({ ...session, date: day })),
  ).sort((a, b) => (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0));

  return {
    ...current,
    todaySessions,
    recentSessions,
    todaySeconds: prayerSessionsSeconds(todaySessions),
    recentSeconds: prayerSessionsSeconds(recentSessions),
  };
}
