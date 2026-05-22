import { useEffect, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useProgress } from '@/features/garden/useGarden';
import { toast } from 'sonner';
import { feedback } from '@/lib/feedback';

const LAST_ACTIVE_KEY = 'comeback.lastActiveDate';
const COMEBACK_TRIGGER_DAYS = 3;
const COMEBACK_DURATION_DAYS = 3;
const FLAG_KEY = 'comeback.welcomedAt';

/**
 * Phase 4-5 Comeback Mode.
 *  - 마지막 활성 일자(YYYY-MM-DD)를 localStorage 에 기록.
 *  - 진입 시 3일 이상 갭이면 progress.comebackUntil 을 today+3 으로 설정.
 *    awardEngine 이 이 기간 동안 포인트 ×2 적용.
 *  - 같은 날 중복 환영 토스트는 막는다.
 * 반환: { showWelcome, gapDays, dismiss }
 */
export function useComeback() {
  const uid     = useAppStore((s) => s.uid);
  const today   = useAppStore((s) => s.currentDate);
  const progress = useProgress();
  const [info, setInfo] = useState<{ active: boolean; gapDays: number }>(
    { active: false, gapDays: 0 },
  );

  useEffect(() => {
    if (!uid) return;
    const last = localStorage.getItem(LAST_ACTIVE_KEY);
    if (last !== today) localStorage.setItem(LAST_ACTIVE_KEY, today);
    if (!last) return; // 첫 방문은 컴백 아님

    const gap = dateGapDays(last, today);
    if (gap < COMEBACK_TRIGGER_DAYS) return;

    const alreadyWelcomed = localStorage.getItem(FLAG_KEY);
    if (alreadyWelcomed === today) {
      setInfo({ active: !!progress?.comebackUntil && progress.comebackUntil >= today, gapDays: gap });
      return;
    }
    localStorage.setItem(FLAG_KEY, today);

    // progress 에 comebackUntil 기록 (서버 측 포인트 ×2 트리거)
    const until = addDays(today, COMEBACK_DURATION_DAYS);
    setDoc(
      doc(db, 'users', uid, 'progress', 'main'),
      { comebackUntil: until, updatedAt: serverTimestamp() as any },
      { merge: true },
    ).catch(() => {});

    feedback('levelup');
    toast(`🌱 ${gap}일 만이에요`, {
      description: '완벽이 아니라 돌아오는 게 중요해요. 3일간 포인트 ×2!',
      duration: 6000,
    });
    setInfo({ active: true, gapDays: gap });
  }, [uid, today, progress?.comebackUntil]);

  const dismiss = () => {
    setInfo((p) => ({ ...p, active: false }));
  };

  return { ...info, dismiss };
}

function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function dateGapDays(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db_ = new Date(b).getTime();
  return Math.floor((db_ - da) / 86400000);
}
