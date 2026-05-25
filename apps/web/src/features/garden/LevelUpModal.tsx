import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { rewardsForLevelRange } from 'shared/lib/levelRewards';
import BloomBadge, { TIER_NAMES, tierOf } from '@/components/BloomBadge';

/**
 * 레벨업 창 — 서버가 보상을 지급하면 떠오르고, "보상 수령"을 눌러 닫는다.
 * 보상(포인트·씨앗)은 이미 계정에 반영돼 있으며 이 창은 연출·확인 용도다.
 */
export default function LevelUpModal() {
  const levelUp = useAppStore((s) => s.levelUp);
  const clear   = useAppStore((s) => s.clearLevelUp);

  const rewards = useMemo(
    () => (levelUp ? rewardsForLevelRange(levelUp.fromLevel, levelUp.toLevel) : null),
    [levelUp],
  );

  const open = !!levelUp && !!rewards;
  const toLevel = levelUp?.toLevel ?? 1;
  const tierName = TIER_NAMES[tierOf(toLevel) - 1];

  return (
    <AnimatePresence>
      {open && rewards && levelUp && (
        <motion.div
          key="levelup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`레벨 업 — Lv.${toLevel}`}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="relative flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl bg-[var(--bg-card,white)] px-8 py-7 text-center shadow-2xl"
          >
            <div className="text-xs font-semibold tracking-[0.2em] text-[var(--leaf)]">
              LEVEL UP
            </div>

            <BloomBadge level={toLevel} size={120} burstKey={`${levelUp.fromLevel}-${toLevel}`} />

            <div>
              <p className="text-3xl font-bold tabular-nums text-[var(--fg-primary)]">
                Lv.{toLevel}
              </p>
              <p className="text-xs text-[var(--fg-muted)]">{tierName}</p>
              {levelUp.toLevel - levelUp.fromLevel > 1 && (
                <p className="mt-0.5 text-xs text-[var(--fg-faint)]">
                  +{levelUp.toLevel - levelUp.fromLevel} 레벨 달성
                </p>
              )}
            </div>

            {/* 보상 요약 */}
            <div className="mt-1 flex w-full flex-col gap-1.5 rounded-2xl bg-[var(--leaf-soft)] px-4 py-3">
              <p className="text-[11px] font-medium tracking-wide text-[var(--leaf)]">보상</p>
              <div className="flex items-center justify-center gap-4">
                {rewards.totalPoints > 0 && (
                  <span className="text-base font-bold tabular-nums text-[var(--bloom)]">
                    ✦ +{rewards.totalPoints.toLocaleString()}P
                  </span>
                )}
                {rewards.totalSeeds > 0 && (
                  <span className="text-base font-bold tabular-nums text-[var(--leaf)]">
                    🌱 씨앗 ×{rewards.totalSeeds}
                  </span>
                )}
                {rewards.totalPoints === 0 && rewards.totalSeeds === 0 && (
                  <span className="text-sm text-[var(--fg-muted)]">새 단계 개화</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={clear}
              className="mt-2 w-full rounded-2xl bg-[var(--leaf)] py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
            >
              보상 수령
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
