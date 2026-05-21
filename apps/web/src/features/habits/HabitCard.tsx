import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HabitDoc, HabitCheckDoc } from 'shared/types/firestore';
import { Flame, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  habit: HabitDoc;
  check?: HabitCheckDoc;
  streak?: number;
  onScore: (score: number | null) => void;
}

const SCORE_LABELS = ['', '매우 부족', '부족', '보통', '양호', '우수'];
const BINARY_LABELS = ['미완료', '완료'];

export default function HabitCard({ habit, check, streak = 0, onScore }: Props) {
  const [expanded, setExpanded] = useState(false);
  const currentScore = check?.score ?? null;
  const achieved = check?.achieved ?? false;

  return (
    <div
      className={cn(
        'card p-3 transition-all',
        achieved && 'border border-[var(--leaf-soft)] bg-[var(--leaf-soft)]/40'
      )}
    >
      {/* 상단 행 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {/* 가중치 뱃지 */}
          <span className="shrink-0 rounded-full bg-[var(--leaf-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--leaf)] tabular-nums">
            W{habit.weight}
          </span>
          <span className="flex-1 text-sm font-medium text-[var(--fg-primary)]">{habit.title}</span>
        </button>

        {/* 스트릭 */}
        {streak > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-[var(--bloom)] tabular-nums">
            <Flame size={13} />
            {streak}
          </span>
        )}

        {/* Pass 버튼 */}
        <button
          onClick={() => onScore(null)}
          className={cn(
            'rounded-full p-1 transition-colors',
            currentScore === null && check !== undefined
              ? 'text-[var(--fg-faint)]'
              : 'text-[var(--fg-faint)] hover:text-[var(--fg-muted)]'
          )}
          title="건너뜀"
        >
          <SkipForward size={14} />
        </button>
      </div>

      {/* 점수 입력 */}
      <div className="mt-2">
        {habit.scoreMode === 'scaled' ? (
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => onScore(s)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all',
                  currentScore === s
                    ? 'bg-[var(--leaf)] text-white scale-110'
                    : currentScore !== null && currentScore > s
                    ? 'bg-[var(--leaf-soft)] text-[var(--leaf)]'
                    : 'bg-[var(--bg-base)] text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)]'
                )}
              >
                {s}
              </button>
            ))}
            {currentScore !== null && (
              <span className="ml-1 self-center text-xs text-[var(--fg-muted)]">
                {SCORE_LABELS[currentScore]}
              </span>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            {[0, 1].map((s) => (
              <button
                key={s}
                onClick={() => onScore(s)}
                className={cn(
                  'flex-1 rounded-[var(--radius-sm)] py-1.5 text-sm font-medium transition-colors',
                  currentScore === s
                    ? s === 1
                      ? 'bg-[var(--leaf)] text-white'
                      : 'bg-[var(--wither)] text-[var(--fg-muted)]'
                    : 'bg-[var(--bg-base)] text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)]'
                )}
              >
                {BINARY_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 설명 (접기/펼치기) */}
      <AnimatePresence>
        {expanded && habit.description && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 overflow-hidden text-xs text-[var(--fg-muted)]"
          >
            {habit.description}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
