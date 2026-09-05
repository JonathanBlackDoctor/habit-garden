import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { lastNDates, weekdayLabel } from '@/lib/dayBoundary';
import type { DayDoc } from 'shared/types/firestore';
import { SectionHeading } from '@/components/Editorial';

/**
 * 지난 7일 리듬 — 정원·포인트·레벨을 걷어낸 뒤 남은 유일한 피드백.
 *
 * 막대 높이는 DayDoc.dayScore(0-100 습관 가중평균)를 그대로 쓴다.
 * 일별 '달성 개수'로 그리려면 7일치 habitChecks를 따로 훑어야 하는데,
 * dayScore가 이미 같은 뜻으로 저장돼 있어 읽기 한 번으로 끝난다.
 */
export default function WeeklyRhythm({ className }: { className?: string }) {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [days, setDays] = useState<DayDoc[]>([]);

  useEffect(() => {
    if (!uid) { setDays([]); return; }
    const q = query(collection(db, 'users', uid, 'days'), orderBy('date', 'desc'), limit(7));
    return onSnapshot(
      q,
      (snap) => setDays(snap.docs.map((d) => d.data() as DayDoc)),
      () => setDays([]),
    );
  }, [uid]);

  const dates = lastNDates(today, 7);
  const byDate = new Map(days.map((d) => [d.date, d] as const));
  const bars = dates.map((date) => {
    const score = byDate.get(date)?.dayScore;
    return { date, score: typeof score === 'number' ? score : null, isToday: date === today };
  });

  const scored = bars.filter((b) => b.score !== null);
  const avg = scored.length
    ? Math.round(scored.reduce((s, b) => s + (b.score ?? 0), 0) / scored.length)
    : null;

  return (
    <section className={className} aria-label="지난 7일 리듬">
      <SectionHeading title="주간 리듬" meta={avg !== null ? `평균 ${avg}점` : '기록 전'} />
      <div className="mt-3 flex h-[54px] items-end gap-2.5">
        {bars.map(({ date, score, isToday }) => (
          <div key={date} className="flex flex-1 flex-col items-center gap-[7px]">
            <div
              className="relative h-[30px] w-full rounded-[4px] bg-[var(--leaf-soft)]"
              title={score !== null ? `${date} · ${score}점` : `${date} · 기록 없음`}
            >
              {score !== null && (
                <div
                  className="absolute inset-x-0 bottom-0 rounded-[4px]"
                  style={{
                    height: `${Math.max(score, 4)}%`,
                    background: isToday ? 'var(--leaf)' : 'var(--leaf-mid)',
                  }}
                />
              )}
            </div>
            <span
              className={
                isToday
                  ? 'text-[11px] font-semibold text-[var(--fg-primary)]'
                  : 'text-[11px] text-[var(--fg-faint)]'
              }
            >
              {weekdayLabel(date)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
