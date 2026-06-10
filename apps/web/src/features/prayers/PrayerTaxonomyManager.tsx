import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePrayers, usePrayerGroups, usePrayerTargets, usePrayerActions } from './usePrayers';
import { DEFAULT_PRAYER_GROUPS, DEFAULT_PRAYER_TARGETS } from 'shared/types/firestore';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Kind = 'group' | 'target';

/**
 * 기도 분류 관리 — 모임/대상 이름 변경·병합·정리.
 * 자유 문자열이라 표기가 분화되면("청년부"/"청년부 모임") 여기서 합친다.
 */
export default function PrayerTaxonomyManager({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const prayers = usePrayers();           // 전체 status — answered/dormant 포함해 변경해야 한다
  const knownGroups = usePrayerGroups();
  const knownTargets = usePrayerTargets();
  const { renameTaxonomy, removeTaxonomyEntry } = usePrayerActions();
  const [kind, setKind] = useState<Kind>('group');
  const [busy, setBusy] = useState(false);

  const fallback = kind === 'group' ? '개인' : '나 자신';
  const known = kind === 'group' ? knownGroups : knownTargets;
  const defaults: readonly string[] = kind === 'group' ? DEFAULT_PRAYER_GROUPS : DEFAULT_PRAYER_TARGETS;

  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of prayers) {
      const name = (kind === 'group' ? p.group : p.target) || fallback;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const names = Array.from(new Set([...known, ...counts.keys()]));
    return names
      .map((name) => ({
        name,
        count: counts.get(name) ?? 0,
        isDefault: defaults.includes(name),
      }))
      .sort((a, b) => b.count - a.count);
  }, [prayers, kind, known, defaults, fallback]);

  const rename = async (name: string) => {
    if (busy) return;
    const input = prompt(`'${name}'의 새 이름을 입력하세요.\n기존 이름을 입력하면 그 이름으로 병합됩니다.`, name);
    const next = input?.trim();
    if (!next || next === name) return;
    const exists = rows.some((r) => r.name === next);
    if (exists && !confirm(`'${next}'이(가) 이미 있어요. '${name}'의 기도제목을 모두 '${next}'(으)로 합칠까요?`)) return;
    setBusy(true);
    try {
      const n = await renameTaxonomy(kind, name, next);
      toast.success(`'${name}' → '${next}' · 기도제목 ${n}개 변경`);
    } catch (e) {
      console.error(e);
      toast.error('이름 변경에 실패했어요. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (name: string) => {
    if (busy) return;
    if (!confirm(`'${name}'을(를) 목록에서 지울까요?`)) return;
    await removeTaxonomyEntry(kind, name);
    toast(`'${name}'을(를) 목록에서 지웠어요`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] space-y-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>기도 분류 관리</DialogTitle>
        </DialogHeader>

        <div className="flex rounded-[var(--radius)] bg-[var(--bg-base)] p-0.5">
          {(['group', 'target'] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                'flex-1 rounded-[calc(var(--radius)-2px)] py-1.5 text-xs font-medium transition-colors',
                kind === k ? 'bg-white text-[var(--leaf)] shadow-[var(--shadow-sm)]' : 'text-[var(--fg-muted)]'
              )}
            >
              {k === 'group' ? '받은 모임' : '기도 대상'}
            </button>
          ))}
        </div>

        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--bg-base)] px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--fg-primary)]">{r.name}</p>
                <p className="text-[10px] text-[var(--fg-faint)]">
                  기도제목 {r.count}개{r.isDefault && ' · 기본'}
                </p>
              </div>
              <button
                onClick={() => rename(r.name)}
                disabled={busy}
                aria-label={`${r.name} 이름 변경`}
                className="rounded p-1.5 text-[var(--fg-muted)] disabled:opacity-40"
              >
                <Pencil size={14} />
              </button>
              {!r.isDefault && r.count === 0 && (
                <button
                  onClick={() => remove(r.name)}
                  disabled={busy}
                  aria-label={`${r.name} 삭제`}
                  className="rounded p-1.5 text-red-400 disabled:opacity-40"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-[11px] leading-snug text-[var(--fg-faint)]">
          이름을 바꾸면 응답·잠든 기도를 포함한 모든 기도제목에 적용돼요. 기존 이름을 입력하면 하나로 병합됩니다.
        </p>
      </DialogContent>
    </Dialog>
  );
}
