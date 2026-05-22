import { useState } from 'react';
import type {
  PrayerDoc, PrayerCategory, PrayerPriority, PrayerPersonDoc,
} from 'shared/types/firestore';
import {
  PRAYER_CATEGORY_LABELS, PRAYER_PRIORITY_LABELS,
} from 'shared/types/firestore';
import { usePrayerActions } from './usePrayers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Pin, Sparkles, Moon, Trash2, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

const CAT_COLORS: Record<PrayerCategory, string> = {
  self:     'bg-[var(--leaf-soft)] text-[var(--leaf)]',
  family:   'bg-amber-100 text-amber-700',
  church:   'bg-sky-100 text-sky-700',
  ministry: 'bg-violet-100 text-violet-700',
  friend:   'bg-rose-100 text-rose-700',
  other:    'bg-stone-100 text-stone-600',
};

export function CategoryBadge({ category }: { category: PrayerCategory }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', CAT_COLORS[category])}>
      {PRAYER_CATEGORY_LABELS[category]}
    </span>
  );
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
          <CategoryBadge category={prayer.category} />
          {prayer.personName && (
            <span className="truncate text-[11px] text-[var(--fg-muted)]">{prayer.personName}</span>
          )}
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
export function PrayerListCard({ prayer, onOpen }: { prayer: PrayerDoc; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card w-full p-3 text-left">
      <div className="flex items-center gap-1.5">
        {prayer.pinned && <Pin size={11} className="shrink-0 text-[var(--bloom)]" />}
        <p className="truncate text-sm text-[var(--fg-primary)]">{prayer.title}</p>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={prayer.category} />
        {prayer.personName && (
          <span className="text-[11px] text-[var(--fg-muted)]">{prayer.personName}</span>
        )}
        <span className="text-[10px] text-[var(--fg-faint)]">
          {PRAYER_PRIORITY_LABELS[prayer.priority]} · {prayer.prayCount}회 기도
        </span>
      </div>
      {prayer.status === 'answered' && prayer.answerNote && (
        <p className="mt-1.5 rounded bg-[var(--leaf-soft)] px-2 py-1 text-[11px] text-[var(--leaf)]">
          ✨ {prayer.answerNote}
        </p>
      )}
    </button>
  );
}

// ── 상세/편집 다이얼로그 ────────────────────────────────────
const SELECT_CLS =
  'rounded-[var(--radius)] border border-[var(--border)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--sky)]';

export function PrayerDetailDialog({
  prayer, people, open, onOpenChange,
}: {
  prayer: PrayerDoc | null;
  people: PrayerPersonDoc[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { updatePrayer, togglePin, markAnswered, awaken, removePrayer } = usePrayerActions();
  const [answerMode, setAnswerMode] = useState(false);
  const [answerNote, setAnswerNote] = useState('');

  if (!prayer) return null;

  const close = () => { setAnswerMode(false); setAnswerNote(''); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(v); }}>
      <DialogContent className="max-w-[420px] space-y-3">
        <DialogHeader>
          <DialogTitle className="pr-6">{prayer.title}</DialogTitle>
        </DialogHeader>

        {/* 본문 편집 */}
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

        {/* 분류 · 우선순위 */}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-[var(--fg-muted)]">분류</span>
            <select
              className={cn(SELECT_CLS, 'w-full')}
              defaultValue={prayer.category}
              onChange={(e) => updatePrayer(prayer.id, { category: e.target.value as PrayerCategory })}
            >
              {(['self','family','church','ministry','friend','other'] as PrayerCategory[]).map((c) => (
                <option key={c} value={c}>{PRAYER_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
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

        {/* 대상자 */}
        <label className="block space-y-1">
          <span className="text-xs text-[var(--fg-muted)]">대상자</span>
          <select
            className={cn(SELECT_CLS, 'w-full')}
            defaultValue={prayer.personId ?? ''}
            onChange={(e) => {
              const pid = e.target.value || undefined;
              const person = people.find((p) => p.id === pid);
              updatePrayer(prayer.id, { personId: pid, personName: person?.name ?? '' } as any);
            }}
          >
            <option value="">(없음)</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        {/* 액션 행 */}
        <div className="flex flex-wrap gap-2 pt-1">
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

        {/* 응답 간증 입력 */}
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
      </DialogContent>
    </Dialog>
  );
}
