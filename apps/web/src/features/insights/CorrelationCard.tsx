import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useRecentReflections } from '@/features/habits/useReflections';
import { useHabits } from '@/features/habits/useHabits';

const MOOD_EMOJIS = ['😣', '😕', '😐', '🙂', '😄'];

interface Row {
  habitId: string;
  title: string;
  avgMood: number;
  n: number;
}

/**
 * 무드-습관 상관 리포트 (B-16).
 * 최근 회고(reflections) entries 의 mood 를 습관별로 평균내어,
 * 어떤 습관을 할 때 기분이 좋고/나쁜지 보여준다.
 */
export default function CorrelationCard() {
  const reflections = useRecentReflections(30);
  const habits = useHabits({ includeInactive: true });

  const rows = useMemo<Row[]>(() => {
    const titleMap = new Map(habits.map((h) => [h.id, h.title]));
    const acc = new Map<string, { sum: number; n: number }>();
    for (const day of reflections) {
      for (const e of day.entries ?? []) {
        if (typeof e.mood !== 'number') continue;
        const cur = acc.get(e.habitId) ?? { sum: 0, n: 0 };
        cur.sum += e.mood;
        cur.n += 1;
        acc.set(e.habitId, cur);
      }
    }
    return [...acc.entries()]
      .filter(([, v]) => v.n >= 2) // 최소 2회 이상 기록된 습관만
      .map(([habitId, v]) => ({
        habitId,
        title: titleMap.get(habitId) ?? '(삭제된 습관)',
        avgMood: v.sum / v.n,
        n: v.n,
      }))
      .sort((a, b) => a.avgMood - b.avgMood); // 기분 낮은 순 (주의가 필요한 습관 먼저)
  }, [reflections, habits]);

  if (rows.length === 0) return null;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-[var(--leaf)]" />
        <h3 className="text-sm font-medium text-[var(--fg-primary)]">습관별 기분</h3>
      </div>
      <p className="text-[11px] leading-snug text-[var(--fg-faint)]">
        체크 직후 남긴 기분의 평균이에요. 기분이 낮은 습관은 시간대를 바꾸거나 잘게 쪼개보세요.
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const idx = Math.min(4, Math.max(0, Math.round(r.avgMood) - 1));
          return (
            <li key={r.habitId} className="flex items-center gap-2 text-sm">
              <span className="text-base">{MOOD_EMOJIS[idx]}</span>
              <span className="flex-1 truncate text-[var(--fg-primary)]">{r.title}</span>
              <span className="tabular-nums text-xs text-[var(--fg-muted)]">{r.avgMood.toFixed(1)}</span>
              <span className="tabular-nums text-[10px] text-[var(--fg-faint)]">({r.n})</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
