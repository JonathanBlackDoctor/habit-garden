import { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot, updateDoc, doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { TodayTodoDoc } from 'shared/types/firestore';
import { Plus, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Planner() {
  const uid    = useAppStore((s) => s.uid);
  const date   = useAppStore((s) => s.currentDate);
  const navigate = useNavigate();
  const [todos, setTodos] = useState<TodayTodoDoc[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'days', date, 'todayTodos'),
      orderBy('id')
    );
    return onSnapshot(q, (snap) => {
      setTodos(snap.docs.map((d) => d.data() as TodayTodoDoc));
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
    <div className="min-h-screen p-4 space-y-4">
      <div className="flex items-center gap-2 py-1">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">오늘 할 일</h2>
      </div>

      {/* 입력 */}
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

      {/* 목록 */}
      <div className="space-y-2">
        {todos.length === 0 && (
          <p className="text-center text-sm text-[var(--fg-faint)] py-8">오늘의 할 일을 추가해보세요.</p>
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
    </div>
  );
}
