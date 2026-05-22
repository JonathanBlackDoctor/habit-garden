import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { DayDoc } from 'shared/types/firestore';

/** GitHub 잔디형 1년 히트맵. dayScore(0-100) 기준 5단계 색상. */
const WEEKS = 53;
const DAYS_PER_WEEK = 7;
const TOTAL = WEEKS * DAYS_PER_WEEK; // 371

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function levelFromScore(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score <= 0)  return 0;
  if (score < 30)  return 1;
  if (score < 55)  return 2;
  if (score < 80)  return 3;
  return 4;
}

const LEVEL_COLORS = [
  'var(--leaf-soft)',
  '#CDE2B0',
  '#9BC772',
  '#6FA847',
  '#3F6228',
];

export default function HabitHeatmap() {
  const uid = useAppStore((s) => s.uid);
  const [scoreMap, setScoreMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'days'), orderBy('date', 'desc'), limit(TOTAL));
    return onSnapshot(q, (snap) => {
      const map: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as DayDoc;
        if (typeof data.dayScore === 'number') map[data.date] = data.dayScore;
      });
      setScoreMap(map);
    });
  }, [uid]);

  const { cells, monthLabels } = useMemo(() => {
    const today = new Date();
    // 정렬: 왼쪽이 가장 오래된 주, 오른쪽이 이번 주. 행=요일, 열=주
    const start = new Date(today);
    start.setDate(start.getDate() - (TOTAL - 1));
    // 시작점을 일요일로 정렬
    const startDow = start.getDay();
    start.setDate(start.getDate() - startDow);

    const cells: Array<{ date: string; score: number; future: boolean }> = [];
    for (let i = 0; i < WEEKS * DAYS_PER_WEEK; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const future = d > today;
      const date = ymd(d);
      cells.push({ date, score: scoreMap[date] ?? 0, future });
    }

    // 월 라벨 — 각 열의 첫 일요일이 새 달에 진입하면 라벨 추가
    const monthLabels: Array<{ col: number; text: string }> = [];
    let lastMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
      const cell = cells[w * DAYS_PER_WEEK];
      const m = new Date(cell.date).getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ col: w, text: `${m + 1}월` });
        lastMonth = m;
      }
    }

    return { cells, monthLabels };
  }, [scoreMap]);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--fg-primary)]">1년 잔디</h3>
        <span className="text-[10px] text-[var(--fg-faint)]">
          {Object.keys(scoreMap).length}일 기록
        </span>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="inline-block">
          {/* 월 라벨 */}
          <div className="relative h-3 mb-1" style={{ width: `${WEEKS * 12}px` }}>
            {monthLabels.map((m) => (
              <span
                key={`${m.col}-${m.text}`}
                className="absolute text-[9px] text-[var(--fg-faint)]"
                style={{ left: `${m.col * 12}px` }}
              >
                {m.text}
              </span>
            ))}
          </div>
          {/* 격자 */}
          <div
            className="grid gap-[2px]"
            style={{
              gridTemplateColumns: `repeat(${WEEKS}, 10px)`,
              gridTemplateRows: `repeat(${DAYS_PER_WEEK}, 10px)`,
              gridAutoFlow: 'column',
            }}
          >
            {cells.map((c, i) => {
              const lv = levelFromScore(c.score);
              return (
                <div
                  key={i}
                  title={c.future ? c.date : `${c.date} · ${c.score}점`}
                  className="h-2.5 w-2.5 rounded-[2px]"
                  style={{
                    background: c.future ? 'transparent' : LEVEL_COLORS[lv],
                    border: c.future ? '1px dashed var(--leaf-soft)' : 'none',
                    opacity: c.future ? 0.3 : 1,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-[var(--fg-faint)]">
        <span>적음</span>
        <div className="flex gap-[2px]">
          {LEVEL_COLORS.map((c, i) => (
            <div key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />
          ))}
        </div>
        <span>많음</span>
      </div>
    </div>
  );
}
