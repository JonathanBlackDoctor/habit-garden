import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useHabits, useHabitChecks } from '@/features/habits/useHabits';
import { useProgress } from '@/features/progress/useProgress';
import { formatKoreanDate, timeOfDay } from '@/lib/dayBoundary';
import { cn } from '@/lib/utils';
import { useTabBloomKey } from '@/lib/tabActive';
import ProgressRing from '@/components/ProgressRing';
import type { DayDoc, TodayTodoDoc } from 'shared/types/firestore';
import { motion, Reorder, useDragControls } from 'framer-motion';
import { ArrowRight, CheckCircle2, RefreshCw, PenLine, GripVertical, Pencil, Check, RotateCcw, Eye, EyeOff } from 'lucide-react';
import OneYearAgoCard from '@/features/stats/OneYearAgoCard';
import CoachCard from '@/features/coach/CoachCard';
import SignupCTA from '@/components/SignupCTA';
import { useCrisisWatcher } from '@/features/coach/useCrisisWatcher';
import { useFaithEnabled, useIsPremium } from '@/lib/features';
import HabitStatusDot from '@/features/habits/HabitStatusDot';
import SeedHabitsButton from '@/features/habits/SeedHabitsButton';
import { statusOf } from '@/features/habits/habitStatus';
import MorningBriefingCard from '@/features/recap/MorningBriefingCard';
import TodayApplicationCard from '@/features/applications/TodayApplicationCard';
import {
  useMainWidgetOrder,
  useHiddenWidgets,
  useSaveMainLayout,
  type MainWidgetId,
} from '@/features/layout/useMainLayout';

const TIME_LABELS: Record<string, string> = {
  morning: '아침', afternoon: '점심', evening: '저녁', night: '밤', anytime: '언제든',
};
const GREETINGS: Record<string, string> = {
  morning: '좋은 아침이에요', afternoon: '좋은 오후예요', evening: '좋은 저녁이에요', night: '하루 마무리 시간이에요',
};
const TIME_ORDER = ['morning', 'afternoon', 'evening', 'night', 'anytime'];

const WIDGET_LABELS: Record<MainWidgetId, string> = {
  recap: '아침 브리핑',
  habits: '오늘의 습관',
  todos: '할 일 · 회고',
  condition: '컨디션',
  coach: 'AI 코치',
  oneYearAgo: '1년 전 오늘',
  faith: '기도 · 말씀',
};

/**
 * 위젯 편집 행 — 손잡이(GripVertical)를 잡았을 때만 순서를 바꿀 수 있다.
 * dragListener={false} 로 행 전체 드래그를 끄고, 손잡이 onPointerDown 에서만
 * dragControls.start 로 드래그를 시작한다. (스크롤·숨김 버튼 탭과 충돌 방지)
 */
function WidgetEditItem({
  id, label, hidden, onToggleHidden,
}: {
  id: MainWidgetId;
  label: string;
  hidden: boolean;
  onToggleHidden: (id: MainWidgetId) => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-3',
        hidden && 'opacity-40',
      )}
    >
      <button
        type="button"
        aria-label="순서 변경 손잡이"
        onPointerDown={(e) => controls.start(e)}
        className="-m-1 cursor-grab touch-none p-1 text-[var(--fg-faint)] active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <GripVertical size={18} />
      </button>
      <span className={cn('flex-1 text-sm font-medium', hidden ? 'text-[var(--fg-faint)] line-through' : 'text-[var(--fg-primary)]')}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => onToggleHidden(id)}
        aria-label={hidden ? '표시' : '숨기기'}
        className="rounded-full p-1.5 text-[var(--fg-faint)] transition-colors hover:bg-[var(--leaf-soft)]"
      >
        {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </Reorder.Item>
  );
}

export default function Main() {
  const uid      = useAppStore((s) => s.uid);
  const date     = useAppStore((s) => s.currentDate);
  const navigate = useNavigate();
  const location = useLocation();
  const faithEnabled = useFaithEnabled();
  const isPremium = useIsPremium();
  const habits   = useHabits();
  const checks   = useHabitChecks(date);
  const progress = useProgress();
  const bloomKey = useTabBloomKey('/');
  const [dayDoc, setDayDoc]   = useState<DayDoc | null>(null);
  const [todos, setTodos]     = useState<TodayTodoDoc[]>([]);
  const currentTOD = timeOfDay();

  // ── 위젯 순서·숨김 편집 ──
  const savedOrder  = useMainWidgetOrder();
  const savedHidden = useHiddenWidgets();
  const { saveLayout, resetLayout } = useSaveMainLayout();
  const [editMode, setEditMode]     = useState(false);
  const [draftOrder, setDraftOrder] = useState<MainWidgetId[]>(savedOrder);
  const [draftHidden, setDraftHidden] = useState<MainWidgetId[]>(savedHidden);

  // 더보기 탭에서 "위젯 편집" 버튼을 누르면 store 플래그로 편집 모드를 연다.
  const widgetEditOpen  = useAppStore((s) => s.widgetEditOpen);
  const closeWidgetEdit = useAppStore((s) => s.closeWidgetEdit);
  useEffect(() => {
    if (widgetEditOpen) { setEditMode(true); closeWidgetEdit(); }
  }, [widgetEditOpen, closeWidgetEdit]);

  // 오늘 탭은 keep-alive 로 유지돼 다른 탭으로 이동해도 언마운트되지 않는다.
  // 뒤로 가기·다른 탭 이동 등으로 '/' 를 벗어나면 편집 내용을 저장하고 편집창을 닫는다.
  useEffect(() => {
    if (location.pathname !== '/' && editMode) {
      void saveLayout(draftOrder, draftHidden);
      setEditMode(false);
    }
  }, [location.pathname, editMode, draftOrder, draftHidden, saveLayout]);

  // 편집 중이 아닐 때는 저장된 값을 그대로 따라간다(다른 기기 변경 등 반영).
  useEffect(() => {
    if (!editMode) {
      setDraftOrder(savedOrder);
      setDraftHidden(savedHidden);
    }
  }, [savedOrder, savedHidden, editMode]);

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

  useCrisisWatcher();
  const totalAchieved = Object.values(checks).filter((c) => c.achieved).length;
  const totalHabits   = habits.length;
  const streak     = progress?.globalStreak ?? 0;
  const hasReflection = !!dayDoc?.reflection;

  const groupedHabits = TIME_ORDER.map((tod) => {
    const group = habits.filter((h) => h.timeOfDay === tod);
    const achieved = group.filter((h) => checks[h.id]?.achieved).length;
    return { tod, group, achieved };
  }).filter(({ group }) => group.length > 0);

  const remaining = habits.filter((h) => checks[h.id] === undefined).length;
  // 회고 작성 넛지 — 저녁·밤이거나, 오늘 습관을 모두 기록해 마무리할 때 강조.
  // (회고를 더 자주·확실히 쓰도록 노출 시점을 넓힌다)
  const habitsSettled = totalHabits > 0 && remaining === 0;
  const reflectionDue = !hasReflection && (currentTOD === 'evening' || currentTOD === 'night' || habitsSettled);
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

  // ── 위젯 레지스트리 — id → 렌더 노드 ──
  // 조건부 위젯은 표시 조건이 아니면 null 을 돌려 일반 모드에서 자연히 사라진다.
  const widgets: Record<MainWidgetId, ReactNode> = {
    recap: (
      <MorningBriefingCard
        habits={habits}
        morningBrief={dayDoc?.morningBrief}
        resolutionPracticed={dayDoc?.resolutionPracticed}
      />
    ),

    habits: (
      <motion.section
        data-tour="today"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">오늘의 습관</h3>
          <button onClick={() => navigate('/habits')} className="flex items-center gap-1 text-xs text-[var(--leaf)]">
            지금 체크 <ArrowRight size={13} />
          </button>
        </div>
        {groupedHabits.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <p className="text-xs text-[var(--fg-muted)]">아직 습관이 없어요. 기본 습관으로 바로 시작해요.</p>
            <SeedHabitsButton />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <ProgressRing key={bloomKey} progress={ratio} size={76} stroke={8} color={ratio >= 1 ? 'var(--bloom)' : 'var(--leaf)'}>
              <span className="text-lg font-bold tabular-nums text-[var(--fg-primary)]">
                {totalAchieved}
                <span className="text-xs font-medium text-[var(--fg-faint)]">/{intended}</span>
              </span>
              <span className="mt-0.5 text-[9px] text-[var(--fg-muted)]">달성</span>
            </ProgressRing>
            <div className="min-w-0 flex-1 space-y-1.5">
              {nudge && (
                <p className={cn('text-sm font-semibold', remaining === 0 ? 'text-[var(--leaf)]' : 'text-[var(--bloom)]')}>
                  {nudge}
                </p>
              )}
              {groupedHabits.map(({ tod, group, achieved }) => {
                const isNow = tod === currentTOD;
                const pending = group.filter((h) => checks[h.id] === undefined).length;
                const settled = pending === 0;
                const dotSize = group.length <= 8 ? 14 : group.length <= 14 ? 12 : 10;
                return (
                  <button
                    key={tod}
                    onClick={() => navigate('/habits')}
                    className={cn('flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors', isNow && !settled && 'bg-[var(--bloom)]/10')}
                  >
                    <span className="w-8 shrink-0 text-[11px] text-[var(--fg-muted)]">{TIME_LABELS[tod]}</span>
                    <div className={cn('flex flex-1 flex-wrap items-center', dotSize >= 14 ? 'gap-1.5' : 'gap-1')}>
                      {group.map((h) => (
                        <HabitStatusDot key={h.id} status={statusOf(checks[h.id])} size={dotSize} isNow={isNow} title={h.title} />
                      ))}
                    </div>
                    <span className={cn('shrink-0 text-[11px] tabular-nums', settled ? 'text-[var(--leaf)]' : isNow ? 'font-medium text-[var(--bloom)]' : 'text-[var(--fg-faint)]')}>
                      {achieved}/{group.length}{isNow && !settled && ' ⚡'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </motion.section>
    ),

    // 하루 회고는 상단 강조 배너(미작성 시)와 '하루 회고' 라우트가 전담한다.
    // 위젯에선 회고 카드를 빼고 '할 일'을 전체 폭 카드로 보여준다.
    todos: (() => {
      const remainingTodos = todos.filter((t) => !t.done);
      const total = todos.length;
      const doneCount = total - remainingTodos.length;
      const allDone = total > 0 && remainingTodos.length === 0;
      return (
        <motion.section
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-semibold text-[var(--fg-primary)]">할 일</h3>
              {total > 0 && <span className="text-xs tabular-nums text-[var(--fg-faint)]">{doneCount}/{total}</span>}
            </div>
            <button onClick={() => navigate('/planner')} className="flex items-center gap-1 text-xs text-[var(--leaf)]">
              {total === 0 ? '추가하기' : '전체 보기'} <ArrowRight size={13} />
            </button>
          </div>

          {total === 0 ? (
            <p className="py-1 text-center text-xs text-[var(--fg-faint)]">할 일을 추가해 오늘을 계획해 보세요.</p>
          ) : allDone ? (
            <div className="flex items-center justify-center gap-1.5 py-1 text-[var(--leaf)]">
              <CheckCircle2 size={16} /><span className="text-sm font-medium">오늘 할 일 완수 🌿</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {remainingTodos.slice(0, 4).map((t) => (
                <button key={t.id} onClick={() => navigate('/planner')} className="flex w-full items-center gap-2 text-left">
                  <span className="h-3.5 w-3.5 shrink-0 rounded-[5px] border-[1.5px] border-[var(--bloom)]/50" />
                  <span className="flex-1 truncate text-sm text-[var(--fg-primary)]">{t.title}</span>
                </button>
              ))}
              {remainingTodos.length > 4 && (
                <p className="pl-6 text-[11px] text-[var(--fg-muted)]">+{remainingTodos.length - 4}개 더</p>
              )}
            </div>
          )}
        </motion.section>
      );
    })(),

    condition: (
      <motion.button
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        onClick={() => navigate('/condition')}
        className="card px-4 py-3 text-left flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--sky)]">☀</span>
          {dayDoc?.condition?.sleepScore !== undefined ? (
            <span className="text-sm text-[var(--fg-primary)]">수면 {dayDoc.condition.sleepScore} · 에너지 {dayDoc.condition.energyScore ?? '-'} · 기분 {dayDoc.condition.moodScore ?? '-'}</span>
          ) : (
            <span className="text-sm text-[var(--fg-faint)]">컨디션 입력 전 — 탭해서 기록</span>
          )}
        </div>
        <ArrowRight size={14} className="text-[var(--fg-faint)]" />
      </motion.button>
    ),

    coach: isPremium ? (
      <CoachCard />
    ) : (
      <SignupCTA title="AI 코치가 기다려요" desc="가입하면 매일의 기록을 읽고 한 줄 코칭을 건네는 AI 코치와 주간 인사이트가 열려요." />
    ),

    oneYearAgo: <OneYearAgoCard />,

    faith: faithEnabled ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-3">
        <TodayApplicationCard />
      </motion.div>
    ) : null,
  };

  const exitEdit = () => {
    setEditMode(false);
    void saveLayout(draftOrder, draftHidden);
  };

  const toggleHidden = (id: MainWidgetId) => {
    setDraftHidden((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id],
    );
  };

  return (
    <div className="flex min-h-full flex-col gap-3 p-4 pb-6">
      {/* ── 상단바 (항상 고정 — 정렬 대상 아님) ── */}
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
        <svg className="pointer-events-none absolute -right-2 -top-2 opacity-[0.18]" width="72" height="72" viewBox="0 0 24 24" fill="white" aria-hidden>
          <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.49.39C18 19 22 14 22 7c0-1.72-.22-3.24-.6-4.6C19.5 1.4 17 1 14 1 9 1 5 4 5 9c0 4 4 7 12 7-1.5-2-3.5-3.5-6-4z"/>
        </svg>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-xs opacity-80">{GREETINGS[currentTOD]}</p>
            <p className="text-lg font-semibold leading-tight">
              {formatKoreanDate(date)}
              {streak > 0 && <span className="ml-2 text-sm opacity-90">🔥{streak}일</span>}
            </p>
          </div>
          <button onClick={() => window.location.reload()} aria-label="새로고침" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 active:scale-95">
            <RefreshCw size={15} />
          </button>
        </div>
      </motion.div>

      {/* ── 오늘 회고 강조 배너 (저녁·밤 미작성 시 — 고정) ── */}
      {!editMode && reflectionDue && (
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
            <p className="text-xs text-[var(--fg-muted)]">‘내일의 다짐’이 내일 아침 실천 카드로 이어져요</p>
          </div>
          <ArrowRight size={16} className="shrink-0 text-[var(--bloom)]" />
        </motion.button>
      )}

      {/* ── 위젯 목록 ── */}
      {editMode ? (
        <>
          <p className="text-xs text-[var(--fg-muted)] px-1">
            손잡이를 잡아 순서를 바꾸고 <EyeOff size={11} className="inline" />로 숨길 수 있어요
          </p>
          <Reorder.Group axis="y" values={draftOrder} onReorder={setDraftOrder} className="flex flex-col gap-2">
            {draftOrder.map((id) => (
              <WidgetEditItem
                key={id}
                id={id}
                label={WIDGET_LABELS[id]}
                hidden={draftHidden.includes(id)}
                onToggleHidden={toggleHidden}
              />
            ))}
          </Reorder.Group>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => { void resetLayout(); setEditMode(false); }}
              className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--fg-muted)]"
            >
              <RotateCcw size={12} /> 기본으로
            </button>
            <button
              onClick={exitEdit}
              className="flex items-center gap-1 rounded-full bg-[var(--leaf)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Check size={13} /> 완료
            </button>
          </div>
        </>
      ) : (
        <>
          {draftOrder.map((id) => {
            if (savedHidden.includes(id)) return null;
            const node = widgets[id];
            if (!node) return null;
            return (
              <div key={id} className="flex flex-col">
                {node}
              </div>
            );
          })}
          {/* 위젯 편집 버튼 — 탭 최하단 */}
          <button
            onClick={() => setEditMode(true)}
            className="mx-auto mt-2 flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--fg-faint)] transition-colors hover:bg-[var(--bg-surface)]"
          >
            <Pencil size={12} /> 위젯 편집
          </button>
        </>
      )}
    </div>
  );
}
