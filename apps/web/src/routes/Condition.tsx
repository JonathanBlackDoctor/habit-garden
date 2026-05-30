import { useEffect, useState } from 'react';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { Slider } from '@/components/ui/slider';
import { RulerPicker } from '@/components/ui/RulerPicker';
import { Switch } from '@/components/ui/switch';
import type { ConditionData } from 'shared/types/firestore';
import { ChevronLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PastDateBanner from '@/components/PastDateBanner';

function useDebouncedSave(uid: string | null, date: string, data: ConditionData) {
  useEffect(() => {
    if (!uid) return;
    const t = setTimeout(() => {
      setDoc(
        doc(db, 'users', uid, 'days', date),
        { condition: data, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }, 600);
    return () => clearTimeout(t);
  }, [uid, date, data]);
}

export default function Condition() {
  const uid  = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const date = dateParam ?? today;
  const isPast = !!dateParam && dateParam !== today;
  const navigate = useNavigate();

  const [cond, setCond] = useState<ConditionData>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'days', date);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) setCond(snap.data().condition ?? {});
      setLoaded(true);
    });
  }, [uid, date]);

  useDebouncedSave(uid, date, cond);

  const set = (k: keyof ConditionData, v: unknown) =>
    setCond((prev) => ({ ...prev, [k]: v }));

  if (!loaded) return null;

  return (
    <div className="min-h-screen p-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 py-1">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">컨디션</h2>
      </div>
      {isPast && <PastDateBanner date={date} />}

      {/* 눈금 휠 — 수면·에너지 (좌우로 밀어 조절) */}
      <section className="card p-4 space-y-6">
        <RulerPicker
          label="수면 점수"
          value={cond.sleepScore ?? 0}
          onChange={(v) => set('sleepScore', v)}
          min={0} max={100} step={1} majorEvery={10}
          color="var(--sky)"
        />
        <RulerPicker
          label="에너지"
          value={cond.energyScore ?? 0}
          onChange={(v) => set('energyScore', v)}
          min={0} max={100} step={1} majorEvery={10}
          color="var(--leaf)"
        />
        <p className="text-center text-[11px] text-[var(--fg-faint)]">
          눈금을 좌우로 밀어 가운데 표시에 맞추세요
        </p>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--fg-muted)]">기분</span>
            <span className="tabular-nums font-medium text-[var(--fg-primary)]">{cond.moodScore ?? 1}/10</span>
          </div>
          <Slider
            min={1} max={10} step={1}
            value={[cond.moodScore ?? 5]}
            onValueChange={([v]) => set('moodScore', v)}
          />
        </div>
      </section>

      {/* 수면 시각 */}
      <section className="card p-4 space-y-3">
        <h3 className="text-sm font-medium text-[var(--fg-primary)]">수면 시각</h3>
        <div className="flex gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-[var(--fg-muted)]">취침</label>
            <input
              type="time"
              value={cond.bedTime ?? ''}
              onChange={(e) => set('bedTime', e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-[var(--fg-muted)]">기상</label>
            <input
              type="time"
              value={cond.wakeTime ?? ''}
              onChange={(e) => set('wakeTime', e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--fg-muted)]">기상 즉시 일어남</span>
          <Switch
            checked={cond.immediatelyAwoke ?? false}
            onCheckedChange={(v) => set('immediatelyAwoke', v)}
          />
        </div>
      </section>
    </div>
  );
}
