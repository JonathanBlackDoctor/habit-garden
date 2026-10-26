import { useEffect, useState } from 'react';
import { collection, documentId, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { lastNDates, weekdayLabel } from '@/lib/dayBoundary';
import { cn } from '@/lib/utils';

/** 최근 7 플래너 날짜의 저장된 일일 점수(0~100)를 읽는다.
 * 날짜 필드가 없는 오래된 문서도 포함하도록 문서 ID로 조회한다. */
export default function CompactWeeklyScore({ className }: { className?: string }) {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [scores, setScores] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!uid) { setScores({}); return; }
    const dates = lastNDates(today, 7);
    const q = query(
      collection(db, 'users', uid, 'days'),
      where(documentId(), '>=', dates[0]),
      where(documentId(), '<=', today),
    );
    return onSnapshot(q, (snapshot) => {
      const next: Record<string, number | null> = {};
      for (const day of snapshot.docs) {
        const value: unknown = day.data().dayScore;
        next[day.id] = typeof value === 'number' && Number.isFinite(value)
          ? Math.max(0, Math.min(100, value))
          : null;
      }
      setScores(next);
    }, () => setScores({}));
  }, [uid, today]);

  const days = lastNDates(today, 7).map((date) => ({
    date,
    score: scores[date] ?? null,
  }));
  const recorded = days.filter((day) => day.score !== null);
  const average = recorded.length
    ? Math.round(recorded.reduce((sum, day) => sum + (day.score ?? 0), 0) / recorded.length)
    : null;
  const x = (index: number) => 12 + (index * 196) / 6;
  const y = (score: number) => 8 + (100 - score) * 0.32;

  return (
    <section className={cn('flex items-center gap-3 border-b border-[var(--divider-soft)] pb-3', className)} aria-label="최근 7일 점수 추이">
      <div className="w-[104px] shrink-0">
        <p className="text-[12px] tracking-[-0.01em] text-[var(--fg-faint)]">최근 7일 점수</p>
        <p className="mt-1 text-[15px] font-medium tabular-nums text-[var(--fg-primary)]">
          {average === null ? '기록 없음' : '평균 ' + average + '점'}
        </p>
      </div>
      <svg
        className="h-[58px] min-w-0 flex-1"
        viewBox="0 0 220 58"
        role="img"
        aria-label={'최근 7일 점수: ' + days.map((day) => day.date + ' ' + (day.score === null ? '기록 없음' : day.score + '점')).join(', ')}
      >
        <line x1={12} y1={40} x2={208} y2={40} stroke="var(--divider-soft)" strokeWidth={1} />
        {days.slice(1).map((day, index) => {
          const before = days[index];
          if (before.score === null || day.score === null) return null;
          return (
            <line
              key={day.date}
              x1={x(index)} y1={y(before.score)}
              x2={x(index + 1)} y2={y(day.score)}
              stroke="var(--leaf)" strokeWidth={2} strokeLinecap="round"
            />
          );
        })}
        {days.map((day, index) => (
          <g key={day.date}>
            <circle
              cx={x(index)} cy={day.score === null ? 40 : y(day.score)}
              r={day.score === null ? 2 : day.date === today ? 3.8 : 2.9}
              fill={day.score === null ? 'var(--border)' : 'var(--leaf)'}
            />
            <text
              x={x(index)} y={55} textAnchor="middle" fontSize={10}
              fill={day.date === today ? 'var(--fg-primary)' : 'var(--fg-faint)'}
              fontWeight={day.date === today ? 600 : 400}
            >
              {weekdayLabel(day.date)}
            </text>
            <title>{day.date + ' · ' + (day.score === null ? '기록 없음' : day.score + '점')}</title>
          </g>
        ))}
      </svg>
    </section>
  );
}
