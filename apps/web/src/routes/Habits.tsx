import { useAppStore } from '@/lib/store';
import { useHabits, useHabitChecks, useSaveHabitCheck } from '@/features/habits/useHabits';
import HabitCard from '@/features/habits/HabitCard';
import type { HabitDoc } from 'shared/types/firestore';
import { timeOfDay } from '@/lib/dayBoundary';

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
  const date   = useAppStore((s) => s.currentDate);
  const habits = useHabits();
  const checks = useHabitChecks(date);
  const save   = useSaveHabitCheck();

  const groups = groupByTime(habits);
  const totalActive    = habits.length;
  const totalAchieved  = Object.values(checks).filter((c) => c.achieved).length;
  const totalChecked   = Object.values(checks).filter((c) => c.score !== null).length;
  const currentTOD     = timeOfDay();

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
            className="space-y-2 rounded-[var(--radius-lg)] p-3 transition-all"
            style={{
              background: bg,
              boxShadow: isNow ? '0 0 0 2px var(--leaf-soft)' : undefined,
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
