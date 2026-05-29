import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { DEFAULT_REFLECTION_QUESTIONS } from 'shared/types/firestore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChevronLeft, CheckCircle2, Smartphone } from 'lucide-react';
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
  const [screenHours, setScreenHours] = useState('');
  const [screenMins, setScreenMins] = useState('0');
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid, 'days', date), (snap) => {
      const data = snap.data();
      if (data?.reflection) {
        setAnswers(data.reflection.answers ?? {});
        const total = data.reflection.screenTimeMinutes;
        if (typeof total === 'number') {
          setScreenHours(String(Math.floor(total / 60)));
          setScreenMins(String(total % 60));
        }
        setCompleted(true);
      }
    });
  }, [uid, date]);

  const screenTimeMinutes =
    (parseInt(screenHours || '0', 10) || 0) * 60 + (parseInt(screenMins || '0', 10) || 0);

  const allRequired = DEFAULT_REFLECTION_QUESTIONS
    .filter((q) => q.required)
    .every((q) => (answers[q.id] ?? '').trim().length > 0);

  const save = async () => {
    if (!uid || !allRequired) return;
    const isFirst = !completed;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', uid, 'days', date),
        {
          reflection: { answers, screenTimeMinutes, completedAt: serverTimestamp() },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setCompleted(true);
      if (isFirst) {
        toast('✦ +20P', { description: '회고 작성 완료!' });
      } else {
        toast('회고가 수정되었습니다.');
      }
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

      {/* 오늘 스마트폰 사용 시간 */}
      <div className="card p-4 space-y-2.5">
        <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--fg-primary)]">
          <Smartphone size={15} className="text-[var(--sky)]" />
          오늘 스마트폰 사용 시간
          <span className="ml-1 text-xs text-[var(--fg-faint)]">(선택)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            value={screenHours}
            onChange={(e) => setScreenHours(e.target.value)}
            placeholder="0"
            className="w-16 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-center text-sm tabular-nums outline-none focus:border-[var(--leaf)]"
          />
          <span className="text-sm text-[var(--fg-muted)]">시간</span>
          <select
            value={screenMins}
            onChange={(e) => setScreenMins(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--leaf)]"
          >
            {[0, 15, 30, 45].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <span className="text-sm text-[var(--fg-muted)]">분</span>
        </div>
        <p className="text-[11px] text-[var(--fg-faint)]">
          스크린타임·디지털 웰빙에서 확인한 총 사용 시간을 기록해보세요.
        </p>
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
