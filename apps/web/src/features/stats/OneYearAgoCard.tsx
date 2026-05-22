import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { DayDoc } from 'shared/types/firestore';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Phase 2-5 — 정확히 1년 전 같은 날의 dayScore 회상.
 * 기록이 없으면 렌더하지 않음(잡음 방지).
 */
function dateMinusYear(date: string): string {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export default function OneYearAgoCard() {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [doc1y, setDoc1y] = useState<DayDoc | null>(null);
  const ago = dateMinusYear(today);

  useEffect(() => {
    if (!uid) { setDoc1y(null); return; }
    return onSnapshot(doc(db, 'users', uid, 'days', ago), (snap) => {
      setDoc1y(snap.exists() ? (snap.data() as DayDoc) : null);
    });
  }, [uid, ago]);

  if (!doc1y || typeof doc1y.dayScore !== 'number') return null;

  const score = doc1y.dayScore;
  const tone =
    score >= 80 ? '훌륭한 하루였어요. 오늘도 그날처럼!'
    : score >= 50 ? '평균을 지킨 하루. 오늘은 한 칸 더 가볼까요?'
    : '쉽지 않은 하루였어요. 오늘은 충분히 잘하고 있어요.';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--bg-card,white)] px-3 py-2 text-xs"
      style={{ border: '1px dashed var(--leaf-soft)' }}
    >
      <Clock size={14} className="shrink-0 text-[var(--leaf)]" />
      <div className="flex-1">
        <span className="font-medium text-[var(--fg-primary)]">1년 전 오늘 · {score}점</span>
        <span className="ml-1 text-[var(--fg-muted)]">{tone}</span>
      </div>
    </motion.div>
  );
}
