import { motion } from 'framer-motion';

interface Props {
  achieved: number;
  total: number;
}

/**
 * Phase 1-5 — 오늘 달성 비율에 따라 새싹 → 잎 4장 → 꽃 만개로 변하는 미니 진행률.
 * 매일 자정 자동 리셋(checks 가 비면 새싹). 누적 성장은 본체 정원에 반영.
 */
export default function TodayGrowth({ achieved, total }: Props) {
  const ratio = total === 0 ? 0 : achieved / total;
  // 단계: 0 → seed, 1~3 → sprout, 4~6 → leaves, 7~9 → bloom, 10 → fully bloomed
  const stage = ratio === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : ratio < 1 ? 4 : 5;

  return (
    <div className="flex items-center gap-2">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
        {/* 흙 */}
        <ellipse cx="24" cy="44" rx="16" ry="3" fill="#A38968" opacity="0.4" />
        {/* 줄기 */}
        <motion.line
          x1="24" y1="44"
          x2="24"
          animate={{ y2: 44 - stage * 6 - (stage > 0 ? 4 : 0) }}
          stroke="var(--leaf)" strokeWidth="2.2" strokeLinecap="round"
        />
        {/* 잎 — stage 2부터 */}
        {stage >= 2 && (
          <motion.ellipse
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18 }}
            cx="18" cy="30" rx="6" ry="3" fill="var(--leaf)"
            transform="rotate(-30 18 30)"
            style={{ transformOrigin: '24px 30px' }}
          />
        )}
        {stage >= 3 && (
          <motion.ellipse
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.05 }}
            cx="30" cy="26" rx="6" ry="3" fill="var(--leaf)"
            transform="rotate(30 30 26)"
            style={{ transformOrigin: '24px 26px' }}
          />
        )}
        {/* 꽃봉오리 — stage 4 */}
        {stage === 4 && (
          <motion.circle
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            cx="24" cy="14" r="4" fill="var(--bloom)" opacity="0.7"
          />
        )}
        {/* 만개 — stage 5 */}
        {stage === 5 && (
          <motion.g
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 16 }}
            style={{ transformOrigin: '24px 14px' }}
          >
            {[0, 72, 144, 216, 288].map((deg) => (
              <ellipse
                key={deg}
                cx="24" cy="9" rx="3.5" ry="5"
                fill="var(--bloom)"
                transform={`rotate(${deg} 24 14)`}
              />
            ))}
            <circle cx="24" cy="14" r="2.5" fill="#F8DA63" />
          </motion.g>
        )}
        {stage === 0 && (
          <ellipse cx="24" cy="42" rx="4" ry="2" fill="#7E5A3D" />
        )}
        {stage === 1 && (
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6 }}
            d="M24 40 Q22 36 24 32"
            stroke="var(--leaf)" strokeWidth="2" strokeLinecap="round" fill="none"
          />
        )}
      </svg>
      <div className="text-xs leading-tight">
        <p className="font-medium text-[var(--fg-primary)]">오늘의 성장</p>
        <p className="tabular-nums text-[var(--fg-muted)]">
          {achieved}/{total} ·{' '}
          {stage === 0 && '씨앗'}
          {stage === 1 && '새싹'}
          {stage === 2 && '잎이 났어요'}
          {stage === 3 && '잎이 무성해요'}
          {stage === 4 && '꽃봉오리'}
          {stage === 5 && '만개! 🌸'}
        </p>
      </div>
    </div>
  );
}
