import { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, setDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { TodayTodoDoc, LongTodoDoc } from 'shared/types/firestore';
import { Plus, ChevronLeft, Trash2, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays } from 'date-fns';

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

  // ── 오늘 할 일 ──
  const [todos, setTodos] = useState<TodayTodoDoc[]>([]);
  const [input, setInput] = useState('');

  // ── 장기 할 일 ──
  const [longTodos, setLongTodos] = useState<LongTodoDoc[]>([]);
  const [longInput, setLongInput] = useState('');
  const [longPriority, setLongPriority] = useState<Priority>('mid');
  const [longDeadline, setLongDeadline] = useState('');

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

  const setLongProgress = async (t: LongTodoDoc, progress: number) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'longTodos', t.id), {
      progress,
      done: progress >= 100,
      updatedAt: serverTimestamp(),
    });
  };

  const toggleLongDone = async (t: LongTodoDoc) => {
    if (!uid) return;
    const done = !t.done;
    await updateDoc(doc(db, 'users', uid, 'longTodos', t.id), {
      done,
      progress: done ? 100 : t.progress,
      updatedAt: serverTimestamp(),
    });
  };

  const removeLong = async (t: LongTodoDoc) => {
    if (!uid) return;
    if (!confirm('이 장기 목표를 삭제할까요?')) return;
    await deleteDoc(doc(db, 'users', uid, 'longTodos', t.id));
  };

  return (
    <div className="min-h-screen p-4 space-y-6">
      <div className="flex items-center gap-2 py-1">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">플래너</h2>
      </div>

      {/* ───────── 오늘 할 일 ───────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--fg-primary)]">오늘 할 일</h3>

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
            <p className="text-center text-sm text-[var(--fg-faint)] py-6">오늘의 할 일을 추가해보세요.</p>
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
          {longTodos.length === 0 && (
            <p className="text-center text-sm text-[var(--fg-faint)] py-6">장기적으로 이루고 싶은 목표를 추가해보세요.</p>
          )}
          {longTodos.map((t) => (
            <div
              key={t.id}
              className="rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-sm)] space-y-2"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleLongDone(t)}
                  className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${t.done ? 'border-[var(--leaf)] bg-[var(--leaf)]' : 'border-[var(--border)]'}`}
                  aria-label="완료 토글"
                >
                  {t.done && <span className="text-white text-xs">✓</span>}
                </button>
                <span className={`flex-1 text-sm ${t.done ? 'line-through text-[var(--fg-faint)]' : 'text-[var(--fg-primary)]'}`}>
                  {t.title}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_META[t.priority].cls}`}>
                  {PRIORITY_META[t.priority].label}
                </span>
                <button
                  onClick={() => removeLong(t)}
                  aria-label="삭제"
                  className="text-[var(--fg-faint)] hover:text-[var(--wither)]"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {t.deadline && (
                  <span className="shrink-0 rounded-full bg-[var(--border-soft)] px-2 py-0.5 text-[11px] tabular-nums text-[var(--fg-muted)]">
                    {dDayLabel(t.deadline)}
                  </span>
                )}
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={t.progress}
                  onChange={(e) => setLongProgress(t, Number(e.target.value))}
                  className="flex-1 accent-[var(--leaf)]"
                />
                <span className="w-9 shrink-0 text-right text-xs tabular-nums text-[var(--fg-muted)]">
                  {t.progress}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
