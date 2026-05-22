import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { useHabits, useHabitChecks } from '@/features/habits/useHabits';
import { fetchCrisisCoach } from './useAICoach';
import { toast } from 'sonner';

const FLAG_KEY = 'coach.crisisShown';
const CRISIS_HOUR = 20;

/** Phase 3-4 — 오후 8시 이후 핵심 습관 미체크 시 1회 위기 메시지. */
export function useCrisisWatcher() {
  const date = useAppStore((s) => s.currentDate);
  const habits = useHabits();
  const checks = useHabitChecks(date);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    const flag = localStorage.getItem(FLAG_KEY);
    if (flag === date) return;

    const now = new Date();
    if (now.getHours() < CRISIS_HOUR) return;

    // 핵심 습관 = weight >= 8
    const core = habits.filter((h) => h.weight >= 8);
    if (core.length === 0) return;
    const unchecked = core.filter((h) => !checks[h.id]);
    if (unchecked.length === 0) return;

    triggered.current = true;
    localStorage.setItem(FLAG_KEY, date);

    fetchCrisisCoach()
      .then((c) => {
        toast(c.message, {
          description: '지금이라도 1개만 체크해보면 어떨까요?',
          duration: 10000,
        });
      })
      .catch(() => {});
  }, [date, habits, checks]);
}
