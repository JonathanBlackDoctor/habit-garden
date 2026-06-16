import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePrayers, usePrayerGroups, usePrayerTargets, usePrayerActions } from './usePrayers';
import { DEFAULT_PRAYER_GROUPS, DEFAULT_PRAYER_TARGETS } from 'shared/types/firestore';
import { adaptiveDailyLimit } from 'shared/prayerRotation';
import { useAppStore } from '@/lib/store';
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
  const { renameTaxonomy, removeTaxonomyEntry, setDailyPrayerLimit } = usePrayerActions();
  const [kind, setKind] = useState<Kind>('group');
  const [busy, setBusy] = useState(false);

  // 하루 기도 개수 (E) — 미설정/0 = 자동
  const dailyLimit = useAppStore((s) => s.settings?.dailyPrayerLimit) ?? 0;
  const activeCount = useMemo(() => prayers.filter((p) => p.status === 'active').length, [prayers]);
  const autoLimit = adaptiveDailyLimit(activeCount);

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

        {/* 하루 기도 개수 (E) */}
        <div className="space-y-1.5 border-t border-[var(--border)] pt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--fg-primary)]">하루 기도 개수</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setDailyPrayerLimit(null)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  dailyLimit === 0 ? 'bg-[var(--leaf)] text-white' : 'bg-[var(--bg-base)] text-[var(--fg-muted)]',
                )}
              >
                자동
              </button>
              <input
                type="number"
                min={1}
                max={30}
                value={dailyLimit > 0 ? dailyLimit : ''}
                placeholder={String(autoLimit)}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setDailyPrayerLimit(Number.isFinite(n) ? n : null);
                }}
                className="w-16 rounded-[var(--radius)] border border-[var(--border)] bg-white px-2 py-1 text-center text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] leading-snug text-[var(--fg-faint)]">
            {dailyLimit > 0
              ? `오늘의 로테이션을 매일 ${dailyLimit}개까지 보여줘요.`
              : `자동: 활성 기도제목 수에 맞춰 조절돼요 (지금 약 ${autoLimit}개). 고정 기도는 별도로 항상 노출돼요.`}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
