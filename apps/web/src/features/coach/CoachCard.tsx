import { Sparkles } from 'lucide-react';
import { useDailyCoach } from './useAICoach';
import { motion } from 'framer-motion';

/** Phase 3-3 — 일일 격려 카드 (Main 상단). */
export default function CoachCard() {
  const { data, loading, error } = useDailyCoach();
  if (error) return null;
  if (loading && !data) {
    return (
      <div className="card flex items-center gap-2 px-3 py-2 text-xs text-[var(--fg-muted)]">
        <Sparkles size={14} className="text-[var(--leaf)] animate-pulse" />
        오늘의 한마디 준비 중…
      </div>
    );
  }
  if (!data?.message) return null;

  const toneStyle =
    data.tone === 'celebrate' ? 'border-[var(--bloom)]/40 bg-[var(--bloom-soft)]/40'
    : data.tone === 'nudge'    ? 'border-[var(--sky)]/30 bg-[#E8F0F8]'
    : 'border-[var(--leaf)]/30 bg-[var(--leaf-soft)]/40';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs ${toneStyle}`}
    >
      <Sparkles size={14} className="mt-0.5 shrink-0 text-[var(--leaf)]" />
      <p className="leading-snug text-[var(--fg-primary)]">{data.message}</p>
    </motion.div>
  );
}
