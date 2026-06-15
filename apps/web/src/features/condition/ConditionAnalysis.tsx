import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Moon, Smile, Gauge, ListChecks, BarChart3, Sparkles } from 'lucide-react';
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

/**
 * 원인(수면·에너지) → 결과(기분·하루 만족·습관 이행) 상관 인사이트.
 * 원인 값이 있는 날을 중앙값으로 둘로 나눠, 두 집단의 결과 평균 차이를 본다.
 */
function driverGap(
  days: ConditionDay[],
  driver: (d: ConditionDay) => number | undefined,
  outcome: (d: ConditionDay) => number | undefined,
): { gap: number; n: number } | null {
  const paired = days
    .map((d) => ({ x: driver(d), y: outcome(d) }))
    .filter((p): p is { x: number; y: number } => typeof p.x === 'number' && typeof p.y === 'number');
  if (paired.length < 6) return null;
  const sorted = [...paired].sort((a, b) => a.x - b.x);
  const mid = Math.floor(sorted.length / 2);
  const lowAvg = avg(sorted.slice(0, mid).map((p) => p.y));
  const highAvg = avg(sorted.slice(sorted.length - mid).map((p) => p.y));
  if (lowAvg === null || highAvg === null) return null;
  return { gap: highAvg - lowAvg, n: paired.length };
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
 * 컨디션 분석 — 기분·하루 만족·습관 이행(종속변수)을 중심으로 추세를 보여주고,
 * 수면·에너지(원인, 삼성 헬스에서 상세 분석) 가 그 결과에 주는 영향을 인사이트로 정리한다.
 */
export default function ConditionAnalysis() {
  const days = useConditionHistory(35);

  // ── 결과(종속변수) — 분석의 주역 ──
  const mood = useMemo(() => metricStat(days, (d) => d.condition.moodScore, 10), [days]);
  const satisfaction = useMemo(() => metricStat(days, (d) => d.daySatisfaction, 10), [days]);
  const dayScore = useMemo(() => metricStat(days, (d) => d.dayScore, 100), [days]);

  // ── 원인(독립변수) — 참고 지표 (상세 분석은 삼성 헬스) ──
  const sleep = useMemo(() => metricStat(days, (d) => d.condition.sleepScore, 100), [days]);
  const energy = useMemo(() => metricStat(days, (d) => d.condition.energyScore, 100), [days]);
  const durations = useMemo(
    () => days.map((d) => sleepHours(d.condition.bedTime, d.condition.wakeTime)).filter((h): h is number => h !== null),
    [days],
  );
  const avgDuration = avg(durations);

  // ── 원인 → 결과 인사이트 — 가장 뚜렷한 1~2개만 ──
  const insights = useMemo(() => {
    const drivers = [
      { key: 'sleep', phrase: '잘 잔 날', pick: (d: ConditionDay) => d.condition.sleepScore },
      { key: 'energy', phrase: '에너지가 높았던 날', pick: (d: ConditionDay) => d.condition.energyScore },
    ];
    const outcomes = [
      { key: 'mood', label: '기분', max: 10, unit: '점', pick: (d: ConditionDay) => d.condition.moodScore, fmt: (g: number) => g.toFixed(1) },
      { key: 'sat', label: '하루 만족도', max: 10, unit: '점', pick: (d: ConditionDay) => d.daySatisfaction, fmt: (g: number) => g.toFixed(1) },
      { key: 'day', label: '습관 이행', max: 100, unit: '점', pick: (d: ConditionDay) => d.dayScore, fmt: (g: number) => Math.round(g).toString() },
    ];
    const found: { strength: number; text: string }[] = [];
    for (const dr of drivers) {
      for (const oc of outcomes) {
        const res = driverGap(days, dr.pick, oc.pick);
        if (!res) continue;
        const strength = res.gap / oc.max; // 정규화 (상한 대비)
        if (strength < 0.1) continue;      // 기분/만족 1점, 습관 10점 미만은 '뚜렷함' 아님
        found.push({
          strength,
          text: `${dr.phrase} ${oc.label}이(가) 평균 ${oc.fmt(res.gap)}${oc.unit} 높았어요.`,
        });
      }
    }
    found.sort((a, b) => b.strength - a.strength);
    return found.slice(0, 2).map((f) => f.text);
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
          며칠 더 기록하면 기분·하루 만족·습관 이행의 추세와, 수면·에너지가 그날에 준 영향을 보여드릴게요. (현재 {recordedCount}일 기록)
        </p>
      </section>
    );
  }

  const hasDriverAvg = sleep.recent !== null || energy.recent !== null || avgDuration !== null;

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={16} className="text-[var(--leaf)]" />
        <h3 className="text-sm font-medium text-[var(--fg-primary)]">컨디션 분석</h3>
        <span className="ml-auto text-[10px] text-[var(--fg-faint)]">최근 {recordedCount}일</span>
      </div>

      {/* 결과(종속변수) — 기분·하루 만족·습관 이행 */}
      <p className="text-[11px] font-medium text-[var(--fg-muted)]">오늘을 어떻게 살았나 — 결과 지표</p>
      <div className="flex gap-2">
        <MetricTile icon={<Smile size={12} />} label="기분" stat={mood} unit="/10" color="var(--bloom)" decimals={1} />
        <MetricTile icon={<Gauge size={12} />} label="하루 만족" stat={satisfaction} unit="/10" color="var(--leaf)" decimals={1} />
        <MetricTile icon={<ListChecks size={12} />} label="습관 이행" stat={dayScore} unit="점" color="var(--sky)" />
      </div>
      <p className="text-[10px] text-[var(--fg-faint)]">최근 7일 평균 · 화살표는 그 이전 7일과 비교</p>

      {/* 원인 → 결과 인사이트 */}
      {insights.length > 0 ? (
        <div className="space-y-1.5">
          {insights.map((text, i) => (
            <div key={i} className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--leaf-soft)] px-3 py-2">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-[var(--leaf)]" />
              <p className="text-xs leading-snug text-[var(--fg-primary)]">{text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--fg-faint)]">
          수면·에너지가 기분·하루에 주는 영향은 아직 뚜렷하지 않아요. 조금 더 기록해볼까요?
        </p>
      )}

      {/* 원인(독립변수) — 참고용. 상세 분석은 삼성 헬스가 맡는다. */}
      {hasDriverAvg && (
        <div className="space-y-1.5 rounded-[var(--radius-sm)] bg-[var(--sky)]/10 px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--fg-muted)]">
            <span className="flex items-center gap-1"><Moon size={12} className="text-[var(--sky)]" /> 원인 지표</span>
            {sleep.recent !== null && <span className="tabular-nums">수면 {Math.round(sleep.recent)}점</span>}
            {energy.recent !== null && <span className="tabular-nums">에너지 {Math.round(energy.recent)}점</span>}
            {avgDuration !== null && (
              <span className="tabular-nums">평균 {Math.floor(avgDuration)}시간 {Math.round((avgDuration % 1) * 60)}분</span>
            )}
          </div>
          <p className="text-[10px] text-[var(--fg-faint)]">수면·에너지의 상세 분석은 삼성 헬스에 맡기고, 여기선 하루 결과와의 관계만 봐요.</p>
        </div>
      )}
    </section>
  );
}
