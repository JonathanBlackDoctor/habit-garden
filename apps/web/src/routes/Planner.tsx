import { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, setDoc,
  deleteField, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { TodayTodoDoc, LongTodoDoc } from 'shared/types/firestore';
import { Plus, ChevronLeft, Trash2, CalendarDays, Pencil, Check, X, Undo2, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays, addDays, parseISO, format } from 'date-fns';

type Priority = LongTodoDoc['priority'];

const PRIORITY_META: Record<Priority, { label: string; cls: string }> = {
  high: { label: '높음', cls: 'bg-[var(--bloom-soft)] text-[var(--bloom)]' },
  mid:  { label: '보통', cls: 'bg-[var(--sky-soft)] text-[var(--sky)]' },
  low:  { label: '낮음', cls: 'bg-[var(--leaf-soft)] text-[var(--leaf)]' },
};

function dDayLabel(deadline: string): string {
  const diff = differenceInCalendarDays(new Date(deadline), new Date());
  if (diff === 0) return 'D-DAY';
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

export default function Planner() {
  const uid    = useAppStore((s) => s.uid);
  const date   = useAppStore((s) => s.currentDate);
  const navigate = useNavigate();

  const tomorrow = format(addDays(parseISO(date), 1), 'yyyy-MM-dd');

  // ── 장기 할 일 ──
  const [longTodos, setLongTodos] = useState<LongTodoDoc[]>([]);
  const [longInput, setLongInput] = useState('');
  const [longPriority, setLongPriority] = useState<Priority>('mid');
  const [longDeadline, setLongDeadline] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'longTodos'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setLongTodos(snap.docs.map((d) => ({ ...(d.data() as LongTodoDoc), id: d.id })));
    });
  }, [uid]);

  const addLong = async () => {
    if (!uid || !longInput.trim()) return;
    const ref = doc(collection(db, 'users', uid, 'longTodos'));
    await setDoc(ref, {
      id: ref.id,
      title: longInput.trim(),
      priority: longPriority,
      progress: 0,
      done: false,
      ...(longDeadline ? { deadline: longDeadline } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setLongInput('');
    setLongDeadline('');
    setLongPriority('mid');
  };

  const patchLong = async (t: LongTodoDoc, patch: Record<string, unknown>) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'longTodos', t.id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  };

  const removeLong = async (t: LongTodoDoc) => {
    if (!uid) return;
    if (!confirm('이 장기 목표를 삭제할까요?')) return;
    await deleteDoc(doc(db, 'users', uid, 'longTodos', t.id));
  };

  const activeLong = longTodos.filter((t) => !t.done);
  const archivedLong = longTodos.filter((t) => t.done);

  return (
    <div className="min-h-screen p-4 space-y-6">
      <div className="flex items-center gap-2 py-1">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">플래너</h2>
      </div>

      {/* ───────── 장기 목표 요약 ───────── */}
      {activeLong.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">진행 중 장기 목표</h3>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {activeLong.map((t) => (
              <div
                key={t.id}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${PRIORITY_META[t.priority].cls}`}
              >
                <span className="max-w-[10rem] truncate">{t.title}</span>
                {t.deadline && (
                  <span className="tabular-nums opacity-70">{dDayLabel(t.deadline)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ───────── 오늘 / 내일 할 일 ───────── */}
      <DayTodoList uid={uid} date={date} title="오늘 할 일" emptyHint="오늘의 할 일을 추가해보세요." />
      <DayTodoList uid={uid} date={tomorrow} title="내일 할 일" emptyHint="내일 할 일을 미리 적어두세요." />

      <div className="border-t border-[var(--border-soft)]" />

      {/* ───────── 장기 목표 ───────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--fg-primary)]">장기 목표</h3>

        <div className="space-y-2 rounded-[var(--radius)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)]">
          <input
            value={longInput}
            onChange={(e) => setLongInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLong()}
            placeholder="장기적으로 해야 할 일…"
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--leaf)]"
          />
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setLongPriority(p)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-opacity ${PRIORITY_META[p].cls} ${longPriority === p ? 'ring-2 ring-[var(--fg-muted)]/30' : 'opacity-50'}`}
                >
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-1 text-xs text-[var(--fg-muted)]">
              <CalendarDays size={14} />
              <input
                type="date"
                value={longDeadline}
                onChange={(e) => setLongDeadline(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none focus:border-[var(--leaf)]"
              />
            </label>
            <button
              onClick={addLong}
              className="flex items-center justify-center rounded-[var(--radius)] bg-[var(--leaf)] px-3 py-2 text-white"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {activeLong.length === 0 && (
            <p className="text-center text-sm text-[var(--fg-faint)] py-6">장기적으로 이루고 싶은 목표를 추가해보세요.</p>
          )}
          {activeLong.map((t) => (
            <LongTodoItem
              key={t.id}
              todo={t}
              archived={false}
              onPatch={(patch) => patchLong(t, patch)}
              onRemove={() => removeLong(t)}
            />
          ))}
        </div>

        {/* 보관함 */}
        {archivedLong.length > 0 && (
          <div className="space-y-2 pt-1">
            <button
              onClick={() => setShowArchive((v) => !v)}
              className="flex w-full items-center gap-2 text-xs font-medium text-[var(--fg-muted)]"
            >
              <Archive size={14} />
              보관함 ({archivedLong.length})
              <span className="ml-auto">{showArchive ? '숨기기' : '보기'}</span>
            </button>
            {showArchive && archivedLong.map((t) => (
              <LongTodoItem
                key={t.id}
                todo={t}
                archived
                onPatch={(patch) => patchLong(t, patch)}
                onRemove={() => removeLong(t)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DayTodoList({
  uid, date, title, emptyHint,
}: {
  uid: string | null;
  date: string;
  title: string;
  emptyHint: string;
}) {
  const [todos, setTodos] = useState<TodayTodoDoc[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'days', date, 'todayTodos'),
      orderBy('id')
    );
    return onSnapshot(q, (snap) => {
      setTodos(snap.docs.map((d) => ({ ...(d.data() as TodayTodoDoc), id: d.id })));
    });
  }, [uid, date]);

  const add = async () => {
    if (!uid || !input.trim()) return;
    const id = Date.now().toString();
    await addDoc(collection(db, 'users', uid, 'days', date, 'todayTodos'), {
      id, title: input.trim(), done: false,
    });
    setInput('');
  };

  const toggle = async (todo: TodayTodoDoc) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'days', date, 'todayTodos', todo.id), {
      done: !todo.done,
    });
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{title}</h3>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="할 일 추가…"
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--leaf)]"
        />
        <button
          onClick={add}
          className="flex items-center justify-center rounded-[var(--radius)] bg-[var(--leaf)] px-3 text-white"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="space-y-2">
        {todos.length === 0 && (
          <p className="text-center text-sm text-[var(--fg-faint)] py-6">{emptyHint}</p>
        )}
        {todos.map((todo) => (
          <button
            key={todo.id}
            onClick={() => toggle(todo)}
            className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3 text-left shadow-[var(--shadow-sm)]"
          >
            <div className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${todo.done ? 'border-[var(--leaf)] bg-[var(--leaf)]' : 'border-[var(--border)]'}`}>
              {todo.done && <span className="text-white text-xs">✓</span>}
            </div>
            <span className={`text-sm ${todo.done ? 'line-through text-[var(--fg-faint)]' : 'text-[var(--fg-primary)]'}`}>
              {todo.title}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function LongTodoItem({
  todo, archived, onPatch, onRemove,
}: {
  todo: LongTodoDoc;
  archived: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState(todo.title);
  const [ePriority, setEPriority] = useState<Priority>(todo.priority);
  const [eDeadline, setEDeadline] = useState(todo.deadline ?? '');
  const [draft, setDraft] = useState(todo.progress);
  const [confirmDone, setConfirmDone] = useState(false);

  // 외부(다른 기기) 변경 시 진행도 슬라이더 동기화 — 편집 중이 아닐 때만
  useEffect(() => { setDraft(todo.progress); }, [todo.progress]);

  const startEdit = () => {
    setETitle(todo.title);
    setEPriority(todo.priority);
    setEDeadline(todo.deadline ?? '');
    setEditing(true);
  };

  const saveEdit = () => {
    if (!eTitle.trim()) return;
    onPatch({
      title: eTitle.trim(),
      priority: ePriority,
      deadline: eDeadline ? eDeadline : deleteField(),
    });
    setEditing(false);
  };

  const progressDirty = draft !== todo.progress;

  // ── 편집 모드 ──
  if (editing) {
    return (
      <div className="space-y-2 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-sm)]">
        <input
          value={eTitle}
          onChange={(e) => setETitle(e.target.value)}
          className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--leaf)]"
        />
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setEPriority(p)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-opacity ${PRIORITY_META[p].cls} ${ePriority === p ? 'ring-2 ring-[var(--fg-muted)]/30' : 'opacity-50'}`}
              >
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-1 text-xs text-[var(--fg-muted)]">
            <CalendarDays size={14} />
            <input
              type="date"
              value={eDeadline}
              onChange={(e) => setEDeadline(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none focus:border-[var(--leaf)]"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setEditing(false)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--fg-muted)]"
          >
            취소
          </button>
          <button
            onClick={saveEdit}
            className="rounded-[var(--radius)] bg-[var(--leaf)] px-3 py-1.5 text-xs text-white"
          >
            저장
          </button>
        </div>
      </div>
    );
  }

  // ── 보관함(완료) 항목 ──
  if (archived) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--bg-base)] px-4 py-3">
        <Check size={16} className="shrink-0 text-[var(--leaf)]" />
        <span className="flex-1 text-sm line-through text-[var(--fg-faint)]">{todo.title}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_META[todo.priority].cls}`}>
          {PRIORITY_META[todo.priority].label}
        </span>
        <button
          onClick={() => onPatch({ done: false })}
          aria-label="복원"
          className="flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--leaf)]"
        >
          <Undo2 size={15} /> 복원
        </button>
        <button
          onClick={onRemove}
          aria-label="삭제"
          className="text-[var(--fg-faint)] hover:text-[var(--wither)]"
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  }

  // ── 진행 중 항목 ──
  return (
    <div className="rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-sm)] space-y-2">
      <div className="flex items-center gap-2">
        {confirmDone ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onPatch({ done: true, progress: 100 }); setConfirmDone(false); }}
              className="flex items-center gap-1 rounded-full bg-[var(--leaf)] px-2.5 py-1 text-xs text-white"
            >
              <Check size={13} /> 완료
            </button>
            <button
              onClick={() => setConfirmDone(false)}
              aria-label="취소"
              className="rounded-full border border-[var(--border)] p-1 text-[var(--fg-muted)]"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDone(true)}
            aria-label="완료"
            className="h-5 w-5 shrink-0 rounded-full border-2 border-[var(--border)] transition-colors hover:border-[var(--leaf)]"
          />
        )}
        <span className="flex-1 text-sm text-[var(--fg-primary)]">{todo.title}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_META[todo.priority].cls}`}>
          {PRIORITY_META[todo.priority].label}
        </span>
        <button
          onClick={startEdit}
          aria-label="수정"
          className="text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={onRemove}
          aria-label="삭제"
          className="text-[var(--fg-faint)] hover:text-[var(--wither)]"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {todo.deadline && (
          <span className="shrink-0 rounded-full bg-[var(--border-soft)] px-2 py-0.5 text-[11px] tabular-nums text-[var(--fg-muted)]">
            {dDayLabel(todo.deadline)}
          </span>
        )}
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          className="flex-1 accent-[var(--leaf)]"
        />
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-[var(--fg-muted)]">
          {draft}%
        </span>
        {progressDirty && (
          <button
            onClick={() => onPatch({ progress: draft })}
            className="shrink-0 rounded-[var(--radius)] bg-[var(--leaf)] px-2.5 py-1 text-xs text-white"
          >
            적용
          </button>
        )}
      </div>
    </div>
  );
}
