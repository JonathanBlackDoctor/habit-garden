import { motion } from 'framer-motion';
import { Sunrise, TrendingUp, TrendingDown, Heart, AlertTriangle, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHealthForecast } from '@/features/garden/useHealthForecast';

/** 예보 생기 값에 대한 톤·라벨 — Garden.tsx healthVibe 와 같은 임계(≤30 / ≤70 / else). */
function vibeOf(h: number): { label: string; bar: string } {
  if (h <= 30) return { label: '정원이 시들고 있어요', bar: 'bg-[#D9544A]' };
  if (h <= 70) return { label: '생기를 회복하세요', bar: 'bg-[#E8B544]' };
  return { label: '활기찬 정원', bar: 'bg-[var(--leaf)]' };
}

/** 요약 통계 칩 (DailyGardenRecapCard 와 동일 패턴). */
function StatChip({ icon, label, tone }: { icon?: React.ReactNode; label: string; tone: string }) {
  return (
    <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums', tone)}>
      {icon}
      {label}
    </span>
  );
}

/**
 * 내일 정원 예보 — "어젯밤 정원 소식"(DailyGardenRecapCard)의 거울상.
 * 오늘 습관을 체크/해제할 때마다, 내일 04:00 정산에서 생기가 어떻게 바뀔지 실시간으로 미리 보여 준다.
 *
 *  - 활성 습관이 없으면 노출하지 않는다(null).
 *  - 오늘 아직 기록이 없으면 겁주지 않고 '기록 전' 중립 상태로 안내한다.
 *  - 기록이 시작되면 생기 델타·성공까지 남은 습관·시들기 경고를 차분히 보여 준다.
 */
export default function ForecastCard() {
  const f = useHealthForecast();
  if (!f || f.noHabits) return null;

  const positive = f.delta > 0;
  const vibe = vibeOf(f.projected);

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative space-y-2.5 rounded-[var(--radius)] border border-[var(--leaf)]/25 bg-[var(--bg-surface)] p-3.5 shadow-[var(--shadow-sm)]"
    >
      {/* 헤더 */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--leaf-strong,var(--leaf))]">
        <Sunrise size={14} /> 내일 정원 예보
      </div>

      {!f.hasAnyCheck ? (
        /* 기록 전 — 중립 안내 (실패 페널티로 겁주지 않음) */
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
          <Sprout size={12} className="text-[var(--leaf)]" />
          오늘 첫 기록을 하면 내일 생기 예보가 시작돼요. (지금 생기 {f.current})
        </p>
      ) : (
        <>
          {/* 핵심 한 줄 — 오늘 이대로면 내일 생기 X→Y (±d) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[var(--fg-muted)]">오늘 이대로면 내일</span>
            <StatChip
              icon={positive ? <TrendingUp size={11} /> : f.delta < 0 ? <TrendingDown size={11} /> : <Heart size={11} />}
              tone={
                positive
                  ? 'bg-[var(--leaf-soft)] text-[var(--leaf-strong,var(--leaf))]'
                  : f.delta < 0
                    ? 'bg-[var(--wither)]/15 text-[var(--wither)]'
                    : 'bg-[var(--leaf-soft)]/50 text-[var(--fg-muted)]'
              }
              label={`생기 ${f.current}→${f.projected} (${f.delta > 0 ? '+' : ''}${f.delta})`}
            />
          </div>

          {/* 예보 생기 바 — 현재값 위치를 눈금으로, 예보값까지 채움 */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-[var(--fg-muted)]">{vibe.label}</span>
              <span className="tabular-nums text-[var(--fg-muted)]">{f.projected}%</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--leaf-soft)]">
              <motion.div
                className={cn('h-full rounded-full', vibe.bar)}
                initial={{ width: 0 }}
                animate={{ width: `${f.projected}%` }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
              {/* 현재 생기 눈금 */}
              <div
                className="absolute top-0 h-full w-[2px] bg-[var(--fg-primary)]/40"
                style={{ left: `calc(${f.current}% - 1px)` }}
                aria-hidden
              />
            </div>
          </div>

          {/* 걸린 것 — 성공까지 N개 더 (실패 -10 → 성공 +3 으로 뒤집히는 큰 차이 강조) */}
          {!f.daySuccess && !f.intoWitheringZone && f.flipsToSuccessNeeded > 0 && (
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--leaf-strong,var(--leaf))]">
              <TrendingUp size={12} />
              {f.flipsToSuccessNeeded}개 더 달성하면 오늘을 성공으로 마쳐 내일 생기가 올라요!
            </p>
          )}

          {/* 시들기 경고 */}
          {f.intoWitheringZone && (
            <p className="flex items-center gap-1.5 rounded-[10px] bg-[var(--wither)]/10 px-2 py-1.5 text-[11px] text-[var(--wither)]">
              <AlertTriangle size={12} className="shrink-0" />
              이대로면 생기가 50 이하로 떨어져 식물이 시들 수 있어요.
              {!f.daySuccess && f.flipsToSuccessNeeded > 0 && ` ${f.flipsToSuccessNeeded}개만 더 달성해요!`}
            </p>
          )}

          {/* 보호된 날 안내 */}
          {f.successDelta === 0 && !f.daySuccess && (
            <p className="text-[10px] text-[var(--fg-faint)]">
              ※ 보호된 날이라 실패 페널티가 없어요.
            </p>
          )}
        </>
      )}
    </motion.section>
  );
}
