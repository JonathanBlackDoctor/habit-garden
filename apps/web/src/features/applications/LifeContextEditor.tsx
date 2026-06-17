import { useEffect, useState } from 'react';
import { doc, setDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { LifeContext } from 'shared/types/firestore';

/** 편집 가능한 생활 환경 필드 (LifeContext의 텍스트 항목과 1:1) */
const FIELDS: Array<{ key: keyof LifeContext; label: string; placeholder: string; rows: number }> = [
  { key: 'role',    label: '직업·신분',            placeholder: '예) 고3 수험생 · 두 아이 키우는 직장맘 · 편의점 야간 알바', rows: 1 },
  { key: 'family',  label: '가정 상황',            placeholder: '예) 부모님·동생과 함께 거주, 요즘 아버지와 자주 부딪힘', rows: 2 },
  { key: 'routine', label: '하루 일과·주요 시간대', placeholder: '예) 평일 9-18시 근무, 출퇴근 지하철 1시간, 밤 11시 취침', rows: 2 },
  { key: 'people',  label: '자주 만나는 사람',      placeholder: '예) 같은 팀 동료 3명, 주일 청년부 셀원들, 옆집 할머니', rows: 2 },
  { key: 'focus',   label: '요즘 영적 고민·바라는 변화', placeholder: '예) 쉽게 화내는 습관을 고치고 싶음, 말씀 묵상을 꾸준히', rows: 2 },
  { key: 'memo',    label: '그 밖에 (자유 메모)',   placeholder: 'AI가 알면 좋을 내용을 자유롭게 적어주세요', rows: 2 },
];

const FIELD_CLS =
  'w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--leaf)]';

/** 말씀 적용 AI가 참고할 '내 생활 환경'을 입력·수정하는 다이얼로그. */
export default function LifeContextEditor({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const uid = useAppStore((s) => s.uid);
  const saved = useAppStore((s) => s.settings?.lifeContext);
  const [draft, setDraft] = useState<LifeContext>({});
  const [saving, setSaving] = useState(false);

  // 다이얼로그를 열 때마다 저장된 값으로 초기화
  useEffect(() => {
    if (open) setDraft(saved ?? {});
  }, [open, saved]);

  const setField = (k: keyof LifeContext, v: string) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!uid || saving) return;
    setSaving(true);
    try {
      // 비운 항목은 deleteField로 실제 제거(ignoreUndefinedProperties 환경 대비)
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      for (const { key } of FIELDS) {
        const v = (draft[key] ?? '').toString().trim();
        payload[key] = v ? v.slice(0, 300) : deleteField();
      }
      await setDoc(
        doc(db, 'users', uid, 'settings', 'main'),
        { lifeContext: payload, updatedAt: serverTimestamp() },
        { merge: true },
      );
      toast('🌿 생활 환경을 저장했어요', { description: 'AI가 이제 더 구체적으로 적용을 추천해요' });
      onOpenChange(false);
    } catch {
      toast.error('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Sparkles size={16} className="text-[var(--leaf)]" /> 내 생활 환경
          </DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-xs leading-snug text-[var(--fg-muted)]">
          AI가 말씀 적용을 정리할 때 참고해요. 아는 만큼만 적어도 되고, 채울수록 내 삶에
          더 와닿는 적용이 나와요. 이 내용은 나만 볼 수 있어요.
        </p>
        <div className="mt-1 space-y-3">
          {FIELDS.map(({ key, label, placeholder, rows }) => (
            <label key={key} className="block space-y-1">
              <span className="text-xs font-medium text-[var(--fg-muted)]">{label}</span>
              <textarea
                value={(draft[key] as string) ?? ''}
                onChange={(e) => setField(key, e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className={cn(FIELD_CLS, 'resize-none')}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--fg-muted)]"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full bg-[var(--leaf)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : '저장'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
