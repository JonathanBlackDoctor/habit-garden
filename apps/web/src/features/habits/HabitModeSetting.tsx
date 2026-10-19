import { useId, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/lib/store';
import { setWeeklyHabitMode, useWeeklyHabitMode } from '@/lib/features';

export default function HabitModeSetting() {
  const id = useId();
  const uid = useAppStore((s) => s.realUid);
  const enabled = useWeeklyHabitMode();
  const [saving, setSaving] = useState(false);
  const toggle = async (next: boolean) => {
    if (!uid || saving) return;
    setSaving(true);
    try {
      await setWeeklyHabitMode(uid, next);
      toast.success(next ? '주간 습관 모드를 켰어요' : '기존 습관 방식으로 돌아왔어요');
    } catch {
      toast.error('설정을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally { setSaving(false); }
  };
  return (
    <section className="rounded-[14px] border border-[var(--divider-soft)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-3">
        <CalendarDays size={18} className="shrink-0 text-[var(--leaf)]" />
        <label htmlFor={id} className="flex-1 cursor-pointer text-sm font-medium text-[var(--fg-primary)]">주간 습관 모드</label>
        <Switch id={id} checked={enabled} disabled={saving || !uid} onCheckedChange={toggle} aria-describedby={`${id}-description`} />
      </div>
      <p id={`${id}-description`} className="mt-3 text-xs leading-relaxed text-[var(--fg-muted)]">
        주간 기록표와 1~5점 바로 선택을 사용해요. 끄면 기존 화면과 입력 방식으로 돌아가며, 기록은 그대로 유지돼요.
      </p>
      {saving && <p role="status" className="mt-2 text-xs text-[var(--fg-faint)]">설정 저장 중…</p>}
    </section>
  );
}
