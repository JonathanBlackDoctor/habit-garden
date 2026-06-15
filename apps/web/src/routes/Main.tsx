import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useHabits, useHabitChecks } from '@/features/habits/useHabits';
import { useProgress } from '@/features/garden/useGarden';
import PlantSVG from '@/features/garden/PlantSVG';
import TodayGrowth from '@/features/garden/TodayGrowth';
import { formatKoreanDate, timeOfDay } from '@/lib/dayBoundary';
import { xpForLevel, cn } from '@/lib/utils';
import BloomBadge from '@/components/BloomBadge';
import { useTabBloomKey } from '@/lib/tabActive';
import ProgressRing from '@/components/ProgressRing';
import type { DayDoc, TodayTodoDoc } from 'shared/types/firestore';
import { PLANT_SPECIES } from 'shared/types/firestore';
import { motion } from 'framer-motion';
import { Flame, ArrowRight, CheckCircle2, RefreshCw, Sparkles, X, Sunrise, PenLine } from 'lucide-react';
import { useComeback } from '@/features/comeback/useComeback';
import OneYearAgoCard from '@/features/stats/OneYearAgoCard';
import WeeklyQuestCard from '@/features/quests/WeeklyQuestCard';
import SeasonCard from '@/features/seasons/SeasonCard';
import CoachCard from '@/features/coach/CoachCard';
import SignupCTA from '@/components/SignupCTA';
import { useCrisisWatcher } from '@/features/coach/useCrisisWatcher';
import { useFaithEnabled, useIsPremium } from '@/lib/features';
import HabitStatusDot from '@/features/habits/HabitStatusDot';
import { statusOf } from '@/features/habits/habitStatus';
import YesterdayRecapCard from '@/features/recap/YesterdayRecapCard';
import { pointsForCheck } from 'shared/lib/habitPoints';
import TodayApplicationCard from '@/features/applications/TodayApplicationCard';

const TIME_LABELS: Record<string, string> = {
  morning: '아침', afternoon: '점심', evening: '저녁', night: '밤', anytime: '언제든',
};
const GREETINGS: Record<string, string> = {
  morning: '좋은 아침이에요', afternoon: '좋은 오후예요', evening: '좋은 저녁이에요', night: '하루 마무리 시간이에요',
};
const TIME_ORDER = ['morning', 'afternoon', 'evening', 'night', 'anytime'];

export default function Main() {
  const uid      = useAppStore((s) => s.uid);
  const date     = useAppStore((s) => s.currentDate);
  const navigate = useNavigate();
  const faithEnabled = useFaithEnabled();
  const isPremium = useIsPremium();
  const habits   = useHabits();
  const checks   = useHabitChecks(date);
  const progress = useProgress();
  const bloomKey = useTabBloomKey('/'); // 오늘 탭에 들어올 때 배지 재생
  const [dayDoc, setDayDoc]   = useState<DayDoc | null>(null);
  const [todos, setTodos]     = useState<TodayTodoDoc[]>([]);
  const currentTOD = timeOfDay();

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid, 'days', date), (snap) => {
      setDayDoc(snap.exists() ? (snap.data() as DayDoc) : null);
    });
  }, [uid, date]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(collection(db, 'users', uid, 'days', date, 'todayTodos')), (snap) => {
      setTodos(snap.docs.map((d) => d.data() as TodayTodoDoc));
    });
  }, [uid, date]);

  const comeback = useComeback();
  useCrisisWatcher();
  const totalAchieved = Object.values(checks).filter((c) => c.achieved).length;
  const totalHabits   = habits.length;
  // 오늘 기록된 체크의 실제 적립 포인트 합 — 가중치·점수를 반영한 정산식(서버와 동일).
  // 콤보 보너스는 변동값이라 제외한 기본 포인트 기준 예상치.
  const forecastPoints = habits.reduce((sum, h) => {
    const c = checks[h.id];
    if (!c || c.score === null) return sum;
    return sum + pointsForCheck(h.weight, h.scoreMode, c.score);
  }, 0);
  const spendable     = progress?.spendablePoints ?? 0;
  const streak        = progress?.globalStreak ?? 0;
  const level         = progress?.level ?? 1;
  const xpInLevel     = progress?.xpInLevel ?? 0;
  const xpNeeded      = xpForLevel(level);
  const health        = progress?.gardenState?.health ?? 100;
  const plants        = progress?.gardenState?.plants ?? [];
  const hasReflection = !!dayDoc?.reflection;
  // 저녁·밤에 아직 회고를 안 썼으면 메인에서 강조 (꼭 작성하도록 넛지)
  const reflectionDue = !hasReflection && (currentTOD === 'evening' || currentTOD === 'night');

  // 시간대별 요약
  const groupedHabits = TIME_ORDER.map((tod) => {
    const group = habits.filter((h) => h.timeOfDay === tod);
    const achieved = group.filter((h) => checks[h.id]?.achieved).length;
    return { tod, group, achieved };
  }).filter(({ group }) => group.length > 0);

  // 미기록(아직 손대지 않은) 습관 수 + 격려 넛지
  const remaining = habits.filter((h) => checks[h.id] === undefined).length;
  // 건너뜀(score=null)은 오늘 목표에서 제외 — 미이행으로 취급하지 않음
  const skippedCount = habits.filter((h) => checks[h.id]?.score === null).length;
  const intended = Math.max(totalHabits - skippedCount, 0);
  const ratio = intended > 0 ? totalAchieved / intended : (totalHabits > 0 ? 1 : 0);
  const nudge =
    totalHabits === 0 ? null
    : remaining === 0 ? '오늘 할 일 끝! 🌱'
    : remaining === 1 ? '딱 하나만 더!'
    : remaining <= 3  ? `거의 다 왔어요 · ${remaining}개 남음`
    : `오늘 ${remaining}개 남았어요`;

  return (
    <div className="flex min-h-full flex-col gap-3 p-4 pb-6">
      {/* ── 상단바 ── */}
      <motion.div
        data-tour="hero"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[var(--radius-lg)] px-5 py-4 text-white"
        style={{
          background: 'linear-gradient(135deg, #4F7A37 0%, #5E8E42 55%, #6FA152 100%)',
          boxShadow: '0 6px 16px -4px rgba(79,122,55,0.40), inset 0 1px 0 rgba(255,255,255,0.14)',
        }}
      >
        <svg
          className="pointer-events-none absolute -right-2 -top-2 opacity-[0.18]"
          width="72" height="72" viewBox="0 0 24 24" fill="white"
          aria-hidden
        >
          <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.49.39C18 19 22 14 22 7c0-1.72-.22-3.24-.6-4.6C19.5 1.4 17 1 14 1 9 1 5 4 5 9c0 4 4 7 12 7-1.5-2-3.5-3.5-6-4z"/>
        </svg>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BloomBadge level={level} size={34} burstKey={bloomKey || undefined} />
            <div>
              <p className="text-xs opacity-80">{GREETINGS[currentTOD]} · {formatKoreanDate(date)}</p>
              <p className="text-lg font-semibold leading-tight">
                Lv.{level}
                {streak > 0 && (
                  <span className="ml-2 text-sm opacity-90">
                    🔥{streak}일
                  </span>
                )}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{ width: `${Math.min((xpInLevel / xpNeeded) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums opacity-80">{xpInLevel}/{xpNeeded}</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="text-right">
              <p className="text-xs opacity-80">생기 {health}</p>
              <p className="text-lg font-semibold tabular-nums leading-tight">✦{spendable.toLocaleString()}P</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              aria-label="새로고침"
              className="mt-0.5 rounded-full p-1.5 text-white/90 transition-colors hover:bg-white/15 active:bg-white/20"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── 어제 돌아보기 — 어제 미달성 습관·개선 포인트 다음날 피드백 ── */}
      <YesterdayRecapCard habits={habits} />

      {/* ── 오늘의 습관 ── */}
      <motion.section
        data-tour="today"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">오늘의 습관</h3>
          <button
            onClick={() => navigate('/habits')}
            className="flex items-center gap-1 text-xs text-[var(--leaf)]"
          >
            지금 체크 <ArrowRight size={13} />
          </button>
        </div>

        {groupedHabits.length === 0 ? (
          <p className="text-xs text-[var(--fg-faint)] text-center py-2">
            관리 메뉴에서 시드 습관을 추가하세요.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            {/* 히어로 — 오늘 달성률 원형 진행 링 */}
            <ProgressRing
              key={bloomKey}
              progress={ratio}
              size={76}
              stroke={8}
              color={ratio >= 1 ? 'var(--bloom)' : 'var(--leaf)'}
            >
              <span className="text-lg font-bold tabular-nums text-[var(--fg-primary)]">
                {totalAchieved}
                <span className="text-xs font-medium text-[var(--fg-faint)]">/{intended}</span>
              </span>
              <span className="mt-0.5 text-[9px] text-[var(--fg-muted)]">달성</span>
            </ProgressRing>

            {/* 넛지 + 시간대별 요약 */}
            <div className="min-w-0 flex-1 space-y-1.5">
              {nudge && (
                <p className={cn('text-sm font-semibold', remaining === 0 ? 'text-[var(--leaf)]' : 'text-[var(--bloom)]')}>
                  {nudge}
                </p>
              )}
              {groupedHabits.map(({ tod, group, achieved }) => {
                const isNow = tod === currentTOD;
                // 미기록(아직 손대지 않은) 습관만 '할 일'로 간주 — 건너뜀·미달·달성은 처리됨
                const pending = group.filter((h) => checks[h.id] === undefined).length;
                const settled = pending === 0;
                // 적응형 크기 — 그룹이 많아질수록 dot를 줄여 줄바꿈 최소화
                const dotSize = group.length <= 8 ? 14 : group.length <= 14 ? 12 : 10;
                return (
                  <button
                    key={tod}
                    onClick={() => navigate('/habits')}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors',
                      isNow && !settled && 'bg-[var(--bloom)]/10'
                    )}
                  >
                    <span className="w-8 shrink-0 text-[11px] text-[var(--fg-muted)]">{TIME_LABELS[tod]}</span>
                    <div className={cn('flex flex-1 flex-wrap items-center', dotSize >= 14 ? 'gap-1.5' : 'gap-1')}>
                      {group.map((h) => (
                        <HabitStatusDot
                          key={h.id}
                          status={statusOf(checks[h.id])}
                          size={dotSize}
                          isNow={isNow}
                          title={h.title}
                        />
                      ))}
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-[11px] tabular-nums',
                        settled ? 'text-[var(--leaf)]' : isNow ? 'font-medium text-[var(--bloom)]' : 'text-[var(--fg-faint)]'
                      )}
                    >
                      {achieved}/{group.length}
                      {isNow && !settled && ' ⚡'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </motion.section>

      {/* ── 오늘 회고 강조 배너 (저녁·밤 미작성 시) ── */}
      {reflectionDue && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/reflection')}
          className="relative flex w-full items-center gap-3 overflow-hidden rounded-[var(--radius)] border border-[var(--bloom)]/30 bg-[var(--bloom-soft)] p-3.5 text-left"
        >
          <motion.div
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bloom)] text-white"
          >
            <PenLine size={18} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--bloom)]">오늘 회고를 작성해 주세요</p>
            <p className="text-xs text-[var(--fg-muted)]">하루를 돌아보고 +20P · 스마트폰 사용 시간도 함께 기록</p>
          </div>
          <ArrowRight size={16} className="shrink-0 text-[var(--bloom)]" />
        </motion.button>
      )}

      {/* ── 할 일 / 회고 ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="grid grid-cols-2 gap-3"
      >
        {/* 할 일 — 미완료(미이행) 강조 */}
        {(() => {
          const remaining = todos.filter((t) => !t.done);
          const total = todos.length;
          const allDone = total > 0 && remaining.length === 0;
          return (
            <button
              onClick={() => navigate('/planner')}
              className={`p-3 text-left space-y-1 rounded-[var(--radius)] shadow-[var(--shadow-sm)] ${
                remaining.length > 0
                  ? 'bg-[var(--bloom-soft)] ring-1 ring-[var(--bloom)]/25'
                  : 'bg-[var(--bg-surface)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--fg-muted)]">할 일</p>
                {remaining.length > 0 && (
                  <span className="rounded-full bg-[var(--bloom)] px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                    {remaining.length}개 남음
                  </span>
                )}
              </div>
              {total === 0 ? (
                <p className="text-xs text-[var(--fg-faint)]">없음</p>
              ) : allDone ? (
                <div className="flex items-center gap-1 text-[var(--leaf)]">
                  <CheckCircle2 size={14} />
                  <span className="text-xs">오늘 할 일 완수 🌿</span>
                </div>
              ) : (
                <>
                  {remaining.slice(0, 3).map((t) => (
                    <p key={t.id} className="text-xs text-[var(--fg-primary)] truncate">
                      □ {t.title}
                    </p>
                  ))}
                  {remaining.length > 3 && (
                    <p className="text-[11px] text-[var(--fg-muted)]">+{remaining.length - 3}개 더</p>
                  )}
                </>
              )}
            </button>
          );
        })()}

        {/* 회고 — 미작성 시 강조 */}
        <button
          onClick={() => navigate('/reflection')}
          className={`p-3 text-left space-y-1 rounded-[var(--radius)] shadow-[var(--shadow-sm)] ${
            !hasReflection
              ? 'bg-[var(--bloom-soft)] ring-1 ring-[var(--bloom)]/25'
              : 'bg-[var(--bg-surface)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[var(--fg-muted)]">하루 회고</p>
            {reflectionDue && (
              <span className="rounded-full bg-[var(--bloom)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                작성하기
              </span>
            )}
          </div>
          {hasReflection ? (
            <div className="flex items-center gap-1 text-[var(--leaf)]">
              <CheckCircle2 size={14} />
              <span className="text-xs">작성 완료</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[var(--bloom)]">
              <PenLine size={13} />
              <span className="text-xs">{reflectionDue ? '지금 작성 (+20P)' : '저녁에 작성하기'}</span>
            </div>
          )}
        </button>
      </motion.div>

      {/* ── 정원 미리보기 ── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-4 space-y-2 flex-1 flex flex-col"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">정원</h3>
          <button
            onClick={() => navigate('/garden')}
            className="flex items-center gap-1 text-xs text-[var(--leaf)]"
          >
            정원 가기 <ArrowRight size={13} />
          </button>
        </div>
        <div
          className="relative flex-1 flex items-end justify-center gap-2 rounded-[var(--radius)] bg-gradient-to-b from-[var(--garden-sky-top)] via-[var(--garden-sky-bottom)] to-[var(--leaf-soft)] py-4 min-h-[140px] overflow-hidden"
        >
          {/* 햇살 */}
          <div
            className="pointer-events-none absolute -top-6 right-1 z-0 h-20 w-20 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--garden-sun) 0%, transparent 70%)', opacity: 0.65 }}
          />
          {/* 흙 띠 */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-9 rounded-b-[var(--radius)]"
            style={{ background: 'linear-gradient(to top, var(--garden-soil-bottom) 0%, var(--garden-soil-top) 55%, transparent 100%)', opacity: 0.45 }}
          />
          {plants.length === 0 ? (
            <p className="relative z-10 self-center text-sm text-[var(--fg-faint)]">씨앗을 심어보세요 🌱</p>
          ) : (
            plants.slice(0, 4).map((p) => (
              <PlantSVG
                key={p.id}
                speciesId={p.speciesId}
                stage={p.stage}
                withered={!!p.witheredSince}
                rarity={PLANT_SPECIES.find((sp) => sp.id === p.speciesId)?.rarity}
                size={72}
                className="relative z-10"
              />
            ))
          )}
        </div>
        <div className="flex items-center justify-between">
          <TodayGrowth achieved={totalAchieved} total={totalHabits} />
          {forecastPoints > 0 && (
            <p className="text-xs text-[var(--fg-muted)] tabular-nums">
              +{forecastPoints}P 예상
            </p>
          )}
        </div>
      </motion.section>

      {/* ── 컨디션 한 줄 ── */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        onClick={() => navigate('/condition')}
        className="card px-4 py-3 text-left flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--sky)]">☀</span>
          {dayDoc?.condition?.sleepScore !== undefined ? (
            <span className="text-sm text-[var(--fg-primary)]">
              수면 {dayDoc.condition.sleepScore} · 에너지 {dayDoc.condition.energyScore ?? '-'} · 기분 {dayDoc.condition.moodScore ?? '-'}
            </span>
          ) : (
            <span className="text-sm text-[var(--fg-faint)]">컨디션 입력 전 — 탭해서 기록</span>
          )}
        </div>
        <ArrowRight size={14} className="text-[var(--fg-faint)]" />
      </motion.button>

      {/* ── 모닝 브리프 (B-8/B-32) ── */}
      {dayDoc?.morningBrief && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius)] border border-[var(--bloom)]/20 bg-gradient-to-br from-[#FFF6E5] to-[#FFE9C2] p-3"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--bloom)]">
            <Sunrise size={14} /> 오늘의 브리프
          </div>
          <p className="mt-1 text-sm leading-snug text-[var(--fg-primary)]">{dayDoc.morningBrief.message}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
            <span className="tabular-nums">어제 {dayDoc.morningBrief.yesterdayScore}점</span>
            {dayDoc.morningBrief.streak > 0 && <span className="tabular-nums">🔥 {dayDoc.morningBrief.streak}일</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {dayDoc.morningBrief.priorityHabits.map((h) => (
              <span key={h.id} className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] text-[var(--fg-primary)]">
                ⭐ {h.title}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── AI 코치 한 줄 (Phase 3-3) — 승인 사용자 전용 ── */}
      {isPremium ? (
        <CoachCard />
      ) : (
        <SignupCTA
          title="AI 코치가 기다려요"
          desc="가입하면 매일의 기록을 읽고 한 줄 코칭을 건네는 AI 코치와 주간 인사이트가 열려요."
        />
      )}

      {/* ── 주간 퀘스트 (Phase 4-1) ── */}
      <WeeklyQuestCard />

      {/* ── 시즌 챌린지 (Phase 4-2) — 진척 탭에서 오늘로 이동: 기간 한정 도전이라 매일 보이는 곳에 둔다 ── */}
      <SeasonCard />

      {/* ── 1년 전 오늘 (Phase 2-5) ── */}
      <OneYearAgoCard />

      {/* ── Comeback 환영 (Phase 4-5) ── */}
      {comeback.active && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex items-start gap-3 rounded-[var(--radius)] border border-[var(--bloom)]/30 bg-[var(--bloom-soft)] p-3"
        >
          <Sparkles size={18} className="mt-0.5 shrink-0 text-[var(--bloom)]" />
          <div className="flex-1 text-xs leading-snug text-[var(--fg-primary)]">
            <p className="font-semibold text-[var(--bloom)]">{comeback.gapDays}일 만이에요</p>
            <p>완벽이 아니라 돌아오는 게 중요해요. 앞으로 3일간 포인트 ×2!</p>
          </div>
          <button
            onClick={comeback.dismiss}
            aria-label="닫기"
            className="-mt-1 -mr-1 rounded-full p-1 text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}

      {/* ── 기도 · 말씀 적용 ── */}
      {faithEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-3"
        >
          <button
            onClick={() => navigate('/prayers')}
            className="card px-4 py-3 text-left flex items-center justify-between"
          >
            <span className="text-sm text-[var(--sky)]">🙏 오늘의 기도</span>
            <ArrowRight size={14} className="text-[var(--fg-faint)]" />
          </button>
          <TodayApplicationCard />
        </motion.div>
      )}
    </div>
  );
}
