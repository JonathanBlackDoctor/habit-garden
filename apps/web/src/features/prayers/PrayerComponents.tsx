import { useCallback, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { PrayerDoc, PrayerPriority } from 'shared/types/firestore';
import { PRAYER_PRIORITY_LABELS } from 'shared/types/firestore';
import { PRAYER_ROTATION_DEFAULTS } from 'shared/types/firestore';
import { usePrayerActions, usePrayerGroups } from './usePrayers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Pin, Sparkles, Moon, Trash2, Flame, Pencil, Layers, Link2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const GROUP_COLORS = [
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-[var(--leaf-soft)] text-[var(--leaf)]',
  'bg-stone-100 text-stone-600',
];

function groupColor(group: string): string {
  let h = 0;
  for (let i = 0; i < group.length; i++) h = (h * 31 + group.charCodeAt(i)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
}

export function GroupBadge({ group }: { group: string }) {
  const g = group || '개인';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', groupColor(g))}>
      {g}
    </span>
  );
}

function tsToDateInput(ts: unknown): string {
  const ms = (ts as any)?.toMillis?.();
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tsToLabel(ts: unknown): string {
  const ms = (ts as any)?.toMillis?.();
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

// ── 오늘 화면용 체크 가능한 카드 ────────────────────────────
export function PrayerCheckCard({
  prayer, checked, onCheck, onUncheck, onOpen,
}: {
  prayer: PrayerDoc;
  checked: boolean;
  onCheck: () => void;
  onUncheck: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <button
        onClick={() => (checked ? onUncheck() : onCheck())}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked
            ? 'border-[var(--leaf)] bg-[var(--leaf)] text-white'
            : 'border-[var(--border)] bg-white text-transparent'
        )}
        aria-label={checked ? '기도 취소' : '기도 완료'}
      >
        <Check size={16} strokeWidth={3} />
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          {prayer.pinned && <Pin size={11} className="shrink-0 text-[var(--bloom)]" />}
          <p className={cn('truncate text-sm', checked ? 'text-[var(--fg-faint)] line-through' : 'text-[var(--fg-primary)]')}>
            {prayer.title}
          </p>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <GroupBadge group={prayer.group} />
          {prayer.streak > 1 && (
            <span className="flex items-center gap-0.5 text-[10px] text-[var(--bloom)]">
              <Flame size={10} />{prayer.streak}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

// ── 목록(전체/응답/잠든)용 카드 ─────────────────────────────
export function PrayerListCard({
  prayer, onOpen, selectMode = false, selected = false, onToggleSelect,
}: {
  prayer: PrayerDoc;
  onOpen: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5">
        {prayer.pinned && <Pin size={11} className="shrink-0 text-[var(--bloom)]" />}
        <p className="truncate text-sm text-[var(--fg-primary)]">{prayer.title}</p>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <GroupBadge group={prayer.group} />
        {prayer.batchId && (
          <span className="flex items-center gap-0.5 rounded-full bg-[var(--bg-base)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)]">
            <Layers size={9} /> 무더기
          </span>
        )}
        <span className="text-[10px] text-[var(--fg-faint)]">
          {PRAYER_PRIORITY_LABELS[prayer.priority]} · {prayer.prayCount}회 기도
          {tsToLabel(prayer.receivedAt) && ` · ${tsToLabel(prayer.receivedAt)} 받음`}
        </span>
      </div>
      {prayer.status === 'answered' && prayer.answerNote && (
        <p className="mt-1.5 rounded bg-[var(--leaf-soft)] px-2 py-1 text-[11px] text-[var(--leaf)]">
          ✨ {prayer.answerNote}
        </p>
      )}
    </>
  );

  if (selectMode) {
    return (
      <button
        onClick={onToggleSelect}
        className={cn(
          'card flex w-full items-start gap-3 p-3 text-left transition-colors',
          selected && 'ring-2 ring-[var(--leaf)]'
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
            selected ? 'border-[var(--leaf)] bg-[var(--leaf)] text-white' : 'border-[var(--border)] bg-white text-transparent'
          )}
        >
          <Check size={13} strokeWidth={3} />
        </span>
        <span className="min-w-0 flex-1">{inner}</span>
      </button>
    );
  }

  return (
    <button onClick={onOpen} className="card w-full p-3 text-left">
      {inner}
    </button>
  );
}

// ── 다중 선택 상태 훅 ──────────────────────────────────────
export function usePrayerSelection() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const exit = useCallback(() => { setSelectMode(false); setSelectedIds(new Set()); }, []);

  return { selectMode, setSelectMode, selectedIds, toggle, selectAll, clear, isSelected, exit };
}

// ── 일괄 작업 하단 바 ──────────────────────────────────────
export function BulkActionBar({
  ids, onDone,
}: {
  ids: string[];
  onDone: () => void;          // 작업 완료/취소 시 선택 모드 종료
}) {
  const { removePrayers, mergePrayers } = usePrayerActions();
  const [editOpen, setEditOpen] = useState(false);
  const count = ids.length;

  const handleDelete = async () => {
    if (count === 0) return;
    if (!confirm(`${count}개의 기도제목을 영구 삭제할까요?`)) return;
    await removePrayers(ids);
    onDone();
  };

  const handleMerge = async () => {
    if (count < 2) return;
    if (!confirm(`${count}개를 하나의 기도제목으로 합칠까요?`)) return;
    await mergePrayers(ids);
    onDone();
  };

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5">
        <span className="text-xs font-medium text-[var(--fg-primary)]">{count}개 선택</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setEditOpen(true)}
            disabled={count === 0}
            className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--bg-base)] px-2.5 py-1.5 text-xs text-[var(--fg-muted)] disabled:opacity-40"
          >
            <Pencil size={13} /> 수정
          </button>
          <button
            onClick={handleMerge}
            disabled={count < 2}
            className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--bg-base)] px-2.5 py-1.5 text-xs text-[var(--fg-muted)] disabled:opacity-40"
          >
            <Link2 size={13} /> 합치기
          </button>
          <button
            onClick={handleDelete}
            disabled={count === 0}
            className="flex items-center gap-1 rounded-[var(--radius)] px-2.5 py-1.5 text-xs text-red-500 disabled:opacity-40"
          >
            <Trash2 size={13} /> 삭제
          </button>
          <button
            onClick={onDone}
            className="flex items-center gap-1 rounded-[var(--radius)] px-2 py-1.5 text-xs text-[var(--fg-muted)]"
            aria-label="선택 취소"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <BulkEditDialog ids={ids} open={editOpen} onOpenChange={setEditOpen} onDone={onDone} />
    </>
  );
}

// ── 일괄 수정 다이얼로그 ────────────────────────────────────
type PinChoice = 'none' | 'pin' | 'unpin';

function BulkEditDialog({
  ids, open, onOpenChange, onDone,
}: {
  ids: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const { updatePrayers } = usePrayerActions();
  const groups = usePrayerGroups();
  const [group, setGroup] = useState<string>('');
  const [priority, setPriority] = useState<PrayerPriority | ''>('');
  const [pin, setPin] = useState<PinChoice>('none');
  const [saving, setSaving] = useState(false);

  const reset = () => { setGroup(''); setPriority(''); setPin('none'); setSaving(false); };
  const close = () => { reset(); onOpenChange(false); };

  const apply = async () => {
    const patch: Partial<PrayerDoc> = {};
    if (group) patch.group = group;
    if (priority) patch.priority = priority;
    if (pin !== 'none') patch.pinned = pin === 'pin';
    if (Object.keys(patch).length === 0) { close(); return; }
    setSaving(true);
    try {
      await updatePrayers(ids, patch);
      close();
      onDone();
    } catch {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(v); }}>
      <DialogContent className="max-w-[420px] space-y-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="pr-6">{ids.length}개 함께 수정</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-[var(--fg-faint)]">변경할 항목만 선택하세요. 비워두면 그대로 유지됩니다.</p>

        <label className="block space-y-1">
          <span className="text-xs text-[var(--fg-muted)]">받은 모임</span>
          <select
            className={cn(SELECT_CLS, 'w-full')}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">변경 없음</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-[var(--fg-muted)]">우선순위</span>
          <select
            className={cn(SELECT_CLS, 'w-full')}
            value={priority}
            onChange={(e) => setPriority(e.target.value as PrayerPriority | '')}
          >
            <option value="">변경 없음</option>
            {(['high','mid','low'] as PrayerPriority[]).map((p) => (
              <option key={p} value={p}>{PRAYER_PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-[var(--fg-muted)]">고정</span>
          <select
            className={cn(SELECT_CLS, 'w-full')}
            value={pin}
            onChange={(e) => setPin(e.target.value as PinChoice)}
          >
            <option value="none">변경 없음</option>
            <option value="pin">고정으로 설정</option>
            <option value="unpin">고정 해제</option>
          </select>
        </label>

        <button
          onClick={apply}
          disabled={saving}
          className="w-full rounded-[var(--radius)] bg-[var(--leaf)] py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          적용
        </button>
      </DialogContent>
    </Dialog>
  );
}

// ── 모임 선택 (직접 추가 가능) ──────────────────────────────
const SELECT_CLS =
  'rounded-[var(--radius)] border border-[var(--border)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--sky)]';

export function GroupSelect({
  value, onChange, className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const groups = usePrayerGroups();
  const { addPrayerGroup } = usePrayerActions();
  const options = groups.includes(value) || !value ? groups : [value, ...groups];

  return (
    <select
      className={cn(SELECT_CLS, className)}
      value={value || (groups[0] ?? '개인')}
      onChange={async (e) => {
        if (e.target.value === '__new__') {
          const name = window.prompt('새 모임 이름')?.trim();
          if (name) { await addPrayerGroup(name); onChange(name); }
          return;
        }
        onChange(e.target.value);
      }}
    >
      {options.map((g) => <option key={g} value={g}>{g}</option>)}
      <option value="__new__">+ 새 모임 추가…</option>
    </select>
  );
}

// ── 상세/편집 다이얼로그 ────────────────────────────────────
export function PrayerDetailDialog({
  prayer, open, onOpenChange,
}: {
  prayer: PrayerDoc | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { updatePrayer, togglePin, markAnswered, awaken, removePrayer } = usePrayerActions();
  const [editing, setEditing] = useState(false);
  const [answerMode, setAnswerMode] = useState(false);
  const [answerNote, setAnswerNote] = useState('');

  if (!prayer) return null;

  const close = () => {
    setEditing(false); setAnswerMode(false); setAnswerNote('');
    onOpenChange(false);
  };

  const baseDays = PRAYER_ROTATION_DEFAULTS[prayer.priority].baseInterval;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(v); }}>
      <DialogContent
        className="max-w-[420px] space-y-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="pr-6">{prayer.title}</DialogTitle>
        </DialogHeader>

        {!editing ? (
          // ── 보기 모드 (키보드 안 올라옴) ──
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <GroupBadge group={prayer.group} />
              <span className="text-xs text-[var(--fg-muted)]">{PRAYER_PRIORITY_LABELS[prayer.priority]}</span>
              <span className="text-xs text-[var(--fg-faint)]">· {prayer.prayCount}회 기도</span>
              {tsToLabel(prayer.receivedAt) && (
                <span className="text-xs text-[var(--fg-faint)]">· {tsToLabel(prayer.receivedAt)} 받음</span>
              )}
            </div>
            {prayer.body && (
              <p className="whitespace-pre-line rounded-[var(--radius)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--fg-primary)]">
                {prayer.body}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--bg-base)] px-3 py-1.5 text-xs text-[var(--fg-muted)]"
              >
                <Pencil size={13} /> 수정
              </button>
              <button
                onClick={() => togglePin(prayer)}
                className={cn(
                  'flex items-center gap-1 rounded-[var(--radius)] px-3 py-1.5 text-xs',
                  prayer.pinned ? 'bg-[var(--bloom)] text-white' : 'bg-[var(--bg-base)] text-[var(--fg-muted)]'
                )}
              >
                <Pin size={13} /> {prayer.pinned ? '고정됨' : '고정'}
              </button>

              {prayer.status === 'dormant' && (
                <button
                  onClick={() => { awaken(prayer); close(); }}
                  className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--leaf-soft)] px-3 py-1.5 text-xs text-[var(--leaf)]"
                >
                  <Moon size={13} /> 깨우기
                </button>
              )}

              {prayer.status !== 'answered' && (
                <button
                  onClick={() => setAnswerMode((v) => !v)}
                  className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--leaf)] px-3 py-1.5 text-xs text-white"
                >
                  <Sparkles size={13} /> 응답됨
                </button>
              )}

              <button
                onClick={() => { if (confirm('이 기도제목을 영구 삭제할까요?')) { removePrayer(prayer); close(); } }}
                className="ml-auto flex items-center gap-1 rounded-[var(--radius)] px-3 py-1.5 text-xs text-red-500"
              >
                <Trash2 size={13} /> 삭제
              </button>
            </div>

            {answerMode && (
              <div className="space-y-2 rounded-[var(--radius)] bg-[var(--bg-base)] p-3">
                <textarea
                  value={answerNote}
                  onChange={(e) => setAnswerNote(e.target.value)}
                  placeholder="응답 간증을 남겨보세요 (선택)"
                  rows={2}
                  className="w-full resize-none rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--sky)]"
                />
                <button
                  onClick={() => { markAnswered(prayer, answerNote); close(); }}
                  className="w-full rounded-[var(--radius)] bg-[var(--leaf)] py-2 text-sm font-medium text-white"
                >
                  응답으로 기록하고 보관함으로 이동
                </button>
              </div>
            )}
          </div>
        ) : (
          // ── 수정 모드 ──
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs text-[var(--fg-muted)]">제목</span>
              <input
                defaultValue={prayer.title}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== prayer.title) updatePrayer(prayer.id, { title: v });
                }}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--sky)]"
              />
            </label>

            <textarea
              defaultValue={prayer.body ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (prayer.body ?? '')) updatePrayer(prayer.id, { body: v || undefined } as any);
              }}
              placeholder="상세 내용 / 원문…"
              rows={3}
              className="w-full resize-none rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--sky)]"
            />

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-[var(--fg-muted)]">받은 모임</span>
                <GroupSelect
                  className="w-full"
                  value={prayer.group}
                  onChange={(g) => updatePrayer(prayer.id, { group: g })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-[var(--fg-muted)]">우선순위</span>
                <select
                  className={cn(SELECT_CLS, 'w-full')}
                  defaultValue={prayer.priority}
                  onChange={(e) => updatePrayer(prayer.id, { priority: e.target.value as PrayerPriority })}
                >
                  {(['high','mid','low'] as PrayerPriority[]).map((p) => (
                    <option key={p} value={p}>{PRAYER_PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-[var(--fg-muted)]">받은 날짜</span>
                <input
                  type="date"
                  className={cn(SELECT_CLS, 'w-full')}
                  defaultValue={tsToDateInput(prayer.receivedAt)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const d = new Date(`${e.target.value}T00:00:00`);
                    if (!isNaN(d.getTime())) updatePrayer(prayer.id, { receivedAt: Timestamp.fromDate(d) } as any);
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-[var(--fg-muted)]">기도 주기(일)</span>
                <input
                  type="number"
                  min={1}
                  placeholder={`기본 ${baseDays}일`}
                  className={cn(SELECT_CLS, 'w-full')}
                  defaultValue={prayer.rotationDays ?? ''}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    updatePrayer(prayer.id, { rotationDays: Number.isFinite(n) && n > 0 ? n : undefined } as any);
                  }}
                />
              </label>
            </div>
            <p className="text-[11px] text-[var(--fg-faint)]">
              비워두면 우선순위 기본값({baseDays}일)으로 순환합니다.
            </p>

            <button
              onClick={() => setEditing(false)}
              className="w-full rounded-[var(--radius)] bg-[var(--leaf)] py-2 text-sm font-medium text-white"
            >
              완료
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
