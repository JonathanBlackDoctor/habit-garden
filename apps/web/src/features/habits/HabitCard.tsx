import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HabitDoc, HabitCheckDoc } from 'shared/types/firestore';
import { Flame, SkipForward, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSaveReflection, useSaveMissReason } from '@/features/habits/useReflections';
import { useHabitHistory } from '@/features/habits/useHabitHistory';
import { statusOf } from '@/features/habits/habitStatus';
import { SCALED_ACHIEVE_THRESHOLD } from 'shared/lib/habitPoints';

const QUICK_TAGS = ['피곤', '스트레스', '바쁨', '약속', '여행', '회복'] as const;

interface Props {
  habit: HabitDoc;
  check?: HabitCheckDoc;
  streak?: number;
  isNow?: boolean;
  onScore: (score: number | null) => void;
  onClear: () => void;
}

const SCORE_LABELS = ['', '매우 부족', '부족', '보통', '양호', '우수'];
const BINARY_LABELS = ['미완료', '완료'];
const MOOD_EMOJIS = ['😣', '😕', '😐', '🙂', '😄'] as const;
export default function HabitCard({ habit, check, streak = 0, isNow = false, onScore, onClear }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [reward, setReward] = useState(false);
  const saveReflection = useSaveReflection();
  const saveMissReason = useSaveMissReason();
  const lastCheckedRef = useRef<number | null>(null);
  const prevAchievedRef = useRef(check?.achieved ?? false);
  const currentScore = check?.score ?? null;
  const achieved = check?.achieved ?? false;
  // 의도적 건너뛰기: 체크 문서는 있으나 점수가 null (미기록과 구분)
  const skipped = currentScore === null && check !== undefined;
  // 미달성(점수 입력했지만 임계 미만) → 원인 추적 모드
  const missed = currentScore !== null && currentScore !== undefined && !achieved;
  // 아직 손대지 않음 (체크 문서 없음) → 강조 대상
  const todo = check === undefined;
  // 카드 상태 — 스타일 분기용
  const status = statusOf(check);
  // 점수는 입력됐지만 아직 회고를 저장하지 않은 상태
  const canReflect = currentScore !== null && !check?.mood && !check?.whyMissed;

  // 미기록 → 달성 전이 시 1회성 마이크로 보상 애니메이션
  useEffect(() => {
    if (achieved && !prevAchievedRef.current) {
      setReward(true);
      const t = setTimeout(() => setReward(false), 700);
      prevAchievedRef.current = achieved;
      return () => clearTimeout(t);
    }
    prevAchievedRef.current = achieved;
  }, [achieved]);

  // 점수가 새로 변경되면 폼 초기화 (자동 오픈 없음)
  useEffect(() => {
    if (currentScore === null) return;
    const ts = check?.checkedAt
      ? (typeof check.checkedAt.toMillis === 'function' ? check.checkedAt.toMillis() : 0)
      : Date.now();
    if (lastCheckedRef.current === ts) return;
    lastCheckedRef.current = ts;
    setShowReflection(false);
    setMood(null);
    setNote('');
    setTags([]);
  }, [currentScore, check?.checkedAt]);

  const submitReflection = async () => {
    if (mood === null && !note.trim() && tags.length === 0) {
      setShowReflection(false);
      return;
    }
    if (missed) {
      // 미달성 — 원인·태그 추적
      await saveMissReason(habit.id, {
        whyMissed: note.trim() || undefined,
        tags: tags.length ? tags : undefined,
        mood: mood ?? undefined,
      });
    } else {
      await saveReflection(habit.id, { mood: mood ?? 3, note: note.trim() || undefined });
    }
    setShowReflection(false);
  };

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <motion.div
      animate={{ scale: status === 'achieved' || status === 'skipped' ? 0.97 : 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={cn(
        'relative card px-3 py-2 transition-all',
        status === 'todo' &&
          'border-l-4 border-[var(--leaf)] shadow-[var(--shadow-sm)]',
        status === 'todo' && isNow && 'ring-1 ring-[var(--leaf)]/40',
        // 미기록이 아닌(처리된) 카드는 덜 중요 → 흐리게.
        // 미달성(missed)은 회고·원인 입력 UI 가독성을 위해 덜 흐리게 유지
        status === 'missed' && 'opacity-60',
        (status === 'achieved' || status === 'skipped') && 'opacity-50',
        status === 'achieved' && 'border border-[var(--leaf-soft)] bg-[var(--leaf-soft)]/40',
        status === 'skipped' && 'bg-[var(--bg-base)]/60'
      )}
    >
      {/* 마이크로 보상 — 달성 순간 1회성 필 + 스파클 */}
      <AnimatePresence>
        {reward && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-[var(--radius)]"
          >
            <motion.div
              initial={{ x: '-110%' }}
              animate={{ x: '110%' }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-[var(--leaf-soft)] to-transparent"
            />
            <motion.span
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: [0, 1.3, 1], rotate: 0 }}
              transition={{ duration: 0.5 }}
              className="text-2xl"
            >
              ✓
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 상단 행 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {/* 미기록 표식 — '할 차례' */}
          {todo && (
            <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-[var(--leaf)]" aria-label="할 차례" />
          )}
          {/* 가중치 뱃지 */}
          <span className="shrink-0 rounded-full bg-[var(--leaf-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--leaf)] tabular-nums">
            W{habit.weight}
          </span>
          <span className={cn(
            'flex-1 text-sm font-medium text-[var(--fg-primary)]',
            (status === 'achieved' || status === 'skipped') && 'line-through decoration-[var(--fg-faint)]'
          )}>{habit.title}</span>
        </button>

        {/* 건너뜀 뱃지 — 클릭 시 취소 */}
        {skipped && (
          <button
            onClick={onClear}
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--bg-base)] px-2 py-0.5 text-[10px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
            title="건너뜀 취소"
          >
            건너뜀
            <X size={11} />
          </button>
        )}

        {/* 스트릭 */}
        {streak > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-[var(--bloom)] tabular-nums">
            <Flame size={13} />
            {streak}
          </span>
        )}

        {/* Pass / 건너뜀 취소 토글 */}
        <button
          onClick={() => (skipped ? onClear() : onScore(null))}
          className={cn(
            'rounded-full p-1 transition-colors',
            skipped
              ? 'bg-[var(--bg-base)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]'
              : 'text-[var(--fg-faint)] hover:text-[var(--fg-muted)]'
          )}
          title={skipped ? '건너뜀 취소' : '건너뜀'}
        >
          <SkipForward size={14} />
        </button>
      </div>

      {/* 스트릭 위험 경고 — 미기록 + 진행 중 스트릭 */}
      {status === 'todo' && streak >= 2 && (
        <div className="mt-1 flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--bloom)]/10 px-2 py-1 text-[11px] font-medium text-[var(--bloom)]">
          <Flame size={12} />
          {streak}일 연속 — 오늘 지키면 이어져요
        </div>
      )}

      {/* 점수 입력 */}
      <div className="mt-1.5">
        {habit.scoreMode === 'scaled' ? (
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => onScore(s)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-all',
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
                  'flex-1 rounded-[var(--radius-sm)] py-1 text-sm font-medium transition-colors',
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
            className="mt-1.5 overflow-hidden space-y-2"
          >
            {habit.description && (
              <p className="text-xs text-[var(--fg-muted)]">{habit.description}</p>
            )}
            <HabitStreakCalendar habitId={habit.id} threshold={habit.scoreMode === 'scaled' ? SCALED_ACHIEVE_THRESHOLD : habit.achieveThreshold} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 데일리 한 줄 회고 — 접힌 토글 or 펼쳐진 패널 */}
      {canReflect && !showReflection && (
        <button
          onClick={() => setShowReflection(true)}
          className="mt-1 w-full text-left text-[10px] text-[var(--fg-faint)] hover:text-[var(--fg-muted)] transition-colors"
        >
          {missed ? '왜 못 했을까? 짧게 남기기 ▾' : '오늘 이 습관 평가 남기기 ▾'}
        </button>
      )}
      <AnimatePresence>
        {showReflection && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-1.5 overflow-hidden"
          >
            <div className="rounded-[var(--radius-sm)] bg-[var(--bg-base)] p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--fg-muted)]">
                  {missed ? '왜 못 했을까? 다음을 위해 짧게 남겨봐' : '오늘 이 습관, 어땠어?'}
                </span>
                <button
                  onClick={() => setShowReflection(false)}
                  className="text-[10px] text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"
                >
                  나중에
                </button>
              </div>
              <div className="flex justify-between">
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
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={missed ? '원인 (예: 늦잠, 약속, 피곤)' : '한 줄 메모 (선택)'}
                  className="flex-1 rounded-[var(--radius-sm)] border border-transparent bg-white px-2 py-1 text-xs placeholder:text-[var(--fg-faint)] focus:border-[var(--leaf)] focus:outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') submitReflection(); }}
                  maxLength={80}
                />
                <button
                  onClick={submitReflection}
                  disabled={mood === null && !note.trim() && tags.length === 0}
                  className="rounded-[var(--radius-sm)] bg-[var(--leaf)] px-2 py-1 text-xs font-medium text-white disabled:opacity-30"
                >
                  저장
                </button>
              </div>
              {/* 빠른 태그 칩 — 미달성 원인 분류용 */}
              {missed && (
                <div className="flex flex-wrap gap-1">
                  {QUICK_TAGS.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] transition-colors',
                        tags.includes(t)
                          ? 'bg-[var(--leaf)] text-white'
                          : 'bg-white text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)]',
                      )}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
            if (c.score === null) { bg = '#D7D2C0'; title = `${d} · 건너뜀`; }
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
