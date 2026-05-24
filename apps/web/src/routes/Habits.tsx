import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDoc, collection, updateDoc } from 'firebase/firestore';
import { Pencil, Check, Plus, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useHabits, useHabitChecks, useSaveHabitCheck } from '@/features/habits/useHabits';
import HabitCard from '@/features/habits/HabitCard';
import HabitEditRow from '@/features/habits/HabitEditRow';
import PastDateBanner from '@/components/PastDateBanner';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uid    = useAppStore((s) => s.uid);
  const today  = useAppStore((s) => s.currentDate);
  const dateParam = searchParams.get('date');
  const date   = dateParam ?? today;
  const isPast = !!dateParam && dateParam !== today;
  const [editMode, setEditMode] = useState(false);
  const habits = useHabits({ includeInactive: editMode });
  const checks = useHabitChecks(date);
  const save   = useSaveHabitCheck(isPast ? date : undefined);

  const groups = groupByTime(habits);
  const activeHabits   = habits.filter((h) => h.active);
  const totalActive    = activeHabits.length;
  const totalAchieved  = activeHabits.filter((h) => checks[h.id]?.achieved).length;
  const totalChecked   = activeHabits.filter((h) => checks[h.id]?.score !== undefined && checks[h.id]?.score !== null).length;
  const currentTOD     = timeOfDay();

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
            className="space-y-1.5 rounded-[var(--radius-lg)] p-2.5 transition-all"
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
              editMode ? (
                <HabitEditRow
                  key={habit.id}
                  habit={habit}
                  groupSiblings={group}
                />
              ) : (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  check={checks[habit.id]}
                  onScore={(score) => save(habit, score)}
                />
              )
            ))}
          </section>
        );
      })}

      {habits.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-[var(--fg-faint)]">
          <p className="text-sm">습관이 없습니다.</p>
          <p className="text-xs">우측 상단 + 버튼으로 추가하거나, ⚙ 관리에서 시드를 불러오세요.</p>
        </div>
      )}
    </div>
  );
}
