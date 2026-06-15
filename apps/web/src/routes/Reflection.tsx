import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { DEFAULT_REFLECTION_QUESTIONS, type DayDoc } from 'shared/types/firestore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChevronLeft, CheckCircle2, Smartphone, Target } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PastDateBanner from '@/components/PastDateBanner';
import { prevDateKey } from '@/features/recap/useYesterdayRecap';
import { feedback } from '@/lib/feedback';
import { cn } from '@/lib/utils';

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
  // 어제 회고에 적은 '내일의 다짐(q_tomorrow)' — 오늘 실천 여부를 돌아본다 (피드백 루프)
  const [yesterdayResolution, setYesterdayResolution] = useState<string | null>(null);
  const [practiced, setPracticed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid, 'days', date), (snap) => {
      const data = snap.data() as DayDoc | undefined;
      setPracticed(!!data?.resolutionPracticed);
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

  // 어제의 다짐 1회 조회 — 오늘 회고(과거 날짜 보기는 제외)에서만 표시
  useEffect(() => {
    if (!uid || isPast) { setYesterdayResolution(null); return; }
    let cancelled = false;
    (async () => {
      const snap = await getDoc(doc(db, 'users', uid, 'days', prevDateKey(date)));
      if (cancelled) return;
      const r = (snap.data() as DayDoc | undefined)?.reflection?.answers?.q_tomorrow?.trim();
      setYesterdayResolution(r || null);
    })();
    return () => { cancelled = true; };
  }, [uid, date, isPast]);

  const togglePracticed = async () => {
    if (!uid) return;
    const next = !practiced;
    setPracticed(next);
    if (next) feedback('achieve');
    await setDoc(
      doc(db, 'users', uid, 'days', date),
      { resolutionPracticed: next, updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

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

      {/* 어제의 다짐 돌아보기 — 전날 회고가 오늘 실천으로 이어졌는지 확인 (피드백 루프) */}
      {yesterdayResolution && (
        <div
          className={cn(
            'rounded-[var(--radius)] border p-4 space-y-2.5',
            practiced ? 'border-[var(--leaf)]/40 bg-[var(--leaf-soft)]' : 'border-[var(--bloom)]/35 bg-[var(--bloom-soft)]',
          )}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--bloom)]">
            <Target size={14} />
            어제의 다짐, 오늘 실천했나요?
          </div>
          <p className="text-sm font-medium leading-snug text-[var(--fg-primary)]">“{yesterdayResolution}”</p>
          <button
            onClick={togglePracticed}
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors',
              practiced
                ? 'bg-[var(--leaf)] text-white'
                : 'border border-[var(--bloom)]/40 bg-white text-[var(--bloom)]',
            )}
          >
            <CheckCircle2 size={14} />
            {practiced ? '실천했어요 ✓' : '오늘 이 다짐을 실천했어요'}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {DEFAULT_REFLECTION_QUESTIONS.map((q) => {
          const isTomorrow = q.id === 'q_tomorrow';
          return (
            <div
              key={q.id}
              className={cn(
                'card p-4 space-y-2',
                isTomorrow && 'border border-[var(--bloom)]/35',
              )}
            >
              <label className="block text-sm font-medium text-[var(--fg-primary)]">
                {q.text}
                {!q.required && (
                  <span className="ml-1 text-xs text-[var(--fg-faint)]">(선택)</span>
                )}
              </label>
              {isTomorrow && (
                <p className="flex items-center gap-1 text-[11px] text-[var(--bloom)]">
                  <Target size={11} /> 내일 아침 ‘실천 카드’로 다시 만나요
                </p>
              )}
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
          );
        })}
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
