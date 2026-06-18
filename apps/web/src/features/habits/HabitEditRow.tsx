import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { Switch } from '@/components/ui/switch';
import { ChevronUp, ChevronDown, Trash2, Moon, Sunrise } from 'lucide-react';
import type { HabitDoc } from 'shared/types/firestore';
import { isHibernating } from 'shared/lib/hibernation';
import { useHabitGroups, useHabitGroupActions } from '@/features/habits/useHabitGroups';
import { toast } from 'sonner';

const TIME_OPTIONS: Array<HabitDoc['timeOfDay']> = [
  'morning', 'afternoon', 'evening', 'night', 'anytime',
];
const TIME_LABEL: Record<string, string> = {
  morning: '아침', afternoon: '점심', evening: '저녁', night: '밤', anytime: '언제든',
};

interface Props {
  habit: HabitDoc;
  groupSiblings: HabitDoc[]; // 같은 timeOfDay 그룹, order 정렬
}

export default function HabitEditRow({ habit, groupSiblings }: Props) {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const hibernating = isHibernating(habit);
  const groups = useHabitGroups();
  const { addGroup, assignHabit } = useHabitGroupActions();

  const onGroupChange = async (value: string) => {
    if (value === '__none') { await assignHabit(habit.id, null); return; }
    if (value === '__new') {
      const name = prompt('새 습관 묶음 이름 (예: 학교)');
      if (!name?.trim()) return;
      const id = await addGroup(name);
      if (id) await assignHabit(habit.id, id);
      return;
    }
    await assignHabit(habit.id, value);
  };

  const updateField = async (patch: Partial<HabitDoc>) => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'users', uid, 'habits', habit.id), patch as any);
    } catch {
      toast.error('업데이트 실패');
    }
  };

  // 휴면 시작 — 깨울 때까지 일일 목록에서 빠진다. 자동 복귀 없음(수동으로만 깨움).
  const startHibernate = async () => {
    await updateField({ hibernatedSince: today, hibernatedUntil: null });
    toast(`🌙 ${habit.title} 휴면`, { description: '깨울 때까지 쉬어요' });
  };

  // 깨우기 — 종료일을 기록(since는 유지)해 스트릭 브리지 구간을 보존한다.
  const wake = async () => {
    await updateField({ hibernatedUntil: today });
    toast(`☀️ ${habit.title} 다시 시작!`);
  };

  const remove = async () => {
    if (!uid) return;
    if (!confirm(`"${habit.title}" 습관을 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'users', uid, 'habits', habit.id));
    } catch {
      toast.error('삭제 실패');
    }
  };

  const swapOrder = async (dir: -1 | 1) => {
    if (!uid) return;
    const idx = groupSiblings.findIndex((h) => h.id === habit.id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= groupSiblings.length) return;
    const other = groupSiblings[targetIdx];
    try {
      await Promise.all([
        updateDoc(doc(db, 'users', uid, 'habits', habit.id), { order: other.order }),
        updateDoc(doc(db, 'users', uid, 'habits', other.id), { order: habit.order }),
      ]);
    } catch {
      toast.error('순서 변경 실패');
    }
  };

  const idx = groupSiblings.findIndex((h) => h.id === habit.id);
  const canUp = idx > 0;
  const canDown = idx >= 0 && idx < groupSiblings.length - 1;

  return (
    <div
      className={`card p-2 flex flex-col gap-2 ${habit.active && !hibernating ? '' : 'opacity-60'}`}
      style={{ background: 'rgba(255,255,255,0.85)' }}
    >
      {hibernating && (
        <span className="self-start rounded-full bg-[var(--leaf-soft)] px-2 py-0.5 text-[11px] text-[var(--leaf)]">
          🌙 휴면 중
        </span>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          defaultValue={habit.title}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== habit.title) updateField({ title: v });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="flex-1 min-w-0 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-sm text-[var(--fg-primary)] focus:border-[var(--leaf)] focus:outline-none"
          placeholder="습관 이름"
        />
        <Switch
          checked={habit.active}
          onCheckedChange={(v) => updateField({ active: v })}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1 text-[11px] text-[var(--fg-muted)]">
          중요도
          <input
            type="number"
            min={1}
            max={10}
            defaultValue={habit.weight}
            onBlur={(e) => {
              const n = Math.max(1, Math.min(10, Number(e.target.value) || habit.weight));
              if (n !== habit.weight) updateField({ weight: n });
            }}
            className="w-14 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-xs tabular-nums text-[var(--fg-primary)] focus:border-[var(--leaf)] focus:outline-none"
          />
        </label>

        <select
          value={habit.timeOfDay}
          onChange={(e) => updateField({ timeOfDay: e.target.value as HabitDoc['timeOfDay'] })}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-xs text-[var(--fg-primary)] focus:border-[var(--leaf)] focus:outline-none"
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>{TIME_LABEL[t]}</option>
          ))}
        </select>

        <select
          value={habit.scoreMode}
          onChange={(e) => {
            const scoreMode = e.target.value as HabitDoc['scoreMode'];
            // 척도 전환 시 임계값도 함께 맞춘다 — scaled는 3(1·2점 미달성, 3점부터 달성), binary는 1
            updateField({ scoreMode, achieveThreshold: scoreMode === 'scaled' ? 3 : 1 });
          }}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-xs text-[var(--fg-primary)] focus:border-[var(--leaf)] focus:outline-none"
        >
          <option value="binary">완료형</option>
          <option value="scaled">5점</option>
        </select>

        <select
          value={habit.groupId ?? '__none'}
          onChange={(e) => onGroupChange(e.target.value)}
          title="습관 묶음 (일괄 건너뛰기 단위)"
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-xs text-[var(--fg-primary)] focus:border-[var(--leaf)] focus:outline-none"
        >
          <option value="__none">묶음 없음</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
          <option value="__new">+ 새 묶음…</option>
        </select>

        <div className="ml-auto flex items-center gap-1">
          {hibernating ? (
            <button
              onClick={wake}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-fulltext-[var(--bloom)] hover:bg-[var(--leaf-soft)]"
              aria-label="깨우기"
              title="깨우기"
            >
              <Sunrise size={16} />
            </button>
          ) : (
            <button
              onClick={startHibernate}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-fulltext-[var(--fg-muted)] hover:bg-[var(--leaf-soft)] hover:text-[var(--leaf)]"
              aria-label="휴면"
              title="휴면 (잠시 쉬기)"
            >
              <Moon size={16} />
            </button>
          )}
          <button
            onClick={() => swapOrder(-1)}
            disabled={!canUp}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-fulltext-[var(--fg-muted)] hover:bg-[var(--leaf-soft)] disabled:opacity-30"
            aria-label="위로"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={() => swapOrder(1)}
            disabled={!canDown}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-fulltext-[var(--fg-muted)] hover:bg-[var(--leaf-soft)] disabled:opacity-30"
            aria-label="아래로"
          >
            <ChevronDown size={16} />
          </button>
          <button
            onClick={remove}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-fulltext-red-400 hover:bg-red-50 hover:text-red-500"
            aria-label="삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
