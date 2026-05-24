import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { PrayerWeeklyDigestDoc } from 'shared/types/firestore';

export function WeeklyDigestCard({ digest }: { digest: PrayerWeeklyDigestDoc }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card space-y-2 bg-gradient-to-br from-[var(--bg-base)] to-white p-3"
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--leaf)]">
        <Sparkles size={13} /> 이번 주 기도 회고
      </div>
      <p className="text-sm leading-relaxed text-[var(--fg-primary)]">
        {digest.oneLineEncouragement}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--fg-muted)]">
        <span>총 {digest.totalChecks}회 기도</span>
        <span>집중 모임: {digest.topGroup}</span>
        {digest.answeredCount > 0 && (
          <span className="text-[var(--leaf)]">응답 {digest.answeredCount}건 ✨</span>
        )}
        {digest.forgottenWarning.length > 0 && (
          <span className="text-amber-600">잊혀가는 {digest.forgottenWarning.length}건</span>
        )}
      </div>
    </motion.div>
  );
}
