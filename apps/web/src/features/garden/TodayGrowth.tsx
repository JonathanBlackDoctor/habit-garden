import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface Props {
  achieved: number;
  total: number;
}

/**
 * Phase 1-5 — 오늘 달성 비율에 따라 새싹 → 잎 4장 → 꽃 만개로 변하는 미니 진행률.
 * 매일 자정 자동 리셋(checks 가 비면 새싹). 누적 성장은 본체 정원에 반영.
 *
 * 폴리시: 흙 결 패턴, 만개 광택, spring 조정, reduced motion 대응.
 */
export default function TodayGrowth({ achieved, total }: Props) {
  const ratio = total === 0 ? 0 : achieved / total;
  const stage = ratio === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : ratio < 1 ? 4 : 5;
  const reactId = useId();
  const idp = `tg-${reactId.replace(/[:]/g, '')}`;
  const reduced = useReducedMotion();

  const spring = reduced
    ? { type: 'tween' as const, duration: 0.15 }
    : { type: 'spring' as const, stiffness: 220, damping: 20 };

  return (
    <div className="flex items-center gap-2">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
        <defs>
          <radialGradient id={`${idp}-bloom`} cx="50%" cy="40%" r="55%">
            <stop offset="0%"   stopColor="#FFE6A8" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--bloom, #A85D0B)" stopOpacity="1" />
          </radialGradient>
          <linearGradient id={`${idp}-soil`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#B59B7A" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#7A5A3A" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* 흙 + 결 */}
        <ellipse cx="24" cy="44" rx="16" ry="3" fill={`url(#${idp}-soil)`} />
        <line x1="14" y1="44" x2="34" y2="44" stroke="#000" strokeWidth="0.3" opacity="0.12" />

        {/* 줄기 */}
        <motion.line
          x1="24" y1="44"
          x2="24"
          animate={{ y2: 44 - stage * 6 - (stage > 0 ? 4 : 0) }}
          transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 220, damping: 22 }}
          stroke="var(--leaf)" strokeWidth="2.2" strokeLinecap="round"
        />
        {/* 잎 — stage 2부터 */}
        {stage >= 2 && (
          <motion.ellipse
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={spring}
            cx="18" cy="30" rx="6" ry="3" fill="var(--leaf)"
            transform="rotate(-30 18 30)"
            style={{ transformOrigin: '24px 30px' }}
          />
        )}
        {stage >= 3 && (
          <motion.ellipse
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...spring, delay: reduced ? 0 : 0.05 }}
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
            transition={spring}
            cx="24" cy="14" r="4" fill="var(--bloom)" opacity="0.7"
          />
        )}
        {/* 만개 — stage 5: radial 광택 + 5장 꽃잎 */}
        {stage === 5 && (
          <motion.g
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 280, damping: 16 }}
            style={{ transformOrigin: '24px 14px' }}
          >
            {[0, 72, 144, 216, 288].map((deg) => (
              <ellipse
                key={deg}
                cx="24" cy="9" rx="3.5" ry="5"
                fill={`url(#${idp}-bloom)`}
                transform={`rotate(${deg} 24 14)`}
              />
            ))}
            <circle cx="24" cy="14" r="2.5" fill="#F8DA63" />
            <circle cx="24" cy="13" r="1" fill="#FFFFFF" opacity="0.7" />
          </motion.g>
        )}
        {stage === 0 && (
          <ellipse cx="24" cy="42" rx="4" ry="2" fill="#7E5A3D" />
        )}
        {stage === 1 && (
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0.15 : 0.6 }}
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
