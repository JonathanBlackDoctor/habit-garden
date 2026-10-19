import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { HabitCheckDoc, HabitDoc } from 'shared/types/firestore';

const SCORE_LABELS = ['매우 부족', '부족', '보통', '양호', '우수'];

export default function HabitCheckEditor({ habit, check, dateLabel, open, onClose, onSave, onClear }: {
  habit: HabitDoc;
  check?: HabitCheckDoc;
  dateLabel: string;
  open: boolean;
  onClose: () => void;
  onSave: (score: number | null) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const commit = async (score: number | null | 'clear') => {
    if (saving) return;
    setSaving(true);
    try {
      if (score === 'clear') await onClear();
      else await onSave(score);
      onClose();
    } catch {
      toast.error('저장하지 못했어요. 다시 시도해 주세요.');
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value && !saving) onClose(); }}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[380px] space-y-5 p-4 sm:p-6" aria-describedby="habit-check-description">
        <DialogHeader>
          <p className="kicker">{dateLabel}</p>
          <DialogTitle className="pr-8 text-xl">{habit.title}</DialogTitle>
        </DialogHeader>
        <p id="habit-check-description" className="text-sm text-[var(--fg-muted)]">
          {habit.scoreMode === 'scaled' ? '실천을 1~5점으로 남겨주세요.' : '이날의 실천을 기록해 주세요.'}
        </p>
        <div className={cn('grid gap-2', habit.scoreMode === 'scaled' ? 'grid-cols-5' : 'grid-cols-2')}>
          {(habit.scoreMode === 'scaled' ? [1, 2, 3, 4, 5] : [1, 0]).map((score) => (
            <button key={score} type="button" disabled={saving} aria-pressed={check?.score === score}
              aria-label={habit.scoreMode === 'scaled' ? `${score}점 · ${SCORE_LABELS[score - 1]}` : score ? '완료' : '미완료'}
              onClick={() => commit(score)}
              className={cn('min-h-12 rounded-xl border px-1 py-3 text-base font-semibold transition-colors disabled:opacity-50',
                check?.score === score ? 'border-[var(--leaf)] bg-[var(--leaf)] text-white' : 'border-[var(--divider-soft)] bg-[var(--bg-base)] text-[var(--fg-primary)] hover:border-[var(--leaf)]')}>
              {habit.scoreMode === 'scaled' ? score : score ? '완료' : '미완료'}
            </button>
          ))}
        </div>
        {habit.scoreMode === 'scaled' && <div className="flex justify-between text-xs text-[var(--fg-faint)]"><span>조금 실천했어요</span><span>충분히 실천했어요</span></div>}
        <div className="flex gap-2 border-t border-[var(--divider-soft)] pt-4">
          <button type="button" disabled={saving} onClick={() => commit(null)} className="min-h-11 flex-1 rounded-xl bg-[var(--leaf-soft)] px-3 text-sm text-[var(--leaf)] disabled:opacity-50">건너뜀</button>
          {check && <button type="button" disabled={saving} onClick={() => commit('clear')} className="min-h-11 flex-1 rounded-xl border border-[var(--divider-soft)] px-3 text-sm text-[var(--fg-muted)] disabled:opacity-50">기록 지우기</button>}
        </div>
        {check?.note && <p className="rounded-xl bg-[var(--bg-base)] p-3 text-xs leading-relaxed text-[var(--fg-muted)]">메모 · {check.note}</p>}
        <p role="status" className="text-xs text-[var(--fg-faint)]">{saving ? '저장 중…' : '점수를 바꿔도 메모는 유지돼요.'}</p>
      </DialogContent>
    </Dialog>
  );
}
