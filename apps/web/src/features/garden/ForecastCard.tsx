import { motion } from 'framer-motion';
import { Sunrise, TrendingUp, TrendingDown, Heart, AlertTriangle, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHealthForecast } from '@/features/garden/useHealthForecast';
import { HEALTH_RULES } from 'shared/lib/healthForecast';

// 오늘 하루를 실패→성공으로 바꿀 때 갈리는 생기 폭(= 성공 보상 − 실패 델타). '하루의 무게'를 한 숫자로 보여준다.
const DAY_SWING = HEALTH_RULES.SUCCESS_DELTA - HEALTH_RULES.FAILURE_DELTA;

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

          {/* 걸린 것 — 성공까지 N개 더 (실패 → 성공 으로 뒤집히는 큰 차이를 한 숫자로 강조) */}
          {!f.daySuccess && !f.intoWitheringZone && f.flipsToSuccessNeeded > 0 && (
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--leaf-strong,var(--leaf))]">
              <TrendingUp size={12} />
              {f.flipsToSuccessNeeded}개 더 달성하면 오늘이 실패(−{-HEALTH_RULES.FAILURE_DELTA})에서 성공(+{HEALTH_RULES.SUCCESS_DELTA})으로 — 내일 생기가 {DAY_SWING} 갈려요!
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
