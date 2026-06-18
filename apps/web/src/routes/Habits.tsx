import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, animate } from 'framer-motion';
import { addDoc, collection, updateDoc } from 'firebase/firestore';
import { Pencil, Check, Plus, Settings, Sprout } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import EmptyState from '@/components/EmptyState';
import SeedHabitsButton from '@/features/habits/SeedHabitsButton';
import { useHabits, useHabitChecks, useSaveHabitCheck, useClearHabitCheck } from '@/features/habits/useHabits';
import { useHabitGroups, useBulkSkip } from '@/features/habits/useHabitGroups';
import { useHabitStreaks } from '@/features/habits/useHabitStreaks';
import { statusOf } from '@/features/habits/habitStatus';
import HabitCard from '@/features/habits/HabitCard';
import HabitEditRow from '@/features/habits/HabitEditRow';
import PastDateBanner from '@/components/PastDateBanner';
import type { HabitDoc } from 'shared/types/firestore';
import { isHibernating } from 'shared/lib/hibernation';
import { timeOfDay } from '@/lib/dayBoundary';
import { useTabBloomKey } from '@/lib/tabActive';

const TIME_LABELS: Record<string, string> = {
  morning:   '🌅 아침',
  afternoon: '☀️ 점심',
  evening:   '🌆 저녁',
  night:     '🌙 밤',
  anytime:   '🕐 언제든',
};
const TIME_ORDER = ['morning', 'afternoon', 'evening', 'night', 'anytime'];

// 시간대별 배경 그라데이션 (Phase 1-4)
const TIME_GRADIENTS: Record<string, string> = {
  morning:   'linear-gradient(180deg, #FFF6E5 0%, #FFE9C2 100%)',
  afternoon: 'linear-gradient(180deg, #FFF8D6 0%, #FFE6A0 100%)',
  evening:   'linear-gradient(180deg, #FFDCC0 0%, #FFB497 100%)',
  night:     'linear-gradient(180deg, #2A2F4A 0%, #1A1F36 100%)',
  anytime:   'linear-gradient(180deg, #E8F0F8 0%, #D2E1F0 100%)',
};
// 미달성 상태 시 흐릿하게
const TIME_GRADIENTS_DIM: Record<string, string> = {
  morning:   'linear-gradient(180deg, #F2EFE6 0%, #E8E1D0 100%)',
  afternoon: 'linear-gradient(180deg, #F0EDE0 0%, #E6DFC8 100%)',
  evening:   'linear-gradient(180deg, #ECE2D9 0%, #D9C8BC 100%)',
  night:     'linear-gradient(180deg, #2B2E3B 0%, #1F2230 100%)',
  anytime:   'linear-gradient(180deg, #ECECEC 0%, #DCDCDC 100%)',
};

function groupByTime(habits: HabitDoc[]) {
  const groups: Record<string, HabitDoc[]> = {};
  for (const h of habits) {
    if (!groups[h.timeOfDay]) groups[h.timeOfDay] = [];
    groups[h.timeOfDay].push(h);
  }
  return groups;
}

export default function Habits() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uid    = useAppStore((s) => s.uid);
  const today  = useAppStore((s) => s.currentDate);
  const dateParam = searchParams.get('date');
  const date   = dateParam ?? today;
  const isPast = !!dateParam && dateParam !== today;
  const [editMode, setEditMode] = useState(false);
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
  const groups = groupByTime(liveHabits);
  // 온보딩 스포트라이트가 가리킬 첫 습관 카드 (TIME_ORDER 기준 최상단)
  const firstTourHabitId = TIME_ORDER.map((t) => groups[t]?.[0]).find(Boolean)?.id;
  const activeHabits   = liveHabits.filter((h) => h.active);
  const totalActive    = activeHabits.length;
  const totalAchieved  = activeHabits.filter((h) => checks[h.id]?.achieved).length;
  const totalChecked   = activeHabits.filter((h) => checks[h.id]?.score !== undefined && checks[h.id]?.score !== null).length;
  const currentTOD     = timeOfDay();
  // 미기록(체크 문서 없음) 습관 수 — 격려 넛지용
  const remaining      = activeHabits.filter((h) => checks[h.id] === undefined).length;
  const nudge =
    totalActive === 0 ? null
    : remaining === 0 ? '오늘 다 했어요 🌱'
    : remaining === 1 ? '딱 하나만 더!'
    : remaining <= 3  ? `거의 다 왔어요 · ${remaining}개 남음`
    : `오늘 ${remaining}개 남았어요`;

  const addNewHabit = async () => {
    if (!uid) return;
    try {
      const nextOrder = habits.length > 0 ? Math.max(...habits.map((h) => h.order)) + 1 : 0;
      const ref = await addDoc(collection(db, 'users', uid, 'habits'), {
        id: '',
        title: '새 습관',
        weight: 5,
        timeOfDay: 'anytime',
        order: nextOrder,
        scoreMode: 'binary',
        achieveThreshold: 1,
        iconName: 'leaf',
        active: true,
      });
      await updateDoc(ref, { id: ref.id });
      setEditMode(true);
      toast('새 습관 추가됨');
    } catch {
      toast.error('습관 추가 실패');
    }
  };

  return (
    <div className="min-h-screen p-4 space-y-4 pb-8">
      {isPast && <PastDateBanner date={date} />}
      {/* 헤더 */}
      <div className="pt-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--fg-primary)]">습관 체크</h2>
          <p className="text-sm text-[var(--fg-muted)]">
            달성 {totalAchieved}/{totalActive} · 체크 {totalChecked}/{totalActive}
          </p>
          {nudge && (
            <p className={`mt-0.5 text-xs font-medium ${remaining === 0 ? 'text-[var(--leaf)]' : 'text-[var(--bloom)]'}`}>
              {nudge}
            </p>
          )}
          {!editMode && totalActive === 0 && hibernatingHabits.length > 0 && (
            <p className="mt-0.5 text-xs font-medium text-[var(--fg-muted)]">
              모든 습관이 휴면 중이에요 🌙 · 편집에서 깨울 수 있어요
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={addNewHabit}
            className="rounded-full p-1.5 text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)] hover:text-[var(--leaf)]"
            aria-label="습관 추가"
            title="습관 추가"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`rounded-full p-1.5 ${editMode ? 'bg-[var(--leaf-soft)] text-[var(--leaf)]' : 'text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)] hover:text-[var(--leaf)]'}`}
            aria-label={editMode ? '편집 완료' : '편집'}
            title={editMode ? '편집 완료' : '편집'}
          >
            {editMode ? <Check size={18} /> : <Pencil size={18} />}
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="rounded-full p-1.5 text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)] hover:text-[var(--leaf)]"
            aria-label="관리"
            title="관리 페이지"
          >
            <Settings size={18} />
          </button>
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
                  className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--bg-surface)] px-3 py-2 shadow-[var(--shadow-sm)]"
                >
                  <span className="text-base">🎒</span>
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

      {/* 시간대별 그룹 */}
      {TIME_ORDER.map((tod) => {
        const group = groups[tod];
        if (!group || group.length === 0) return null;
        const groupAchieved = group.filter((h) => checks[h.id]?.achieved).length;
        const ratio = group.length > 0 ? groupAchieved / group.length : 0;
        const isNow = tod === currentTOD;
        const bgFull = TIME_GRADIENTS[tod];
        const bgDim  = TIME_GRADIENTS_DIM[tod];
        // 달성률이 0이면 dim, 100%면 full, 중간은 보간 — 단순화: 50% 임계
        const bg = ratio >= 0.5 ? bgFull : bgDim;
        const isNight = tod === 'night';
        return (
          <section
            key={tod}
            ref={isNow ? nowSectionRef : undefined}
            className="space-y-1.5 rounded-[var(--radius-lg)] p-2.5 transition-all"
            style={{
              background: bg,
              boxShadow: isNow ? '0 0 0 2px var(--leaf), 0 6px 20px -8px var(--leaf)' : undefined,
            }}
          >
            <div className="flex items-center justify-between">
              <h3
                className="text-sm font-medium"
                style={{ color: isNight ? '#E5E7EB' : 'var(--fg-primary)' }}
              >
                {TIME_LABELS[tod]} {isNow && <span className="ml-1 text-[10px] text-[var(--bloom)]">지금</span>}
              </h3>
              <span
                className="text-xs tabular-nums"
                style={{ color: isNight ? '#D1D5DB' : 'var(--fg-muted)' }}
              >
                {groupAchieved}/{group.length}
              </span>
            </div>
            {(() => {
              const cards = group.map((habit) => (
                editMode ? (
                  <HabitEditRow
                    key={habit.id}
                    habit={habit}
                    groupSiblings={group}
                  />
                ) : (
                  <div key={habit.id} data-tour={habit.id === firstTourHabitId ? 'habit-first' : undefined}>
                    <HabitCard
                      habit={habit}
                      check={checks[habit.id]}
                      streak={streaks[habit.id] ?? 0}
                      isNow={isNow}
                      onScore={(score) => save(habit, score, checks[habit.id], streaks[habit.id] ?? 0)}
                      onClear={() => clear(habit, checks[habit.id])}
                    />
                  </div>
                )
              ));
              // 현재 시간대 그룹은 탭 진입/재탭 시 살짝 확대되며 강조
              return isNow && !editMode ? (
                <motion.div
                  key={bloomKey}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 0.7, times: [0, 0.4, 1], ease: 'easeOut', delay: 0.15 }}
                  style={{ transformOrigin: 'center' }}
                  className="space-y-1.5"
                >
                  {cards}
                </motion.div>
              ) : (
                cards
              );
            })()}
          </section>
        );
      })}

      {/* 휴면 중인 습관 — 편집 모드 전용. 여기서 깨운다. */}
      {editMode && hibernatingHabits.length > 0 && (
        <section className="space-y-1.5 rounded-[var(--radius-lg)] bg-[var(--bg-surface)] p-2.5">
          <h3 className="text-sm font-medium text-[var(--fg-muted)]">🌙 휴면 중인 습관</h3>
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
    </div>
  );
}
