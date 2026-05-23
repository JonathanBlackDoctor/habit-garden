import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { DEFAULT_REFLECTION_QUESTIONS } from 'shared/types/firestore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PastDateBanner from '@/components/PastDateBanner';

export default function Reflection() {
  const uid  = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const date = dateParam ?? today;
  const isPast = !!dateParam && dateParam !== today;
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid, 'days', date), (snap) => {
      const data = snap.data();
      if (data?.reflection) {
        setAnswers(data.reflection.answers ?? {});
        setCompleted(true);
      }
    });
  }, [uid, date]);

  const allRequired = DEFAULT_REFLECTION_QUESTIONS
    .filter((q) => q.required)
    .every((q) => (answers[q.id] ?? '').trim().length > 0);

  const save = async () => {
    if (!uid || !allRequired) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', uid, 'days', date),
        {
          reflection: { answers, completedAt: serverTimestamp() },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setCompleted(true);
      toast('✦ +20P', { description: '회고 작성 완료!' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-4 pb-8 space-y-4">
      <div className="flex items-center gap-2 py-1">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">하루 회고</h2>
        {completed && <CheckCircle2 size={18} className="text-[var(--leaf)] ml-auto" />}
      </div>
      {isPast && <PastDateBanner date={date} />}

      {completed && (
        <div className="rounded-[var(--radius)] bg-[var(--leaf-soft)] px-4 py-2.5 text-sm text-[var(--leaf)]">
          오늘의 회고를 작성했습니다. 수정도 가능합니다.
        </div>
      )}

      <div className="space-y-4">
        {DEFAULT_REFLECTION_QUESTIONS.map((q) => (
          <div key={q.id} className="card p-4 space-y-2">
            <label className="block text-sm font-medium text-[var(--fg-primary)]">
              {q.text}
              {!q.required && (
                <span className="ml-1 text-xs text-[var(--fg-faint)]">(선택)</span>
              )}
            </label>
            <textarea
              value={answers[q.id] ?? ''}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
              }
              placeholder={q.placeholder}
              rows={2}
              className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--leaf)] placeholder:text-[var(--fg-faint)]"
            />
          </div>
        ))}
      </div>

      <Button
        onClick={save}
        disabled={!allRequired || saving}
        className="w-full"
      >
        {saving ? '저장 중…' : completed ? '회고 수정' : '회고 완료 (+20P)'}
      </Button>
    </div>
  );
}
