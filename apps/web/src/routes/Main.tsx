import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useHabits, useHabitChecks } from '@/features/habits/useHabits';
import { useProgress } from '@/features/progress/useProgress';
import { formatLongKoreanDate, timeOfDay } from '@/lib/dayBoundary';
import { cn } from '@/lib/utils';
import WeeklyRhythm from '@/features/stats/WeeklyRhythm';
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
const TIME_ORDER = ['morning', 'afternoon', 'evening', 'night', 'anytime'];
/** 헤드라인용 우리말 수사 — "저녁 습관 네 개가 남아 있어요" */
const NUM_WORDS = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];

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
  const nudge =
    totalHabits === 0 ? null
    : remaining === 0 ? '오늘 할 일 끝'
    : remaining === 1 ? '딱 하나만 더'
    : remaining <= 3  ? `거의 다 왔어요 · ${remaining}개 남음`
    : `오늘 ${remaining}개 남았어요`;

  // ── 상단 헤드라인 — 지금 시간대에 무엇이 남았는지 한 문장으로 ──
  const nowGroup = groupedHabits.find((g) => g.tod === currentTOD);
  const nowPending = nowGroup
    ? nowGroup.group.filter((h) => checks[h.id] === undefined).length
    : 0;
  const countWord = (n: number) => (n < NUM_WORDS.length ? `${NUM_WORDS[n]} 개` : `${n}개`);
  const headline =
    totalHabits === 0
      ? '오늘 기록할 습관을 정해 볼까요'
      : nowPending > 0
        ? `${TIME_LABELS[currentTOD]} 습관 ${countWord(nowPending)}가\n남아 있어요`
        : remaining > 0
          ? `다른 시간대 습관 ${countWord(remaining)}가\n남아 있어요`
          : '오늘 할 일을\n모두 기록했어요';

  // 오늘 요약 — 습관 진행 + (신앙 사용 시) 남은 기도 수
  const summaryLine = [
    totalHabits > 0 ? `오늘 ${totalHabits}개 중 ${totalAchieved}개 기록` : '아직 습관이 없어요',
    streak > 0 ? `${streak}일 연속` : null,
  ].filter(Boolean).join(' · ');

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

    // 1a — 현재 시간대만 펼쳐 보여주고, 나머지 시간대는 한 줄 링크로 접는다.
    habits: (() => {
      if (groupedHabits.length === 0) {
        return (
          <motion.section
            data-tour="today"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="card-flat flex flex-col items-center gap-2 px-4 py-5 text-center"
          >
            <p className="text-sm text-[var(--fg-muted)]">아직 습관이 없어요. 기본 습관으로 바로 시작해요.</p>
            <SeedHabitsButton />
          </motion.section>
        );
      }
      const now = groupedHabits.find((g) => g.tod === currentTOD) ?? groupedHabits[0];
      const restCount = groupedHabits
        .filter((g) => g.tod !== now.tod)
        .reduce((s, g) => s + g.group.length, 0);
      const restLabels = groupedHabits
        .filter((g) => g.tod !== now.tod)
        .map((g) => TIME_LABELS[g.tod]);
      return (
        <motion.section
          data-tour="today"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex flex-col gap-3.5"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold text-[var(--fg-primary)]">{TIME_LABELS[now.tod]}</span>
            <span className="text-[12px] tabular-nums text-[var(--fg-faint)]">
              {now.achieved} / {now.group.length}
            </span>
          </div>

          <div className="card-flat row-divide flex flex-col">
            {now.group.map((h) => {
              const st = statusOf(checks[h.id]);
              const settled = st === 'achieved' || st === 'skipped';
              return (
                <button
                  key={h.id}
                  onClick={() => navigate('/habits')}
                  className={cn(
                    'flex items-center gap-3.5 px-[18px] py-4 text-left transition-opacity',
                    settled && 'opacity-45',
                  )}
                >
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-[16px] text-[var(--fg-primary)]',
                      settled && 'line-through decoration-[var(--fg-faint)]',
                    )}
                  >
                    {h.title}
                  </span>
                  <HabitStatusDot status={st} size={14} isNow title={h.title} />
                </button>
              );
            })}
          </div>

          {restCount > 0 && (
            <button
              onClick={() => navigate('/habits')}
              className="self-center text-[13px] text-[var(--leaf)]"
            >
              {restLabels.join('·')} 습관 {restCount}개 보기
            </button>
          )}

          {nudge && (
            <p
              className={cn(
                'text-center text-[13px]',
                remaining === 0 ? 'text-[var(--leaf)]' : 'text-[var(--bloom)]',
              )}
            >
              {nudge}
            </p>
          )}
        </motion.section>
      );
    })(),

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
          className="card-flat p-4 space-y-3"
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
              <CheckCircle2 size={16} /><span className="text-sm font-medium">오늘 할 일 완수</span>
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
        className="card-flat px-4 py-3 text-left flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
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
      {/* ── 상단 (항상 고정 — 정렬 대상 아님) ──
          날짜 kicker → 지금 무엇이 남았는지 한 문장 → 오늘 요약 한 줄 */}
      <motion.div
        data-tour="hero"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 pt-1"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="kicker pt-0.5">{formatLongKoreanDate(date)}</span>
          <button
            onClick={() => window.location.reload()}
            aria-label="새로고침"
            className="-mr-1.5 -mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--fg-faint)] transition-colors hover:bg-[var(--bg-surface)] active:scale-95"
          >
            <RefreshCw size={15} />
          </button>
        </div>
        <h1
          className="whitespace-pre-line text-[27px] font-semibold leading-[1.34] tracking-[-0.01em] text-[var(--fg-primary)]"
          style={{ textWrap: 'pretty' } as React.CSSProperties}
        >
          {headline}
        </h1>
        <p className="text-sm tabular-nums text-[var(--fg-muted)]">{summaryLine}</p>
      </motion.div>

      {/* ── 지난 7일 리듬 — 게임 요소를 걷어낸 뒤 남은 유일한 피드백 ── */}
      <WeeklyRhythm className="pt-1" />

      {/* ── 오늘 회고 강조 배너 (저녁·밤 미작성 시 — 고정) ── */}
      {!editMode && reflectionDue && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/reflection')}
          className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--bloom)]/25 bg-[var(--bloom-soft)] px-4 py-3.5 text-left"
        >
          <PenLine size={17} className="shrink-0 text-[var(--bloom)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--bloom)]">오늘 회고를 작성해 주세요</p>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">‘내일의 다짐’이 내일 아침 실천 카드로 이어져요</p>
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
