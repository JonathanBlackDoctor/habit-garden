import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HabitDoc, HabitCheckDoc } from 'shared/types/firestore';
import { Flame, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSaveReflection } from '@/features/habits/useReflections';
import { useHabitHistory } from '@/features/habits/useHabitHistory';

interface Props {
  habit: HabitDoc;
  check?: HabitCheckDoc;
  streak?: number;
  onScore: (score: number | null) => void;
}

const SCORE_LABELS = ['', '매우 부족', '부족', '보통', '양호', '우수'];
const BINARY_LABELS = ['미완료', '완료'];
const MOOD_EMOJIS = ['😣', '😕', '😐', '🙂', '😄'] as const;
const REFLECTION_DISMISS_MS = 6000;

export default function HabitCard({ habit, check, streak = 0, onScore }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [note, setNote] = useState('');
  const saveReflection = useSaveReflection();
  const lastCheckedRef = useRef<number | null>(null);
  const currentScore = check?.score ?? null;
  const achieved = check?.achieved ?? false;

  // 체크 직후 6초 동안 슬라이드업 회고 입력 노출
  useEffect(() => {
    if (currentScore === null) return;
    const ts = check?.checkedAt
      ? (typeof check.checkedAt.toMillis === 'function' ? check.checkedAt.toMillis() : 0)
      : Date.now();
    if (lastCheckedRef.current === ts) return;
    lastCheckedRef.current = ts;
    // 이미 mood 가 저장돼 있으면 노출 안 함
    if (check?.mood) return;
    setShowReflection(true);
    setMood(null);
    setNote('');
    const t = setTimeout(() => setShowReflection(false), REFLECTION_DISMISS_MS);
    return () => clearTimeout(t);
  }, [currentScore, check?.checkedAt, check?.mood]);

  const submitReflection = async () => {
    if (mood === null && !note.trim()) {
      setShowReflection(false);
      return;
    }
    await saveReflection(habit.id, { mood: mood ?? 3, note: note.trim() || undefined });
    setShowReflection(false);
  };

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

      {/* 설명 + 30일 캘린더 (접기/펼치기) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 overflow-hidden space-y-2"
          >
            {habit.description && (
              <p className="text-xs text-[var(--fg-muted)]">{habit.description}</p>
            )}
            <HabitStreakCalendar habitId={habit.id} threshold={habit.achieveThreshold} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 데일리 한 줄 회고 (Phase 2-4) */}
      <AnimatePresence>
        {showReflection && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 overflow-hidden"
          >
            <div className="rounded-[var(--radius-sm)] bg-[var(--bg-base)] p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--fg-muted)]">오늘 이 습관, 어땠어?</span>
                <button
                  onClick={() => setShowReflection(false)}
                  className="text-[10px] text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"
                >
                  나중에
                </button>
              </div>
              <div className="flex gap-1.5">
                {MOOD_EMOJIS.map((emoji, i) => {
                  const m = (i + 1) as 1 | 2 | 3 | 4 | 5;
                  return (
                    <button
                      key={emoji}
                      onClick={() => setMood(m)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-base transition-all',
                        mood === m
                          ? 'bg-[var(--leaf-soft)] scale-110'
                          : 'hover:bg-[var(--leaf-soft)]/50',
                      )}
                    >
                      {emoji}
                    </button>
                  );
                })}
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="한 줄 메모 (선택)"
                  className="ml-1 flex-1 rounded-[var(--radius-sm)] border border-transparent bg-white px-2 py-1 text-xs placeholder:text-[var(--fg-faint)] focus:border-[var(--leaf)] focus:outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') submitReflection(); }}
                  maxLength={80}
                />
                <button
                  onClick={submitReflection}
                  disabled={mood === null && !note.trim()}
                  className="rounded-[var(--radius-sm)] bg-[var(--leaf)] px-2 py-1 text-xs font-medium text-white disabled:opacity-30"
                >
                  저장
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HabitStreakCalendar({ habitId, threshold }: { habitId: string; threshold: number }) {
  const { dates, history } = useHabitHistory(habitId, 30);
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] text-[var(--fg-faint)]">
        <span>최근 30일</span>
        <span>오늘</span>
      </div>
      <div className="flex flex-wrap gap-[3px]">
        {dates.map((d) => {
          const c = history[d];
          let bg = 'var(--leaf-soft)';
          let title = `${d} · 미체크`;
          if (c) {
            if (c.score === null) { bg = '#D7D2C0'; title = `${d} · 패스`; }
            else if (c.score >= threshold) {
              const ratio = Math.min(c.score / 5, 1);
              const intensity = Math.round(80 + ratio * 80);
              bg = c.score === 5 ? '#3F6228' : `rgb(${120 - ratio * 50}, ${168 - ratio * 40}, ${intensity})`;
              title = `${d} · ${c.score}점`;
            } else {
              bg = '#E5C3B0';
              title = `${d} · ${c.score}점 (미달)`;
            }
          }
          return (
            <div
              key={d}
              title={title}
              className="h-3 w-3 rounded-[2px]"
              style={{ background: bg }}
            />
          );
        })}
      </div>
    </div>
  );
}
