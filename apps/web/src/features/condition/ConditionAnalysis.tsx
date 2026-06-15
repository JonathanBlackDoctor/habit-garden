import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Moon, Zap, Smile, BarChart3, Sparkles } from 'lucide-react';
import { useConditionHistory, type ConditionDay } from './useConditionHistory';

/** 'HH:mm' 두 시각으로 수면 시간(시간 단위) 계산. 기상이 취침보다 이르면 자정을 넘긴 것으로 본다. */
function sleepHours(bed?: string, wake?: string): number | null {
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  if ([bh, bm, wh, wm].some((n) => Number.isNaN(n))) return null;
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

interface MetricStat {
  recent: number | null;   // 최근 7 기록일 평균
  prev: number | null;     // 그 이전 7 기록일 평균
  spark: number[];         // 오래된→최근 순 값 (스파크라인용)
  max: number;             // 정규화 상한
}

function metricStat(days: ConditionDay[], pick: (c: ConditionDay) => number | undefined, max: number): MetricStat {
  // days 는 최신순. 값이 있는 항목만 모은다.
  const withVal = days.map(pick).map((v) => (typeof v === 'number' ? v : null));
  const recentVals: number[] = [];
  const prevVals: number[] = [];
  let seen = 0;
  for (const v of withVal) {
    if (v === null) continue;
    if (seen < 7) recentVals.push(v);
    else if (seen < 14) prevVals.push(v);
    seen++;
  }
  const sparkSource = withVal.filter((v): v is number => v !== null).slice(0, 10).reverse();
  return { recent: avg(recentVals), prev: avg(prevVals), spark: sparkSource, max };
}

function Trend({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.05) {
    return <span className="flex items-center gap-0.5 text-[10px] text-[var(--fg-faint)]"><Minus size={10} /></span>;
  }
  const up = delta > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] tabular-nums ${up ? 'text-[var(--leaf)]' : 'text-[var(--bloom)]'}`}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {up ? '+' : ''}{delta.toFixed(delta % 1 === 0 ? 0 : 1)}
    </span>
  );
}

function Sparkline({ values, max, color }: { values: number[]; max: number; color: string }) {
  if (values.length < 2) return null;
  return (
    <div className="flex h-6 items-end gap-[3px]">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{ height: `${Math.max(8, (Math.min(v, max) / max) * 100)}%`, background: color, opacity: 0.35 + 0.65 * (i + 1) / values.length }}
        />
      ))}
    </div>
  );
}

function MetricTile({
  icon, label, stat, unit, color, decimals = 0,
}: {
  icon: React.ReactNode; label: string; stat: MetricStat; unit: string; color: string; decimals?: number;
}) {
  return (
    <div className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 space-y-1.5">
      <div className="flex items-center gap-1 text-[var(--fg-muted)]">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold tabular-nums text-[var(--fg-primary)]">
          {stat.recent === null ? '–' : stat.recent.toFixed(decimals)}
        </span>
        <span className="text-[10px] text-[var(--fg-faint)]">{unit}</span>
        {stat.recent !== null && stat.prev !== null && <Trend delta={stat.recent - stat.prev} />}
      </div>
      <Sparkline values={stat.spark} max={stat.max} color={color} />
    </div>
  );
}

/**
 * 컨디션 분석 — 최근 기록을 바탕으로 수면·에너지·기분의 평균과 추세,
 * 평균 수면 시간, 그리고 수면과 컨디션의 관계 인사이트를 보여준다.
 */
export default function ConditionAnalysis() {
  const days = useConditionHistory(35);

  const sleep = useMemo(() => metricStat(days, (d) => d.condition.sleepScore, 100), [days]);
  const energy = useMemo(() => metricStat(days, (d) => d.condition.energyScore, 100), [days]);
  const mood = useMemo(() => metricStat(days, (d) => d.condition.moodScore, 10), [days]);

  const durations = useMemo(
    () => days.map((d) => sleepHours(d.condition.bedTime, d.condition.wakeTime)).filter((h): h is number => h !== null),
    [days],
  );
  const avgDuration = avg(durations);

  // 수면↔에너지 인사이트 — 수면 점수가 기록된 날을 중앙값으로 나눠 에너지 평균을 비교.
  const insight = useMemo(() => {
    const paired = days
      .map((d) => ({ s: d.condition.sleepScore, e: d.condition.energyScore }))
      .filter((p): p is { s: number; e: number } => typeof p.s === 'number' && typeof p.e === 'number');
    if (paired.length < 6) return null;
    const sorted = [...paired].sort((a, b) => a.s - b.s);
    const mid = Math.floor(sorted.length / 2);
    const lowAvg = avg(sorted.slice(0, mid).map((p) => p.e));
    const highAvg = avg(sorted.slice(sorted.length - mid).map((p) => p.e));
    if (lowAvg === null || highAvg === null) return null;
    const gap = highAvg - lowAvg;
    if (gap < 6) return '수면 점수와 에너지의 뚜렷한 연관은 아직 보이지 않아요.';
    return `잘 잔 날의 에너지가 평균 ${Math.round(gap)}점 높았어요. 수면이 컨디션을 끌어올리고 있어요.`;
  }, [days]);

  const recordedCount = days.length;

  if (recordedCount < 3) {
    return (
      <section className="card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-[var(--leaf)]" />
          <h3 className="text-sm font-medium text-[var(--fg-primary)]">컨디션 분석</h3>
        </div>
        <p className="text-xs text-[var(--fg-faint)]">
          며칠 더 기록하면 수면·에너지·기분의 추세와 인사이트를 보여드릴게요. (현재 {recordedCount}일 기록)
        </p>
      </section>
    );
  }

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={16} className="text-[var(--leaf)]" />
        <h3 className="text-sm font-medium text-[var(--fg-primary)]">컨디션 분석</h3>
        <span className="ml-auto text-[10px] text-[var(--fg-faint)]">최근 {recordedCount}일</span>
      </div>

      <div className="flex gap-2">
        <MetricTile icon={<Moon size={12} />} label="수면" stat={sleep} unit="점" color="var(--sky)" />
        <MetricTile icon={<Zap size={12} />} label="에너지" stat={energy} unit="점" color="var(--leaf)" />
        <MetricTile icon={<Smile size={12} />} label="기분" stat={mood} unit="/10" color="var(--bloom)" decimals={1} />
      </div>

      <p className="text-[10px] text-[var(--fg-faint)]">최근 7일 평균 · 화살표는 그 이전 7일과 비교</p>

      {avgDuration !== null && (
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--sky)]/10 px-3 py-2">
          <Moon size={14} className="text-[var(--sky)]" />
          <span className="text-xs text-[var(--fg-muted)]">평균 수면 시간</span>
          <span className="ml-auto text-sm font-semibold tabular-nums text-[var(--fg-primary)]">
            {Math.floor(avgDuration)}시간 {Math.round((avgDuration % 1) * 60)}분
          </span>
        </div>
      )}

      {insight && (
        <div className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--leaf-soft)] px-3 py-2">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-[var(--leaf)]" />
          <p className="text-xs leading-snug text-[var(--fg-primary)]">{insight}</p>
        </div>
      )}
    </section>
  );
}
