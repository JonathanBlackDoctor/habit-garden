import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { HabitCheckDoc } from 'shared/types/firestore';
import type { WeekChecks } from './habitWeek';

export function useHabitWeek(dates: string[]) {
  const uid = useAppStore((s) => s.uid);
  const key = `${uid}:${dates.join(',')}`;
  const [state, setState] = useState<{ key: string; checks: WeekChecks; loading: boolean; error: boolean }>({
    key: '', checks: {}, loading: true, error: false,
  });
  useEffect(() => {
    if (!uid) return;
    let active = true;
    const checks: WeekChecks = {};
    const loaded = new Set<string>();
    let failed = false;
    setState({ key, checks: {}, loading: true, error: false });
    const unsubscribes = dates.map((date) => onSnapshot(
      collection(db, 'users', uid, 'days', date, 'habitChecks'),
      (snapshot) => {
        if (!active) return;
        checks[date] = Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data() as HabitCheckDoc]));
        loaded.add(date);
        setState({ key, checks: { ...checks }, loading: loaded.size < dates.length, error: failed });
      },
      () => {
        if (!active) return;
        failed = true;
        setState({ key, checks: {}, loading: false, error: true });
      },
    ));
    return () => { active = false; unsubscribes.forEach((unsubscribe) => unsubscribe()); };
  }, [uid, key]);
  return state.key === key ? state : { key, checks: {}, loading: true, error: false };
}
