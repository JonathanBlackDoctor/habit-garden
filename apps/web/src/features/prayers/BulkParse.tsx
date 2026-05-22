import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type {
  PrayerCategory, PrayerPriority, PrayerPersonDoc,
} from 'shared/types/firestore';
import { PRAYER_CATEGORY_LABELS, PRAYER_PRIORITY_LABELS } from 'shared/types/firestore';
import { usePrayerActions, usePeople } from './usePrayers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Loader2, AlertTriangle, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

interface ParsedItem {
  personName: string;
  category: PrayerCategory;
  title: string;
  body?: string;
  priority: PrayerPriority;
  confidence?: number;
  include: boolean;          // 검토 체크
}

const SELECT_CLS =
  'rounded border border-[var(--border)] bg-white px-1.5 py-1 text-xs outline-none focus:border-[var(--sky)]';

export default function BulkParse({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const people = usePeople();
  const { bulkSave } = usePrayerActions();
  const [raw, setRaw] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ParsedItem[] | null>(null);

  const reset = () => { setRaw(''); setItems(null); setParsing(false); setSaving(false); };
  const close = () => { reset(); onOpenChange(false); };

  const parse = async () => {
    if (!raw.trim() || parsing) return;
    setParsing(true);
    try {
      const fn = httpsCallable(functions, 'parsePrayerBulk');
      const res: any = await fn({
        rawText: raw.trim(),
        knownPeople: people.map((p) => p.name),
      });
      const parsed: any[] = res.data?.items ?? [];
      if (parsed.length === 0) {
        toast.error('정리할 항목을 찾지 못했습니다.');
        setParsing(false);
        return;
      }
      setItems(parsed.map((it) => ({
        personName: it.personName ?? '',
        category: (it.category ?? 'other') as PrayerCategory,
        title: it.title ?? '',
        body: it.body ?? '',
        priority: (it.priority ?? 'mid') as PrayerPriority,
        confidence: typeof it.confidence === 'number' ? it.confidence : undefined,
        include: true,
      })));
    } catch (e: any) {
      toast.error('AI 정리 실패: ' + (e?.message ?? '알 수 없는 오류'));
    } finally {
      setParsing(false);
    }
  };

  const patch = (idx: number, p: Partial<ParsedItem>) => {
    setItems((prev) => prev ? prev.map((it, i) => i === idx ? { ...it, ...p } : it) : prev);
  };

  const save = async () => {
    if (!items || saving) return;
    const chosen = items.filter((it) => it.include && it.title.trim());
    if (chosen.length === 0) { toast.error('저장할 항목이 없습니다.'); return; }
    setSaving(true);
    try {
      const n = await bulkSave(
        chosen.map((it) => ({
          title: it.title,
          body: it.body,
          category: it.category,
          priority: it.priority,
          personName: it.personName,
        })),
        people as PrayerPersonDoc[]
      );
      toast(`✅ ${n}개의 기도제목을 저장했습니다.`);
      close();
    } catch {
      toast.error('저장 실패');
      setSaving(false);
    }
  };

  const includeCount = items?.filter((it) => it.include).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(v); }}>
      <DialogContent className="max-h-[85vh] max-w-[440px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Wand2 size={16} className="text-[var(--leaf)]" /> 무더기 정리
          </DialogTitle>
        </DialogHeader>

        {!items ? (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-[var(--fg-muted)]">
              카톡·메모 등에서 받은 기도제목 덩어리를 그대로 붙여넣으면 AI가 사람별·항목별로 정리합니다.
            </p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'예)\n영희 어머니 수술 잘 되도록\n철수 취업, 그리고 동생 입시\n우리 교회 청년부 부흥…'}
              rows={8}
              className="w-full resize-none rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--sky)]"
            />
            <button
              onClick={parse}
              disabled={parsing || !raw.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--leaf)] py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {parsing ? <><Loader2 size={15} className="animate-spin" /> 정리 중…</> : <>정리하기</>}
            </button>
          </div>
        ) : (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-[var(--fg-muted)]">
              {items.length}개 항목을 찾았습니다. 검토 후 저장하세요.
            </p>
            {items.map((it, idx) => {
              const lowConf = it.confidence !== undefined && it.confidence < 0.5;
              return (
                <div
                  key={idx}
                  className={cn(
                    'rounded-[var(--radius)] border p-2.5 space-y-2',
                    it.include ? 'border-[var(--border)] bg-white' : 'border-dashed border-[var(--border)] bg-[var(--bg-base)] opacity-60'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={it.include}
                      onChange={(e) => patch(idx, { include: e.target.checked })}
                      className="h-4 w-4 accent-[var(--leaf)]"
                    />
                    <input
                      value={it.title}
                      onChange={(e) => patch(idx, { title: e.target.value })}
                      className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 text-sm text-[var(--fg-primary)] focus:border-[var(--border)] focus:outline-none"
                    />
                    {lowConf && <AlertTriangle size={14} className="shrink-0 text-amber-500" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-6">
                    <input
                      value={it.personName}
                      onChange={(e) => patch(idx, { personName: e.target.value })}
                      placeholder="대상자"
                      list="known-people"
                      className={cn(SELECT_CLS, 'w-20')}
                    />
                    <select value={it.category} onChange={(e) => patch(idx, { category: e.target.value as PrayerCategory })} className={SELECT_CLS}>
                      {(['self','family','church','ministry','friend','other'] as PrayerCategory[]).map((c) => (
                        <option key={c} value={c}>{PRAYER_CATEGORY_LABELS[c]}</option>
                      ))}
                    </select>
                    <select value={it.priority} onChange={(e) => patch(idx, { priority: e.target.value as PrayerPriority })} className={SELECT_CLS}>
                      {(['high','mid','low'] as PrayerPriority[]).map((p) => (
                        <option key={p} value={p}>{PRAYER_PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>
                  {it.body && (
                    <p className="pl-6 text-[11px] text-[var(--fg-faint)]">{it.body}</p>
                  )}
                </div>
              );
            })}
            <datalist id="known-people">
              {people.map((p) => <option key={p.id} value={p.name} />)}
            </datalist>

            <div className="sticky bottom-0 flex gap-2 bg-[var(--bg-surface)] pt-2">
              <button
                onClick={() => setItems(null)}
                className="rounded-[var(--radius)] bg-[var(--bg-base)] px-4 py-2.5 text-sm text-[var(--fg-muted)]"
              >
                다시
              </button>
              <button
                onClick={save}
                disabled={saving || includeCount === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--leaf)] py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : `${includeCount}개 저장`}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
