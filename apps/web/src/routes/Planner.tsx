import { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, setDoc,
  deleteField, serverTimestamp, query, orderBy, getDoc, getDocs, runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { plannerDate } from '@/lib/dayBoundary';
import type { TodayTodoDoc, LongTodoDoc } from 'shared/types/firestore';
import { Plus, ChevronLeft, Trash2, CalendarDays, Pencil, Check, X, Undo2, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays, addDays, subDays, parseISO, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { feedback } from '@/lib/feedback';

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

      {/* ───────── 오늘 할 일 ───────── */}
      <DayTodoList
        uid={uid} date={date} variant="today" rewardable
        title="오늘 할 일" emptyHint="오늘의 할 일을 추가해보세요."
      />

      {/* ───────── 미리 할 일 추가 ───────── */}
      <UpcomingTodo uid={uid} today={date} />

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

function encourageCopy(total: number, done: number): string {
  if (total === 0) return '오늘 할 일을 추가해보세요 🌱';
  const remaining = total - done;
  if (done === 0) return '하나만 시작해볼까요?';
  if (remaining === 0) return '오늘 할 일 완수! 🌿';
  return `좋아요! ${remaining}개 남았어요`;
}

function TodayProgressRing({ done, total }: { done: number; total: number }) {
  const R = 20;
  const C = 2 * Math.PI * R;
  const ratio = total > 0 ? done / total : 0;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 48 48" className="h-14 w-14 -rotate-90">
        <circle cx="24" cy="24" r={R} fill="none" stroke="var(--border)" strokeWidth="4" />
        <motion.circle
          cx="24" cy="24" r={R} fill="none"
          stroke="var(--leaf)"
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C}
          initial={false}
          animate={{ strokeDashoffset: C * (1 - ratio) }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-[var(--fg-primary)]">
        {done}/{total}
      </div>
    </div>
  );
}

function TodayTodoItem({
  todo, isToday, onToggle, onRename, onRemove,
}: {
  todo: TodayTodoDoc;
  isToday: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);

  const startEdit = () => { setDraft(todo.title); setEditing(true); };
  const saveEdit = () => {
    const next = draft.trim();
    if (next && next !== todo.title) onRename(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <motion.div
        layout
        className={`flex w-full items-center gap-2 rounded-[var(--radius)] bg-[var(--bg-surface)] px-3 shadow-[var(--shadow-sm)] ${isToday ? 'py-2.5' : 'py-2'}`}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--leaf)]"
        />
        <button onClick={saveEdit} aria-label="저장" className="rounded-[var(--radius)] bg-[var(--leaf)] p-1.5 text-white">
          <Check size={15} />
        </button>
        <button onClick={() => setEditing(false)} aria-label="취소" className="rounded-[var(--radius)] border border-[var(--border)] p-1.5 text-[var(--fg-muted)]">
          <X size={15} />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 shadow-[var(--shadow-sm)] ${isToday ? 'py-3.5' : 'py-3'}`}
    >
      <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <motion.div
          animate={todo.done ? { scale: [1, 1.25, 1] } : { scale: 1 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${todo.done ? 'border-[var(--leaf)] bg-[var(--leaf)]' : 'border-[var(--border)]'}`}
        >
          {todo.done && <span className="text-white text-xs">✓</span>}
        </motion.div>
        <span className={`min-w-0 truncate ${isToday ? 'text-[15px]' : 'text-sm'} ${todo.done ? 'line-through text-[var(--fg-faint)]' : 'text-[var(--fg-primary)]'}`}>
          {todo.title}
        </span>
        {todo.carriedFrom && !todo.done && (
          <span className="shrink-0 rounded-full bg-[var(--border-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]">
            이월
          </span>
        )}
      </button>
      <button onClick={startEdit} aria-label="수정" className="shrink-0 text-[var(--fg-faint)] hover:text-[var(--fg-muted)]">
        <Pencil size={15} />
      </button>
      <button onClick={onRemove} aria-label="삭제" className="shrink-0 text-[var(--fg-faint)] hover:text-[var(--wither)]">
        <Trash2 size={16} />
      </button>
    </motion.div>
  );
}

/**
 * 미완료 '오늘 할 일'을 오늘로 이월하는 클라이언트 안전망.
 * 서버 dailyReset(04:00 KST)이 같은 일을 하지만, 함수가 누락·지연되면 어제 항목이
 * 오늘에 나타나지 않아 사라진 것처럼 보인다. 어제 문서는 복사만 하므로 원본은 보존된다.
 *  - todosCarriedOver 플래그(서버와 공유)로 하루 1회만 실행 — 트랜잭션으로 중복 이월 방지.
 *  - 서버가 며칠 누락했을 수 있으니 미완료가 남은 가장 최근 과거 날짜까지 거슬러 찾아 복구한다.
 * 복구한 항목 수를 반환한다.
 */
async function carryOverPendingTodos(uid: string, today: string): Promise<number> {
  const dayRef = doc(db, 'users', uid, 'days', today);
  const daySnap = await getDoc(dayRef);
  if (daySnap.exists() && daySnap.data().todosCarriedOver) return 0;

  let sourceDate: string | null = null;
  let pending: TodayTodoDoc[] = [];
  for (let i = 1; i <= 14; i++) {
    const prevDate = format(subDays(parseISO(today), i), 'yyyy-MM-dd');
    const snap = await getDocs(collection(db, 'users', uid, 'days', prevDate, 'todayTodos'));
    const items = snap.docs
      .map((d) => ({ ...(d.data() as TodayTodoDoc), id: d.id }))
      .filter((t) => !t.done);
    if (items.length > 0) { sourceDate = prevDate; pending = items; break; }
  }

  return runTransaction(db, async (tx) => {
    const fresh = await tx.get(dayRef);
    if (fresh.exists() && fresh.data().todosCarriedOver) return 0; // 서버·다른 탭에서 이미 처리됨
    if (sourceDate) {
      const todayCol = collection(db, 'users', uid, 'days', today, 'todayTodos');
      for (const prev of pending) {
        const ref = doc(todayCol);
        tx.set(ref, {
          id: ref.id,
          title: prev.title,
          done: false,
          carriedFrom: sourceDate,
          ...(prev.linkedLongTodoId ? { linkedLongTodoId: prev.linkedLongTodoId } : {}),
        });
      }
    }
    tx.set(dayRef, { todosCarriedOver: true, updatedAt: serverTimestamp() }, { merge: true });
    return pending.length;
  });
}

function DayTodoList({
  uid, date, title, emptyHint, variant = 'plain', rewardable = false,
}: {
  uid: string | null;
  date: string;
  title?: string;
  emptyHint: string;
  variant?: 'today' | 'plain';
  rewardable?: boolean;
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

  // 실제 '오늘'을 볼 때만 미완료 이월 안전망 실행 (서버 dailyReset 누락 대비·복구).
  useEffect(() => {
    if (!uid || variant !== 'today' || date !== plannerDate()) return;
    carryOverPendingTodos(uid, date)
      .then((n) => { if (n > 0) toast(`어제 못 끝낸 할 일 ${n}개를 가져왔어요 🌱`); })
      .catch((e) => console.error('todo carryover failed', e));
  }, [uid, date, variant]);

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
    const nextDone = !todo.done;
    await updateDoc(doc(db, 'users', uid, 'days', date, 'todayTodos', todo.id), {
      done: nextDone,
    });
    if (nextDone) {
      feedback('achieve');
      if (rewardable) toast('✦ +3P', { description: todo.title });
    } else {
      feedback('check');
    }
  };

  const rename = async (todo: TodayTodoDoc, title: string) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'days', date, 'todayTodos', todo.id), { title });
  };

  const remove = async (todo: TodayTodoDoc) => {
    if (!uid) return;
    if (!confirm('이 할 일을 삭제할까요?')) return;
    await deleteDoc(doc(db, 'users', uid, 'days', date, 'todayTodos', todo.id));
  };

  const isToday = variant === 'today';
  const doneCount = todos.filter((t) => t.done).length;

  const itemList = (
    <div className="space-y-2">
      {todos.length === 0 && (
        <p className="text-center text-sm text-[var(--fg-faint)] py-6">{emptyHint}</p>
      )}
      <AnimatePresence initial={false}>
        {todos.map((todo) => (
          <TodayTodoItem
            key={todo.id}
            todo={todo}
            isToday={isToday}
            onToggle={() => toggle(todo)}
            onRename={(title) => rename(todo, title)}
            onRemove={() => remove(todo)}
          />
        ))}
      </AnimatePresence>
    </div>
  );

  const inputRow = (
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
  );

  if (isToday) {
    return (
      <section className="space-y-3 rounded-[var(--radius-lg)] bg-[var(--leaf-soft)] p-4 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-3">
          <TodayProgressRing done={doneCount} total={todos.length} />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--fg-primary)]">{title}</h3>
            <p className="text-sm text-[var(--leaf)]">{encourageCopy(todos.length, doneCount)}</p>
          </div>
        </div>
        {inputRow}
        {itemList}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {title && <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{title}</h3>}
      {inputRow}
      {itemList}
    </section>
  );
}

function UpcomingTodo({ uid, today }: { uid: string | null; today: string }) {
  const tomorrow = format(addDays(parseISO(today), 1), 'yyyy-MM-dd');
  const dayAfter = format(addDays(parseISO(today), 2), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(tomorrow);

  const quickPick = (d: string, label: string) => (
    <button
      onClick={() => setSelectedDate(d)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity ${
        selectedDate === d
          ? 'bg-[var(--leaf-soft)] text-[var(--leaf)] ring-2 ring-[var(--leaf)]/30'
          : 'bg-[var(--bg-surface)] text-[var(--fg-muted)] opacity-70'
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-[var(--fg-primary)]">미리 할 일 추가</h3>
        <label className="ml-auto flex items-center gap-1 text-xs text-[var(--fg-muted)]">
          <CalendarDays size={14} />
          <input
            type="date"
            value={selectedDate}
            min={tomorrow}
            onChange={(e) => setSelectedDate(e.target.value || tomorrow)}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none focus:border-[var(--leaf)]"
          />
        </label>
      </div>
      <div className="flex gap-1.5">
        {quickPick(tomorrow, '내일')}
        {quickPick(dayAfter, '모레')}
      </div>
      <DayTodoList
        uid={uid}
        date={selectedDate}
        variant="plain"
        rewardable={false}
        emptyHint="이 날짜의 할 일을 미리 적어두세요."
      />
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
