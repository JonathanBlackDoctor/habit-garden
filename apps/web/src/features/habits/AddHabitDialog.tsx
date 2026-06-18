import { useState } from 'react';
import { addDoc, collection, updateDoc } from 'firebase/firestore';
import { Sunrise, Sun, Sunset, Moon, Clock, ChevronDown, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useHabitGroups } from '@/features/habits/useHabitGroups';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { HabitDoc } from 'shared/types/firestore';

const TIME_OPTIONS: Array<{ id: HabitDoc['timeOfDay']; label: string; icon: LucideIcon }> = [
  { id: 'morning',   label: '아침',   icon: Sunrise },
  { id: 'afternoon', label: '점심',   icon: Sun },
  { id: 'evening',   label: '저녁',   icon: Sunset },
  { id: 'night',     label: '밤',     icon: Moon },
  { id: 'anytime',   label: '언제든', icon: Clock },
];

/**
 * 새 습관 추가 — 초보자도 막힘 없이 쓰도록 핵심 3가지(이름·시간대·유형)만 먼저 받고,
 * 중요도·묶음 등 세부는 '고급 설정'으로 접어 둔다. (편집은 기존 인라인 편집에서)
 */
export default function AddHabitDialog({
  open, onOpenChange, nextOrder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nextOrder: number;
}) {
  const uid = useAppStore((s) => s.uid);
  const groups = useHabitGroups();
  const [title, setTitle] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<HabitDoc['timeOfDay']>('anytime');
  const [scoreMode, setScoreMode] = useState<HabitDoc['scoreMode']>('binary');
  const [weight, setWeight] = useState(5);
  const [groupId, setGroupId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle(''); setTimeOfDay('anytime'); setScoreMode('binary');
    setWeight(5); setGroupId(''); setShowAdvanced(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const submit = async () => {
    if (!uid || saving) return;
    const t = title.trim();
    if (!t) { toast.error('습관 이름을 입력해 주세요'); return; }
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'users', uid, 'habits'), {
        id: '',
        title: t,
        weight,
        timeOfDay,
        order: nextOrder,
        scoreMode,
        achieveThreshold: scoreMode === 'scaled' ? 3 : 1,
        iconName: 'leaf',
        active: true,
        groupId: groupId || null,
      });
      await updateDoc(ref, { id: ref.id });
      toast.success('습관을 추가했어요 🌱');
      reset();
      onOpenChange(false);
    } catch {
      toast.error('습관 추가 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm space-y-4">
        <DialogHeader>
          <DialogTitle>새 습관 추가</DialogTitle>
        </DialogHeader>

        {/* 이름 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--fg-muted)]">이름</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="예: 아침 산책"
            maxLength={40}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-faint)] focus:border-[var(--leaf)] focus:outline-none"
          />
        </div>

        {/* 시간대 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--fg-muted)]">시간대</label>
          <div className="grid grid-cols-5 gap-1.5">
            {TIME_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTimeOfDay(id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-[var(--radius-sm)] border py-2 text-[11px] font-medium transition-colors active:scale-95',
                  timeOfDay === id
                    ? 'border-[var(--leaf)] bg-[var(--leaf-soft)] text-[var(--leaf)]'
                    : 'border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)]/50',
                )}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 유형 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--fg-muted)]">유형</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { mode: 'binary', label: '완료형',   desc: '했다 / 안 했다' },
              { mode: 'scaled', label: '5점 척도', desc: '1~5점으로 평가' },
            ] as const).map(({ mode, label, desc }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setScoreMode(mode)}
                className={cn(
                  'rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors active:scale-95',
                  scoreMode === mode
                    ? 'border-[var(--leaf)] bg-[var(--leaf-soft)]'
                    : 'border-[var(--border)] hover:bg-[var(--leaf-soft)]/50',
                )}
              >
                <p className={cn('text-sm font-medium', scoreMode === mode ? 'text-[var(--leaf)]' : 'text-[var(--fg-primary)]')}>{label}</p>
                <p className="text-[11px] text-[var(--fg-faint)]">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 고급 설정 (접힘) */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-[var(--fg-muted)]"
          >
            고급 설정
            <ChevronDown size={14} className={cn('transition-transform', showAdvanced && 'rotate-180')} />
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-[var(--fg-muted)]">
                  중요도 <span className="text-[var(--fg-faint)]">1~10</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={weight}
                  onChange={(e) => setWeight(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="w-16 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-sm tabular-nums text-[var(--fg-primary)] focus:border-[var(--leaf)] focus:outline-none"
                />
              </div>
              {groups.length > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-medium text-[var(--fg-muted)]">묶음</label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-sm text-[var(--fg-primary)] focus:border-[var(--leaf)] focus:outline-none"
                  >
                    <option value="">묶음 없음</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 액션 */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-base)]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !title.trim()}
            className="flex-1 rounded-[var(--radius-sm)] bg-[var(--leaf)] py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? '추가 중…' : '추가'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
