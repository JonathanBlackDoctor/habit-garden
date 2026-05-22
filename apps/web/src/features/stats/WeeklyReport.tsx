import { useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { DayDoc, HabitCheckDoc, HabitDoc } from 'shared/types/firestore';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';

/**
 * Phase 2-3 — 최근 7일 리포트.
 * - 총 체크 / 평균 dayScore
 * - 가장 잘한 습관 TOP 3 (달성 횟수)
 * - 가장 미흡한 습관 1개
 * - 전주 대비 평균 dayScore 차이
 */
function lastNDates(today: string, n: number): string[] {
  const out: string[] = [];
  const t = new Date(today);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(t);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function WeeklyReport() {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [days, setDays] = useState<DayDoc[]>([]);
  const [habits, setHabits] = useState<HabitDoc[]>([]);
  const [checks, setChecks] = useState<Array<HabitCheckDoc & { date: string }>>([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'days'), orderBy('date', 'desc'), limit(14));
    return onSnapshot(q, (snap) => setDays(snap.docs.map((d) => d.data() as DayDoc)));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, 'users', uid, 'habits'), (snap) => {
      setHabits(snap.docs.map((d) => d.data() as HabitDoc));
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    // collectionGroup 으로 최근 14일치 habitChecks 일괄 구독
    const earliest = lastNDates(today, 14)[0];
    const q = query(
      collectionGroup(db, 'habitChecks'),
      where('checkedAt', '>=', new Date(earliest)),
    );
    return onSnapshot(
      q,
      (snap) => {
        const items: Array<HabitCheckDoc & { date: string }> = [];
        snap.docs.forEach((d) => {
          const parts = d.ref.path.split('/');
          if (parts[1] !== uid) return;
          const idx = parts.indexOf('days');
          const date = parts[idx + 1];
          items.push({ ...(d.data() as HabitCheckDoc), date });
        });
        setChecks(items);
      },
      () => setChecks([]),
    );
  }, [uid, today]);

  const report = useMemo(() => {
    const thisWeek = lastNDates(today, 7);
    const lastWeek = lastNDates(today, 14).slice(0, 7);
    const thisDays = days.filter((d) => thisWeek.includes(d.date));
    const lastDays = days.filter((d) => lastWeek.includes(d.date));

    const avg = (arr: DayDoc[]) => {
      const scored = arr.filter((d) => typeof d.dayScore === 'number');
      if (scored.length === 0) return 0;
      return Math.round(scored.reduce((s, d) => s + (d.dayScore ?? 0), 0) / scored.length);
    };
    const thisAvg = avg(thisDays);
    const lastAvg = avg(lastDays);
    const diff = thisAvg - lastAvg;

    // 습관별 달성 횟수
    const habitsMap = Object.fromEntries(habits.map((h) => [h.id, h] as const));
    const counts = new Map<string, { achieved: number; total: number }>();
    checks
      .filter((c) => thisWeek.includes(c.date))
      .forEach((c) => {
        const cur = counts.get(c.habitId) ?? { achieved: 0, total: 0 };
        cur.total += 1;
        if (c.achieved) cur.achieved += 1;
        counts.set(c.habitId, cur);
      });

    const ranked = Array.from(counts.entries())
      .map(([id, v]) => ({ habit: habitsMap[id], ...v }))
      .filter((r) => r.habit)
      .sort((a, b) => b.achieved - a.achieved);

    const top3 = ranked.slice(0, 3);
    const worst = [...ranked].filter((r) => r.total >= 3).sort((a, b) => (a.achieved / a.total) - (b.achieved / b.total))[0];

    const totalChecks = checks.filter((c) => thisWeek.includes(c.date) && c.score !== null).length;

    return { thisAvg, lastAvg, diff, top3, worst, totalChecks };
  }, [days, habits, checks, today]);

  return (
    <div className="card p-4 space-y-3">
      <h3 className="text-sm font-medium text-[var(--fg-primary)]">이번 주 리포트</h3>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-[var(--fg-faint)]">평균 점수</p>
          <p className="text-xl font-bold tabular-nums text-[var(--leaf)]">{report.thisAvg}</p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--fg-faint)]">전주 대비</p>
          <p className={`flex items-center justify-center gap-1 text-xl font-bold tabular-nums ${
            report.diff > 0 ? 'text-[var(--leaf)]' : report.diff < 0 ? 'text-[var(--bloom)]' : 'text-[var(--fg-muted)]'
          }`}>
            {report.diff > 0 ? <TrendingUp size={14} /> : report.diff < 0 ? <TrendingDown size={14} /> : null}
            {report.diff > 0 ? `+${report.diff}` : report.diff}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--fg-faint)]">체크 수</p>
          <p className="text-xl font-bold tabular-nums text-[var(--fg-primary)]">{report.totalChecks}</p>
        </div>
      </div>

      {report.top3.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-[var(--fg-faint)]">잘한 습관 TOP 3</p>
          {report.top3.map((r, i) => (
            <div key={r.habit.id} className="flex items-center gap-2 text-xs">
              <span className="text-[var(--bloom)]">{['🥇', '🥈', '🥉'][i]}</span>
              <span className="flex-1 text-[var(--fg-primary)]">{r.habit.title}</span>
              <span className="tabular-nums text-[var(--fg-muted)]">{r.achieved}/{r.total}</span>
            </div>
          ))}
        </div>
      )}

      {report.worst && (
        <div className="rounded-[var(--radius-sm)] bg-[var(--bloom-soft)]/40 p-2 text-xs">
          <p className="flex items-center gap-1 text-[var(--bloom)]">
            <Star size={12} /> 이번 주 집중 후보
          </p>
          <p className="text-[var(--fg-primary)]">
            {report.worst.habit.title} —{' '}
            <span className="tabular-nums text-[var(--fg-muted)]">{report.worst.achieved}/{report.worst.total}</span>
          </p>
        </div>
      )}
    </div>
  );
}
