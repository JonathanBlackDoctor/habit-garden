import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HabitDoc, HabitCheckDoc } from 'shared/types/firestore';
import { cn } from '@/lib/utils';
import { useSaveReflection, useSaveMissReason } from '@/features/habits/useReflections';
import { useHabitHistory } from '@/features/habits/useHabitHistory';
import { statusOf } from '@/features/habits/habitStatus';
import { SCALED_ACHIEVE_THRESHOLD } from 'shared/lib/habitPoints';
import { StatusCircle } from '@/components/Editorial';

const QUICK_TAGS = ['피곤', '스트레스', '바쁨', '약속', '여행', '회복'] as const;

interface Props {
  habit: HabitDoc;
  check?: HabitCheckDoc;
  streak?: number;
  /** 현재 시간대 그룹인지 — 지금은 그룹 카드가 강조를 맡아 행에서는 쓰지 않는다 */
  isNow?: boolean;
  onScore: (score: number | null) => void;
  onClear: () => void;
}

const SCORE_LABELS = ['', '매우 부족', '부족', '보통', '양호', '우수'];
const BINARY_LABELS = ['미완료', '완료'];
const MOOD_LABELS = ['', '많이 힘듦', '힘듦', '보통', '좋음', '아주 좋음'];
export default function HabitCard({ habit, check, streak = 0, onScore, onClear }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const saveReflection = useSaveReflection();
  const saveMissReason = useSaveMissReason();
  const lastCheckedRef = useRef<number | null>(null);
  const currentScore = check?.score ?? null;
  const achieved = check?.achieved ?? false;
  // 의도적 건너뛰기: 체크 문서는 있으나 점수가 null (미기록과 구분)
  const skipped = currentScore === null && check !== undefined;
  // 미달성(점수 입력했지만 임계 미만) → 원인 추적 모드
  const missed = currentScore !== null && currentScore !== undefined && !achieved;
  // 카드 상태 — 스타일 분기용
  const status = statusOf(check);
  // 점수는 입력됐지만 아직 회고를 저장하지 않은 상태
  const canReflect = currentScore !== null && !check?.mood && !check?.whyMissed;
  // 부제 — 걷어낸 '중요도 N' 뱃지 자리를 대신한다 ("5단계 · 12일 연속")
  const subtitle = [
    habit.scoreMode === 'scaled' ? '5단계' : '완료 여부',
    streak > 0 ? `${streak}일 연속` : null,
  ].filter(Boolean).join(' · ');
  const quickCircleLabel = habit.scoreMode === 'scaled'
    ? '점수 선택'
    : status === 'todo'
      ? '완료'
      : status === 'achieved'
        ? '미완료'
        : '기록 취소';

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
    <div
      className={cn(
        'relative py-[12.5px] transition-opacity',
        status === 'missed' && 'opacity-80',
      )}
    >
      {/* 상단 행 — 제목 + 부제(입력 방식 · 연속 일수) */}
      <div className="flex items-center gap-[13px]">
        <StatusCircle
          checked={status === 'achieved'}
          skipped={status === 'skipped'}
          missed={habit.scoreMode === 'binary' && status === 'missed'}
          score={habit.scoreMode === 'scaled' && currentScore !== null ? currentScore : undefined}
          label={`${habit.title} ${quickCircleLabel}`}
          onClick={() => {
            if (habit.scoreMode === 'scaled') {
              setExpanded((v) => !v);
            } else if (status === 'todo') {
              onScore(1);
            } else if (status === 'achieved') {
              onScore(0);
            } else {
              // 미완료(×) 또는 기존 건너뜀 기록은 미입력(○)으로 되돌린다.
              onClear();
            }
          }}
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 flex-col gap-[3px] text-left"
        >
          <span className={cn(
            'min-w-0 truncate text-[15.5px] tracking-[-0.018em] text-[var(--fg-primary)]',
            status === 'achieved' && 'text-[var(--fg-faint)]',
            status === 'skipped' && 'text-[var(--fg-faint)] line-through decoration-[var(--fg-faint)]'
          )}>{habit.title}</span>
          <span className="truncate text-[12px] text-[var(--fg-faint)]">{subtitle}</span>
        </button>
        <span className="meta-copy tabular-nums">
          {skipped ? '건너뜀' : habit.scoreMode === 'scaled' && currentScore === null ? '1–5' : ''}
        </span>
      </div>

      {/* 스트릭 위험 경고 — 미기록 + 진행 중 스트릭 */}
      {status === 'todo' && streak >= 2 && (
        <p className="mt-2 text-[12px] text-[var(--bloom)]">
          {streak}일 연속 — 오늘 지키면 이어져요
        </p>
      )}

      {/* 점수 입력 — 5단계는 원형 숫자, 완료 여부는 알약 버튼 */}
      {expanded && <div className="mt-2.5 pl-8">
        {habit.scoreMode === 'scaled' ? (
          <div className="flex items-center gap-[7px]">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => onScore(s)}
                aria-label={`${s}점 · ${SCORE_LABELS[s]}`}
                className={cn(
                  'grid h-9 flex-1 place-items-center rounded-[9px] border text-[13.5px] transition-colors',
                  currentScore === s
                    ? 'border-[var(--fg-primary)] bg-[var(--fg-primary)] font-semibold text-[var(--bg-base)]'
                    : 'border-[var(--divider-soft)] bg-[var(--bg-surface)] text-[var(--fg-muted)] hover:border-[var(--border)]'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[1, 0].map((s) => (
              <button
                key={s}
                onClick={() => onScore(s)}
                className={cn(
                  'rounded-[9px] border px-3 py-2 text-[13px] transition-colors',
                  currentScore === s
                    ? s === 1
                      ? 'border-[var(--leaf)] bg-[var(--leaf)] text-white'
                      : 'border-[var(--border)] bg-[var(--bg-base)] text-[var(--fg-muted)]'
                    : 'border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)]'
                )}
              >
                {BINARY_LABELS[s]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => (skipped ? onClear() : onScore(null))}
              className={cn('rounded-[9px] border px-3 py-2 text-[13px]', skipped ? 'border-[var(--fg-primary)] bg-[var(--fg-primary)] text-[var(--bg-base)]' : 'border-[var(--border)] text-[var(--fg-muted)]')}
            >
              건너뜀
            </button>
          </div>
        )}
      </div>}

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
          className="mt-2 w-full text-left text-[12px] text-[var(--fg-faint)] transition-colors hover:text-[var(--fg-muted)]"
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
            <div className="rounded-[var(--radius)] bg-[var(--bg-base)] p-3 space-y-2.5">
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
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((i) => {
                  const m = i as 1 | 2 | 3 | 4 | 5;
                  return (
                    <button
                      key={m}
                      onClick={() => setMood(m)}
                      aria-label={`기분 ${m}점 · ${MOOD_LABELS[m]}`}
                      title={MOOD_LABELS[m]}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition-colors',
                        mood === m
                          ? 'bg-[var(--leaf)] font-semibold text-white'
                          : 'bg-[var(--bg-surface)] text-[var(--fg-faint)] hover:bg-[var(--leaf-soft)]',
                      )}
                    >
                      {m}
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
          // 7일 리듬 그래프와 같은 3단 초록(leaf-soft → leaf-mid → leaf)으로 통일
          let bg = 'var(--leaf-soft)';
          let title = `${d} · 미체크`;
          if (c) {
            if (c.score === null) { bg = 'var(--wither)'; title = `${d} · 건너뜀`; }
            else if (c.score >= threshold) {
              bg = c.score === 5 ? 'var(--leaf)' : 'var(--leaf-mid)';
              title = `${d} · ${c.score}점`;
            } else {
              bg = 'var(--bloom-soft)';
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