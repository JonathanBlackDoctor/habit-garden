import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, documentId, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { weekdayLabel } from '@/lib/dayBoundary';
import { cn } from '@/lib/utils';
import {
  changeScoreWeek, MAX_SCORE_WEEKS, scoreWeekAfterDrag, weeklyScoreDates,
} from './weeklyScoreWindow';

/**
 * 현재 7일과 이전 기록을 탐색하는 미니 차트.
 * 일일 가중 점수(DayDoc.dayScore)를 그대로 사용하며, 미기록은 0점과 구분한다.
 * 가로로 당기거나 화살표로 한 번에 7일씩 이동한다.
 */
export default function CompactWeeklyScore({ className }: { className?: string }) {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [weeksAgo, setWeeksAgo] = useState(0);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [loadFailed, setLoadFailed] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);

  useEffect(() => { setWeeksAgo(0); }, [today, uid]);

  const dates = weeklyScoreDates(today, weeksAgo);
  const firstDate = dates[0];
  const lastDate = dates[6];

  useEffect(() => {
    if (!uid) { setScores({}); return; }
    setLoadFailed(false);
    // 문서 ID로 조회해 기존 날짜 필드가 없는 문서도 빠짐없이 포함한다.
    const q = query(
      collection(db, 'users', uid, 'days'),
      where(documentId(), '>=', firstDate),
      where(documentId(), '<=', lastDate),
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
    }, () => {
      setScores({});
      setLoadFailed(true);
    });
  }, [uid, firstDate, lastDate]);

  const points = dates.map((date) => ({ date, score: scores[date] ?? null }));
  const valid = points.filter((point) => point.score !== null);
  const average = valid.length
    ? Math.round(valid.reduce((sum, point) => sum + (point.score ?? 0), 0) / valid.length)
    : null;
  const range = firstDate.slice(5).replace('-', '/') + '–' + lastDate.slice(5).replace('-', '/');

  // 좌측 104px 고정 설명 영역을 제거하고 점들을 전체 폭에 균등하게 분포시킨다.
  const x = (index: number) => 16 + index * 48;
  const y = (score: number) => 20 + (100 - score) * 0.43;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // 세로 스크롤 중에는 그래프를 이동시키지 않는다.
    setDragX(Math.abs(dx) > Math.abs(dy) * 1.2 ? dx : 0);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    setDragX(0);
    setWeeksAgo((current) => scoreWeekAfterDrag(
      current, event.clientX - start.x, event.clientY - start.y,
    ));
  };

  const onPointerCancel = () => {
    drag.current = null;
    setDragX(0);
  };

  return (
    <section
      className={cn('min-w-0 border-b border-[var(--divider-soft)] pb-2.5', className)}
      aria-label="일별 점수 추이"
      data-no-swipe
      data-no-pull
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[12px] font-medium tracking-[-0.01em] text-[var(--fg-muted)]">7일 점수</span>
          <span className="truncate text-[10px] tabular-nums text-[var(--fg-faint)]" title={firstDate + ' – ' + lastDate}>
            {range}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="mr-1 text-[10.5px] tabular-nums text-[var(--fg-muted)]">
            {loadFailed ? '조회 실패' : average === null ? '기록 없음' : '평균 ' + average + '점'}
          </span>
          <button
            type="button"
            onClick={() => setWeeksAgo((current) => changeScoreWeek(current, 'older'))}
            disabled={weeksAgo >= MAX_SCORE_WEEKS}
            aria-label="이전 7일 점수"
            title="이전 7일"
            className="grid h-7 w-7 place-items-center rounded-full text-[var(--fg-faint)] transition-colors hover:bg-[var(--leaf-soft)] disabled:opacity-30"
          >
            <ChevronLeft size={15} strokeWidth={1.7} />
          </button>
          <button
            type="button"
            onClick={() => setWeeksAgo((current) => changeScoreWeek(current, 'newer'))}
            disabled={weeksAgo === 0}
            aria-label="다음 7일 점수"
            title="최근으로"
            className="grid h-7 w-7 place-items-center rounded-full text-[var(--fg-faint)] transition-colors hover:bg-[var(--leaf-soft)] disabled:opacity-30"
          >
            <ChevronRight size={15} strokeWidth={1.7} />
          </button>
        </div>
      </div>
      <div
        className="cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        title="오른쪽으로 밀어 이전 7일, 왼쪽으로 밀어 다음 7일 보기"
      >
        <svg
          className="block w-full"
          viewBox="0 0 320 86"
          role="img"
          aria-label={'7일 점수: ' + points.map((point) =>
            point.date + ' ' + (point.score === null ? '기록 없음' : point.score + '점'),
          ).join(', ')}
          style={{ transform: 'translateX(' + Math.max(-18, Math.min(18, dragX / 5)) + 'px)' }}
        >
          <line x1={16} y1={63} x2={304} y2={63} stroke="var(--divider-soft)" strokeWidth={1} />
          {points.slice(1).map((point, index) => {
            const prev = points[index];
            if (prev.score === null || point.score === null) return null;
            return (
              <line
                key={point.date}
                x1={x(index)} y1={y(prev.score)}
                x2={x(index + 1)} y2={y(point.score)}
                stroke="var(--leaf)" strokeWidth={1.9} strokeLinecap="round"
              />
            );
          })}
          {points.map((point, index) => (
            <g key={point.date}>
              {point.score !== null && (
                <text
                  x={x(index)} y={y(point.score) - 7}
                  textAnchor="middle" fontSize={9} fontWeight={500}
                  fill="var(--fg-muted)"
                >
                  {Math.round(point.score)}
                </text>
              )}
              <circle
                cx={x(index)} cy={point.score === null ? 63 : y(point.score)}
                r={point.score === null ? 2 : point.date === today ? 3.5 : 2.8}
                fill={point.score === null ? 'var(--border)' : 'var(--leaf)'}
              />
              <text
                x={x(index)} y={80} textAnchor="middle" fontSize={10}
                fill={point.date === today ? 'var(--fg-primary)' : 'var(--fg-faint)'}
                fontWeight={point.date === today ? 600 : 400}
              >
                {weekdayLabel(point.date)}
              </text>
              <title>{point.date + ' · ' + (point.score === null ? '기록 없음' : point.score + '점')}</title>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
