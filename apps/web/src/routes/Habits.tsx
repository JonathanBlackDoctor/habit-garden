import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { animate } from 'framer-motion';
import { Pencil, Check, Plus, Sprout, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import SeedHabitsButton from '@/features/habits/SeedHabitsButton';
import AddHabitDialog from '@/features/habits/AddHabitDialog';
import { useHabits, useHabitChecks, useSaveHabitCheck, useClearHabitCheck } from '@/features/habits/useHabits';
import { useHabitGroups, useBulkSkip } from '@/features/habits/useHabitGroups';
import { useHabitStreaks } from '@/features/habits/useHabitStreaks';
import { statusOf } from '@/features/habits/habitStatus';
import HabitCard from '@/features/habits/HabitCard';
import HabitEditRow from '@/features/habits/HabitEditRow';
import PastDateBanner from '@/components/PastDateBanner';
import type { HabitDoc } from 'shared/types/firestore';
import { isHibernating } from 'shared/lib/hibernation';
import { formatLongKoreanDate, timeOfDay } from '@/lib/dayBoundary';
import { useTabBloomKey } from '@/lib/tabActive';
import { PageHeader, ProgressRail } from '@/components/Editorial';
import {
  HABIT_TIME_ORDER,
  getHabitOverview,
  groupHabitsByTime,
  shouldExpandTimeGroup,
} from '@/features/habits/habitDisplay';

const TIME_LABELS: Record<string, string> = {
  morning:   '아침',
  afternoon: '점심',
  evening:   '저녁',
  night:     '밤',
  anytime:   '언제든',
};
export default function Habits() {
  const [searchParams] = useSearchParams();
  const uid    = useAppStore((s) => s.uid);
  const today  = useAppStore((s) => s.currentDate);
  const dateParam = searchParams.get('date');
  const date   = dateParam ?? today;
  const isPast = !!dateParam && dateParam !== today;
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // 현재 시간대가 아닌 그룹 중 사용자가 직접 펼친 것들
  const [openTods, setOpenTods] = useState<string[]>([]);
  const habits = useHabits({ includeInactive: editMode, includeHibernating: true });
  const checks = useHabitChecks(date);
  const save   = useSaveHabitCheck(isPast ? date : undefined);
  const clear  = useClearHabitCheck(isPast ? date : undefined);
  const streaks = useHabitStreaks(habits);
  const habitGroups = useHabitGroups();
  const { bulkSkip, bulkUnskip } = useBulkSkip(date);
  const bloomKey = useTabBloomKey('/habits');
  const nowSectionRef = useRef<HTMLElement>(null);

  // 탭 진입/재탭 시 현재 시간대 그룹을 화면 중앙으로 스크롤
  // scrollIntoView는 가로 트랜스폼된 트랙 내부 중첩 스크롤에서 불안정하므로
  // 스크롤 컨테이너의 scrollTop을 직접 애니메이션(AppLayout과 동일 방식)
  useEffect(() => {
    if (bloomKey === 0) return;
    const el = nowSectionRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      let sc = el.closest('[data-active-panel]') as HTMLElement | null;
      if (!sc) {
        let p = el.parentElement;
        while (p && p.scrollHeight <= p.clientHeight) p = p.parentElement;
        sc = p;
      }
      if (!sc) return;
      const elTop = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
      const target = elTop - (sc.clientHeight - el.clientHeight) / 2;
      const max = sc.scrollHeight - sc.clientHeight;
      const clamped = Math.max(0, Math.min(target, max));
      animate(sc.scrollTop, clamped, {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (v) => { sc!.scrollTop = v; },
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [bloomKey]);

  // 휴면 중인 습관은 일일 목록·집계에서 빠지고, 편집 모드 전용 휴면 섹션에만 모인다.
  const liveHabits        = habits.filter((h) => !isHibernating(h));
  const hibernatingHabits = habits.filter((h) => isHibernating(h));
  const groups = groupHabitsByTime(liveHabits);
  // 온보딩 스포트라이트가 가리킬 첫 습관 카드 (TIME_ORDER 기준 최상단)
  const firstTourHabitId = HABIT_TIME_ORDER.map((t) => groups[t]?.[0]).find(Boolean)?.id;
  const overview = getHabitOverview(liveHabits, checks);
  const totalActive = overview.total;
  const totalAchieved = overview.achieved;
  const totalChecked = overview.recorded;
  const currentTOD     = timeOfDay();
  // 미기록(체크 문서 없음) 습관 수 — 격려 넛지용
  const remaining = overview.remaining;
  const nudge =
    totalActive === 0 ? null
    : remaining === 0 ? '오늘 다 했어요'
    : remaining === 1 ? '딱 하나만 더'
    : remaining <= 3  ? `거의 다 왔어요 · ${remaining}개 남음`
    : `오늘 ${remaining}개 남았어요`;

  const nextOrder = habits.length > 0 ? Math.max(...habits.map((h) => h.order)) + 1 : 0;

  return (
    <div className="page-pad min-h-full space-y-5">
      {isPast && <PastDateBanner date={date} />}
      {/* 헤더 */}
      <div className="space-y-4 pt-1">
        <PageHeader
          kicker={formatLongKoreanDate(date)}
          title="습관"
          summary={`${totalAchieved} / ${totalActive} 달성 · ${totalChecked} / ${totalActive} 기록`}
          action={(
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAddOpen(true)}
                className="grid h-11 w-11 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)] hover:text-[var(--leaf)]"
                aria-label="습관 추가"
                title="습관 추가"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={() => setEditMode((v) => !v)}
                className={`grid h-11 w-11 place-items-center rounded-full ${editMode ? 'bg-[var(--leaf-soft)] text-[var(--leaf)]' : 'text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)] hover:text-[var(--leaf)]'}`}
                aria-label={editMode ? '편집 완료' : '편집'}
                title={editMode ? '편집 완료' : '편집'}
              >
                {editMode ? <Check size={18} /> : <Pencil size={18} />}
              </button>
            </div>
          )}
        />
        <div>
          <ProgressRail value={totalActive > 0 ? (totalChecked / totalActive) * 100 : 0} />
          {nudge && (
            <p className={`mt-2 text-[13.5px] tracking-[-0.01em] ${remaining === 0 ? 'text-[var(--leaf)]' : 'text-[var(--fg-muted)]'}`}>
              {nudge}
            </p>
          )}
          {!editMode && totalActive === 0 && hibernatingHabits.length > 0 && (
            <p className="mt-0.5 text-xs font-medium text-[var(--fg-muted)]">
              모든 습관이 휴면 중이에요 · 편집에서 깨울 수 있어요
            </p>
          )}
        </div>
      </div>

      {/* 습관 묶음 일괄 건너뛰기 — 오늘·비편집 모드에서만. 예: 등교 안 하는 날 '학교' 묶음 한 번에 건너뛰기 */}
      {!editMode && !isPast && (() => {
        const bars = habitGroups
          .map((g) => ({ group: g, members: liveHabits.filter((h) => h.active && h.groupId === g.id) }))
          .filter(({ members }) => members.length > 0);
        if (bars.length === 0) return null;
        return (
          <div className="space-y-1.5">
            {bars.map(({ group, members }) => {
              const skipped = members.filter((h) => statusOf(checks[h.id]) === 'skipped').length;
              const allSkipped = skipped === members.length;
              return (
                <div
                  key={group.id}
                  className="flex items-center gap-2 border-y border-[var(--divider-soft)] py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--fg-primary)]">{group.name}</p>
                    <p className="text-[11px] text-[var(--fg-faint)] tabular-nums">
                      습관 {members.length}개{skipped > 0 && ` · ${skipped} 건너뜀`}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      allSkipped
                        ? bulkUnskip(group.name, members, checks)
                        : bulkSkip(group.name, members, checks)
                    }
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      allSkipped
                        ? 'bg-[var(--bg-base)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]'
                        : 'bg-[var(--leaf-soft)] text-[var(--leaf)] hover:bg-[var(--leaf)] hover:text-white'
                    }`}
                  >
                    {allSkipped ? '건너뛰기 해제' : '오늘 일괄 건너뛰기'}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* 시간대별 그룹 — 1a: 현재 시간대만 펼치고 나머지는 한 줄로 접는다.
          편집 모드에서는 전부 펼쳐야 손댈 수 있으므로 접기를 끈다. */}
      {HABIT_TIME_ORDER.map((tod) => {
        const group = groups[tod];
        if (!group || group.length === 0) return null;
        const groupAchieved = group.filter((h) => checks[h.id]?.achieved).length;
        const isNow = tod === currentTOD;
        const settled = group.every((h) => checks[h.id] !== undefined);
        const expanded = shouldExpandTimeGroup({
          editMode,
          timeOfDay: tod,
          currentTimeOfDay: currentTOD,
          manuallyOpened: openTods,
        });

        if (!expanded) {
          return (
            <button
              key={tod}
              onClick={() => setOpenTods((prev) => [...prev, tod])}
              className={cn(
                'flex w-full items-center gap-3 border-y border-[var(--divider-soft)] py-[15px] text-left transition-opacity',
                settled && 'opacity-[.62]',
              )}
            >
              <span className="flex-1 text-[15px] text-[var(--fg-primary)]">{TIME_LABELS[tod]}</span>
              <span
                className={cn(
                  'text-[13px] tabular-nums',
                  settled ? 'text-[var(--leaf)]' : 'text-[var(--fg-faint)]',
                )}
              >
                {groupAchieved} / {group.length}
              </span>
              <ChevronRight size={13} className="shrink-0 text-[var(--fg-faint)]" />
            </button>
          );
        }

        return (
          <section
            key={tod}
            ref={isNow ? nowSectionRef : undefined}
            className="flex flex-col"
          >
            <div className="flex items-center gap-3 pb-3 pt-1">
              <h3 className="flex-1 text-[16px] font-semibold text-[var(--fg-primary)]">
                {TIME_LABELS[tod]}
              </h3>
              {isNow && (
                <span className="text-[12px] leading-none text-[var(--leaf)]">
                  지금
                </span>
              )}
              <span className="text-[13px] tabular-nums text-[var(--fg-muted)]">
                {groupAchieved} / {group.length}
              </span>
            </div>
            <div className="row-divide flex flex-col border-y border-[var(--divider-soft)]">
              {group.map((habit) => (
                editMode ? (
                  <div key={habit.id} className="py-2">
                    <HabitEditRow habit={habit} groupSiblings={group} />
                  </div>
                ) : (
                  <div
                    key={habit.id}
                    data-tour={habit.id === firstTourHabitId ? 'habit-first' : undefined}
                  >
                    <HabitCard
                      habit={habit}
                      check={checks[habit.id]}
                      streak={streaks[habit.id] ?? 0}
                      isNow={isNow}
                      onScore={(score) => save(habit, score, checks[habit.id])}
                      onClear={() => clear(habit, checks[habit.id])}
                    />
                  </div>
                )
              ))}
            </div>
          </section>
        );
      })}

      {/* 휴면 중인 습관 — 편집 모드 전용. 여기서 깨운다. */}
      {editMode && hibernatingHabits.length > 0 && (
        <section className="card-flat space-y-1.5 p-3">
          <h3 className="text-sm font-medium text-[var(--fg-muted)]">휴면 중인 습관</h3>
          {hibernatingHabits.map((habit) => (
            <HabitEditRow key={habit.id} habit={habit} groupSiblings={hibernatingHabits} />
          ))}
        </section>
      )}

      {habits.length === 0 && (
        <EmptyState
          icon={Sprout}
          title="아직 습관이 없어요"
          description="기본 습관을 담아 바로 시작하거나, 우측 상단 + 로 직접 추가할 수 있어요."
          action={<SeedHabitsButton />}
        />
      )}

      <AddHabitDialog open={addOpen} onOpenChange={setAddOpen} nextOrder={nextOrder} />
    </div>
  );
}
