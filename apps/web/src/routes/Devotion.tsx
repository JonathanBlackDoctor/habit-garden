import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { JournalEntryDoc } from 'shared/types/firestore';
import { Plus, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Devotion() {
  const uid  = useAppStore((s) => s.uid);
  const date = useAppStore((s) => s.currentDate);
  const navigate = useNavigate();
  const [entries, setEntries] = useState<JournalEntryDoc[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'days', date, 'gratitudes'),
      orderBy('createdAt')
    );
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => d.data() as JournalEntryDoc));
    });
  }, [uid, date]);

  const add = async () => {
    if (!uid || !input.trim()) return;
    const id = Date.now().toString();
    await addDoc(collection(db, 'users', uid, 'days', date, 'gratitudes'), {
      id, text: input.trim(), createdAt: serverTimestamp(),
    });
    setInput('');
  };

  return (
    <div className="min-h-screen p-4 space-y-4">
      <div className="flex items-center gap-2 py-1">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">경건 · 감사</h2>
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="감사 / 기도제목 / 성찰…"
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--sky)]"
        />
        <button
          onClick={add}
          className="flex items-center justify-center rounded-[var(--radius)] bg-[var(--sky)] px-3 text-white"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-center text-sm text-[var(--fg-faint)] py-8">🙏 오늘의 감사와 기도를 기록해보세요.</p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="card p-3 text-sm text-[var(--fg-primary)]">
            {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}
