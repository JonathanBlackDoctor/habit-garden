import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ArrowRight, CheckCircle2, ChevronDown, Lightbulb, Sunrise, Target, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { formatKoreanDate } from '@/lib/dayBoundary';
import { feedback } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { HabitDoc, MorningBrief } from 'shared/types/firestore';
import HabitStatusDot from '@/features/habits/HabitStatusDot';
import { useYesterdayRecap } from './useYesterdayRecap';

const MAX_MISSED_ROWS = 3;
const MAX_UNRECORDED_CHIPS = 4;

/**
 * 아침 브리핑 — 하나의 카드를 '오늘'과 '어제 돌아보기' 두 단으로 나눠 보여준다.
 *
 *  ┌ 오늘 ──────────────────────────────────────────
 *  │ · 서버가 만든 모닝 브리프(AI 한 줄)
 *  │ · 어제 회고의 '내일의 다짐(q_tomorrow)' — 실천 체크로 피드백을 행동으로
 *  │ · 오늘 핵심 습관(가중치 상위) · 오늘 먼저 챙길 포인트(focus)
 *  ├ 어제 돌아보기 (기본 접힘) ─────────────────────
 *  │ · 어제 달성도 요약 한 줄 → 펼치면 미달·미기록·패널티 상세
 *  └────────────────────────────────────────────────
 *
 * '오늘'은 행동을 유도하므로 항상 펼쳐 두고, '어제'는 회고 성격이라 기본 접어
 * 메인 상단의 시선 부담을 줄인다. X 로 닫으면 그날은 다시 뜨지 않는다.
 */
export default function MorningBriefingCard({
  habits,
  morningBrief,
  resolutionPracticed,
}: {
  habits: HabitDoc[];
  morningBrief?: MorningBrief;
  resolutionPracticed?: boolean;
}) {
  const navigate = useNavigate();
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const { recap, dayScore, penalty, yesterday, resolution, visible, dismiss } = useYesterdayRecap(habits);

  // 어제의 다짐 실천 체크 — 오늘 DayDoc.resolutionPracticed 에 저장
  const [practiced, setPracticed] = useState(false);
  useEffect(() => { setPracticed(!!resolutionPracticed); }, [resolutionPracticed]);

  // '어제 돌아보기' 펼침 — 기본 접힘
  const [recapOpen, setRecapOpen] = useState(false);

  const togglePracticed = async () => {
    const next = !practiced;
    setPracticed(next);
    if (next) feedback('achieve');
    if (!uid) return;
    await setDoc(
      doc(db, 'users', uid, 'days', today),
      { resolutionPracticed: next, updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  if (!visible) return null;

  const allDone = recap?.allDone ?? false;
  const missedShown = recap?.missed.slice(0, MAX_MISSED_ROWS) ?? [];
  const missedMore = (recap?.missed.length ?? 0) - missedShown.length;
  const chipsShown = recap?.unrecorded.slice(0, MAX_UNRECORDED_CHIPS) ?? [];
  const chipsMore = (recap?.unrecorded.length ?? 0) - chipsShown.length;
  const priorityHabits = morningBrief?.priorityHabits ?? [];

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-[var(--radius)] border border-[var(--bloom)]/25 bg-[var(--bg-surface)] p-3.5 shadow-[var(--shadow-sm)]"
    >
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--bloom)]">
          <Sunrise size={14} /> 아침 브리핑 · {formatKoreanDate(today)}
        </div>
        <button
          onClick={dismiss}
          aria-label="닫기"
          className="-mr-1 rounded-full p-1 text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"
        >
          <X size={14} />
        </button>
      </div>

      {/* ════ 오늘 ════ */}
      <div className="mt-2.5 space-y-2.5">
        {/* 모닝 브리프 — 서버가 만든 AI 한 줄 */}
        {morningBrief?.message && (
          <p className="text-sm leading-snug text-[var(--fg-primary)]">{morningBrief.message}</p>
        )}

        {/* 어제의 다짐 — 전날 피드백을 오늘 실천으로 이어주는 핵심 장치 */}
        {resolution && (
          <div
            className={cn(
              'rounded-[var(--radius-sm)] border p-3 transition-colors',
              practiced
                ? 'border-[var(--leaf)]/40 bg-[var(--leaf-soft)]'
                : 'border-[var(--bloom)]/35 bg-[var(--bloom-soft)]',
            )}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--bloom)]">
              <Target size={13} />
              어제 다짐한 한 가지 · 오늘 실천해요
            </div>
            <p className="mt-1 text-sm font-medium leading-snug text-[var(--fg-primary)]">
              “{resolution}”
            </p>
            <button
              onClick={togglePracticed}
              className={cn(
                'mt-2 flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors',
                practiced
                  ? 'bg-[var(--leaf)] text-white'
                  : 'border border-[var(--bloom)]/40 bg-white text-[var(--bloom)]',
              )}
            >
              <CheckCircle2 size={14} />
              {practiced ? '오늘 실천했어요 ✓' : '오늘 이 다짐을 실천했어요'}
            </button>
          </div>
        )}

        {/* 오늘 먼저 챙길 포인트 — 어제 놓친 것 중 가장 중요한 습관 (다짐이 없을 때만 — 중복 강조 방지) */}
        {recap?.focus && !resolution && (
          <div className="flex items-start gap-1.5 rounded-md bg-[var(--bloom-soft)] px-2.5 py-2 text-xs text-[var(--fg-primary)]">
            <Lightbulb size={13} className="mt-0.5 shrink-0 text-[var(--bloom)]" />
            <p className="leading-snug">
              오늘은 <b className="text-[var(--bloom)]">{recap.focus.title}</b>부터 챙겨보세요 —
              어제 놓친 것 중 가장 중요한 습관이에요.
            </p>
          </div>
        )}

        {/* 오늘 핵심 습관 — 모닝 브리프의 우선순위 습관 */}
        {priorityHabits.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[var(--fg-muted)]">오늘 핵심</span>
            {priorityHabits.map((h) => (
              <span key={h.id} className="rounded-full bg-[var(--leaf-soft)] px-2 py-0.5 text-[11px] text-[var(--leaf-strong,var(--leaf))]">
                ⭐ {h.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ════ 어제 돌아보기 (기본 접힘) ════ */}
      {recap && (
        <div className="mt-2.5 border-t border-[var(--bloom)]/12 pt-2.5">
          <button
            onClick={() => setRecapOpen((o) => !o)}
            aria-expanded={recapOpen}
            className="flex w-full items-center justify-between text-[11px] text-[var(--fg-muted)]"
          >
            <span className="flex items-center gap-1.5">
              어제 돌아보기
              <span className="tabular-nums text-[var(--fg-faint)]">
                {recap.achieved}/{recap.intended} 달성
                {dayScore !== undefined && ` · ${dayScore}점`}
              </span>
              {allDone && <span className="text-[var(--leaf)]">· 완벽한 하루 🔥</span>}
            </span>
            <ChevronDown
              size={14}
              className={cn('shrink-0 transition-transform', recapOpen && 'rotate-180')}
            />
          </button>

          <AnimatePresence initial={false}>
            {recapOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-2.5">
                  {allDone ? (
                    <p className="text-xs leading-snug text-[var(--leaf)]">
                      어제 {recap.achieved}개 모두 달성! 완벽한 하루였어요. 오늘도 이어가요 🔥
                    </p>
                  ) : (
                    <>
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

                      {/* 미완료 패널티 */}
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
                    </>
                  )}

                  <button
                    onClick={() => navigate(`/day/${yesterday}`)}
                    className="flex items-center gap-1 text-xs text-[var(--leaf)]"
                  >
                    어제 기록 보완하기 <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.section>
  );
}
