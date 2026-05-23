import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type { PrayerDoc } from 'shared/types/firestore';
import { usePrayerActions } from './usePrayers';
import { Copy, Loader2, Merge } from 'lucide-react';
import { toast } from 'sonner';

interface DupGroup {
  ids: string[];
  reason: string;
}

/** AI로 활성 기도제목의 중복을 찾아 병합 제안 (A3) */
export function DuplicateFinder({
  prayers, onOpen,
}: {
  prayers: PrayerDoc[];
  onOpen: (p: PrayerDoc) => void;
}) {
  const { mergePrayers } = usePrayerActions();
  const [scanning, setScanning] = useState(false);
  const [merging, setMerging] = useState<number | null>(null);
  const [groups, setGroups] = useState<DupGroup[] | null>(null);

  const byId = new Map(prayers.map((p) => [p.id, p] as const));

  const scan = async () => {
    if (scanning) return;
    if (prayers.length < 2) { toast('비교할 기도제목이 충분하지 않아요.'); return; }
    setScanning(true);
    try {
      const fn = httpsCallable(functions, 'findDuplicatePrayers');
      const res: any = await fn({});
      const found: DupGroup[] = (res.data?.groups ?? [])
        .map((g: any) => ({
          ids: (g.ids ?? []).filter((id: string) => byId.has(id)),
          reason: g.reason ?? '',
        }))
        .filter((g: DupGroup) => g.ids.length >= 2);
      setGroups(found);
      if (found.length === 0) toast('중복으로 보이는 기도제목이 없어요. 👍');
    } catch (e: any) {
      toast.error('중복 분석 실패: ' + (e?.message ?? '알 수 없는 오류'));
    } finally {
      setScanning(false);
    }
  };

  const merge = async (gi: number) => {
    const g = groups?.[gi];
    if (!g) return;
    setMerging(gi);
    try {
      await mergePrayers(g.ids);
      setGroups((prev) => (prev ? prev.filter((_, i) => i !== gi) : prev));
    } catch {
      toast.error('병합 실패');
    } finally {
      setMerging(null);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={scan}
        disabled={scanning}
        className="flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--fg-muted)] disabled:opacity-50"
      >
        {scanning
          ? <><Loader2 size={13} className="animate-spin" /> 분석 중…</>
          : <><Copy size={13} /> 중복 찾기</>}
      </button>

      {groups?.map((g, gi) => (
        <div key={gi} className="rounded-[var(--radius)] border border-amber-300 bg-amber-50 p-2.5 space-y-2">
          <p className="text-[11px] text-amber-700">{g.reason}</p>
          <div className="space-y-1">
            {g.ids.map((id) => {
              const p = byId.get(id);
              if (!p) return null;
              return (
                <button
                  key={id}
                  onClick={() => onOpen(p)}
                  className="block w-full truncate rounded bg-white px-2 py-1 text-left text-xs text-[var(--fg-primary)]"
                >
                  {p.personName && <span className="text-[var(--fg-faint)]">{p.personName} · </span>}
                  {p.title}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => merge(gi)}
            disabled={merging === gi}
            className="flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--leaf)] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {merging === gi
              ? <><Loader2 size={13} className="animate-spin" /> 합치는 중…</>
              : <><Merge size={13} /> {g.ids.length}개를 하나로 합치기</>}
          </button>
        </div>
      ))}
    </div>
  );
}
