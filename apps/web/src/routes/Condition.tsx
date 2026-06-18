import { useEffect, useRef, useState } from 'react';
import { doc, setDoc, onSnapshot, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { Slider } from '@/components/ui/slider';
import { RulerPicker } from '@/components/ui/RulerPicker';
import { Switch } from '@/components/ui/switch';
import type { ConditionData } from 'shared/types/firestore';
import { ChevronLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PastDateBanner from '@/components/PastDateBanner';
import ConditionAnalysis from '@/features/condition/ConditionAnalysis';

// 키 순서에 무관한 안정적 직렬화 — 값 비교용. (서버 에코로 인한 불필요한
// 재저장·되돌림을 막기 위한 기준키를 만든다.)
function stableKey(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableKey).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => JSON.stringify(k) + ':' + stableKey(o[k]))
    .join(',')}}`;
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

  // 서버와 마지막으로 동기화된 값의 기준키. 이 값과 같으면 저장하지 않고(에코 루프 차단),
  // 편집 중 들어온 옛 스냅샷이 로컬 입력을 덮어쓰지 않게 하는 기준이 된다.
  const syncedRef = useRef<string>('');
  const condRef = useRef(cond);
  condRef.current = cond;

  useEffect(() => {
    if (!uid) return;
    // 날짜/계정이 바뀌면 이전 데이터가 새 날짜로 새어 저장되지 않도록 초기화한다.
    syncedRef.current = '';
    setLoaded(false);
    setCond({});
    const ref = doc(db, 'users', uid, 'days', date);
    return onSnapshot(ref, (snap) => {
      const incoming: ConditionData = snap.exists()
        ? ((snap.data().condition as ConditionData) ?? {})
        : {};
      const incomingKey = stableKey(incoming);
      const localKey = stableKey(condRef.current);
      // 아직 저장 안 된 로컬 편집이 있는 상태(dirty)에서, 서버가 그와 다른 값을
      // 돌려주면 무시한다. → 입력 중 다이얼이 옛 값으로 튀는 현상 방지.
      const dirty = syncedRef.current !== '' && localKey !== syncedRef.current;
      if (!dirty || incomingKey === localKey) {
        if (incomingKey !== localKey) setCond(incoming);
        syncedRef.current = incomingKey;
      }
      setLoaded(true);
    });
  }, [uid, date]);

  // 사용자가 바꾼 값만 저장한다. 서버 값과 같으면(스냅샷 에코) 저장을 건너뛰어
  // 가만히 있어도 600ms마다 쓰던 무한 저장 루프를 끊는다.
  useEffect(() => {
    if (!uid || !loaded) return;
    if (stableKey(cond) === syncedRef.current) return;
    const t = setTimeout(() => {
      void setDoc(
        doc(db, 'users', uid, 'days', date),
        { condition: cond, updatedAt: serverTimestamp() },
        { merge: true },
      );
    }, 600);
    return () => clearTimeout(t);
  }, [uid, date, cond, loaded]);

  const set = (k: keyof ConditionData, v: unknown) =>
    setCond((prev) => ({ ...prev, [k]: v }));

  // 미기록으로 되돌린다. merge 저장은 중첩 맵을 병합하므로, 서버에서도 지우려면 deleteField 가 필요하다.
  const clear = (k: keyof ConditionData) => {
    setCond((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    if (uid) {
      void setDoc(
        doc(db, 'users', uid, 'days', date),
        { condition: { [k]: deleteField() }, updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
  };

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
          value={cond.sleepScore}
          onChange={(v) => set('sleepScore', v)}
          onClear={() => clear('sleepScore')}
          min={0} max={100} step={1} majorEvery={10}
          defaultValue={70}
          color="var(--sky)"
        />
        <RulerPicker
          label="에너지"
          value={cond.energyScore}
          onChange={(v) => set('energyScore', v)}
          onClear={() => clear('energyScore')}
          min={0} max={100} step={1} majorEvery={10}
          defaultValue={70}
          color="var(--leaf)"
        />
        <p className="text-center text-[11px] text-[var(--fg-faint)]">
          밀거나 ＋ / －로 조절 · 70부터 시작해요 (미기록은 “–”)
        </p>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--fg-muted)]">기분</span>
            {cond.moodScore !== undefined ? (
              <span className="flex items-center gap-2">
                <span className="tabular-nums font-medium text-[var(--fg-primary)]">{cond.moodScore}/10</span>
                <button
                  type="button"
                  onClick={() => clear('moodScore')}
                  className="text-[11px] text-[var(--fg-faint)] active:text-[var(--fg-muted)]"
                >
                  지우기
                </button>
              </span>
            ) : (
              <span className="text-[var(--fg-faint)]">– /10 · 밀어서 기록</span>
            )}
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

      {/* 컨디션 분석 — 최근 기록 기반 추세·인사이트 (오늘 보기에서만) */}
      {!isPast && <ConditionAnalysis />}
    </div>
  );
}
