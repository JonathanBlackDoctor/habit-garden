import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Lightbulb, Sunrise, X } from 'lucide-react';
import { formatKoreanDate } from '@/lib/dayBoundary';
import type { HabitDoc } from 'shared/types/firestore';
import HabitStatusDot from '@/features/habits/HabitStatusDot';
import { useYesterdayRecap } from './useYesterdayRecap';

const MAX_MISSED_ROWS = 3;
const MAX_UNRECORDED_CHIPS = 4;

/**
 * 어제 돌아보기 카드 — 어제 미달성 습관과 오늘의 개선 포인트를
 * 다음날 메인 상단에서 한눈에 보여준다. X 로 닫으면 그날은 다시 안 뜬다.
 */
export default function YesterdayRecapCard({ habits }: { habits: HabitDoc[] }) {
  const navigate = useNavigate();
  const { recap, dayScore, penalty, yesterday, visible, dismiss } = useYesterdayRecap(habits);

  if (!visible || !recap) return null;

  // 모두 달성 — 짧은 칭찬만 (개선 잔소리 없음)
  if (recap.allDone) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex items-center gap-3 rounded-[var(--radius)] border border-[var(--leaf)]/30 bg-[var(--leaf-soft)] p-3"
      >
        <Sunrise size={18} className="shrink-0 text-[var(--leaf)]" />
        <div className="flex-1 text-xs leading-snug text-[var(--fg-primary)]">
          <p className="font-semibold text-[var(--leaf)]">
            어제({formatKoreanDate(yesterday)}) {recap.achieved}개 모두 달성!
          </p>
          <p>완벽한 하루였어요. 오늘도 그대로 이어가요 🔥</p>
        </div>
        <button
          onClick={dismiss}
          aria-label="닫기"
          className="-mt-1 -mr-1 self-start rounded-full p-1 text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"
        >
          <X size={14} />
        </button>
      </motion.div>
    );
  }

  const missedShown = recap.missed.slice(0, MAX_MISSED_ROWS);
  const missedMore = recap.missed.length - missedShown.length;
  const chipsShown = recap.unrecorded.slice(0, MAX_UNRECORDED_CHIPS);
  const chipsMore = recap.unrecorded.length - chipsShown.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative space-y-2 rounded-[var(--radius)] border border-[var(--bloom)]/25 bg-[var(--bg-surface)] p-3.5 shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--bloom)]">
          <Sunrise size={14} /> 어제 돌아보기 · {formatKoreanDate(yesterday)}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] tabular-nums text-[var(--fg-muted)]">
            {recap.achieved}/{recap.intended} 달성
            {dayScore !== undefined && ` · ${dayScore}점`}
          </span>
          <button
            onClick={dismiss}
            aria-label="닫기"
            className="-mr-1 rounded-full p-1 text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 시도했지만 미달 — 원인(whyMissed)까지 한 줄로 */}
      {missedShown.length > 0 && (
        <div className="space-y-1">
          {missedShown.map(({ habit, score, whyMissed }) => (
            <div key={habit.id} className="flex items-center gap-2 text-xs">
              <HabitStatusDot status="missed" size={12} />
              <span className="shrink-0 font-medium text-[var(--fg-primary)]">{habit.title}</span>
              <span className="shrink-0 tabular-nums text-[var(--fg-faint)]">
                {habit.scoreMode === 'scaled' ? `${score}/5` : '미완료'}
              </span>
              {whyMissed && (
                <span className="truncate text-[var(--fg-muted)]">— {whyMissed}</span>
              )}
            </div>
          ))}
          {missedMore > 0 && (
            <p className="pl-5 text-[11px] text-[var(--fg-faint)]">+{missedMore}개 더 미달</p>
          )}
        </div>
      )}

      {/* 체크 자체를 안 한 습관 */}
      {chipsShown.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-[var(--fg-muted)]">미기록</span>
          {chipsShown.map((h) => (
            <span
              key={h.id}
              className="rounded-full border border-dashed border-[var(--fg-faint)]/60 px-2 py-0.5 text-[11px] text-[var(--fg-muted)]"
            >
              {h.title}
            </span>
          ))}
          {chipsMore > 0 && (
            <span className="text-[11px] text-[var(--fg-faint)]">+{chipsMore}</span>
          )}
        </div>
      )}

      {/* 미완료 패널티 — 어제 못 한 습관만큼 차감된 결과 */}
      {penalty && (
        <div className="flex items-center gap-1.5 rounded-md bg-[var(--wither)]/15 px-2.5 py-1.5 text-[11px] text-[var(--fg-muted)]">
          <span className="text-[var(--wither)]">▾</span>
          <span>
            미완료 패널티
            {penalty.points > 0 && <b className="text-[var(--fg-primary)]"> −{penalty.points}P</b>}
            {penalty.healthLoss > 0 && <span> · 생기 −{penalty.healthLoss}</span>}
            {penalty.count > 0 && <span className="text-[var(--fg-faint)]"> ({penalty.count}개)</span>}
          </span>
        </div>
      )}

      {/* 오늘의 개선 포인트 — 가중치가 가장 높은 놓친 습관 하나만 짚는다 */}
      {recap.focus && (
        <div className="flex items-start gap-1.5 rounded-md bg-[var(--bloom-soft)] px-2.5 py-2 text-xs text-[var(--fg-primary)]">
          <Lightbulb size={13} className="mt-0.5 shrink-0 text-[var(--bloom)]" />
          <p className="leading-snug">
            오늘은 <b className="text-[var(--bloom)]">{recap.focus.title}</b>부터 챙겨보세요 —
            어제 놓친 것 중 가장 중요한 습관이에요.
          </p>
        </div>
      )}

      <button
        onClick={() => navigate(`/day/${yesterday}`)}
        className="flex items-center gap-1 text-xs text-[var(--leaf)]"
      >
        어제 기록 보완하기 <ArrowRight size={13} />
      </button>
    </motion.section>
  );
}
