import { useAppStore } from '@/lib/store';
import { useHabits, useHabitChecks, useSaveHabitCheck } from '@/features/habits/useHabits';
import HabitCard from '@/features/habits/HabitCard';
import type { HabitDoc } from 'shared/types/firestore';

const TIME_LABELS: Record<string, string> = {
  morning:   '🌅 아침',
  afternoon: '☀️ 점심',
  evening:   '🌆 저녁',
  night:     '🌙 밤',
  anytime:   '🕐 언제든',
};
const TIME_ORDER = ['morning', 'afternoon', 'evening', 'night', 'anytime'];

function groupByTime(habits: HabitDoc[]) {
  const groups: Record<string, HabitDoc[]> = {};
  for (const h of habits) {
    if (!groups[h.timeOfDay]) groups[h.timeOfDay] = [];
    groups[h.timeOfDay].push(h);
  }
  return groups;
}

export default function Habits() {
  const date   = useAppStore((s) => s.currentDate);
  const habits = useHabits();
  const checks = useHabitChecks(date);
  const save   = useSaveHabitCheck();

  const groups = groupByTime(habits);
  const totalActive    = habits.length;
  const totalAchieved  = Object.values(checks).filter((c) => c.achieved).length;
  const totalChecked   = Object.values(checks).filter((c) => c.score !== null).length;

  return (
    <div className="min-h-screen p-4 space-y-4 pb-8">
      {/* 헤더 */}
      <div className="pt-2">
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">습관 체크</h2>
        <p className="text-sm text-[var(--fg-muted)]">
          달성 {totalAchieved}/{totalActive} · 체크 {totalChecked}/{totalActive}
        </p>
      </div>

      {/* 시간대별 그룹 */}
      {TIME_ORDER.map((tod) => {
        const group = groups[tod];
        if (!group || group.length === 0) return null;
        const groupAchieved = group.filter((h) => checks[h.id]?.achieved).length;
        return (
          <section key={tod} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--fg-muted)]">{TIME_LABELS[tod]}</h3>
              <span className="text-xs text-[var(--fg-faint)] tabular-nums">{groupAchieved}/{group.length}</span>
            </div>
            {group.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                check={checks[habit.id]}
                onScore={(score) => save(habit, score)}
              />
            ))}
          </section>
        );
      })}

      {habits.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-[var(--fg-faint)]">
          <p className="text-sm">습관이 없습니다.</p>
          <p className="text-xs">관리 페이지에서 시드 습관을 추가하세요.</p>
        </div>
      )}
    </div>
  );
}
