/**
 * HarvestBurst — 수확 시점 희귀도별 차등 셀러브레이션.
 *
 *  basic / common: +NP 텍스트 플로팅 + 식물 자리 pop (300ms)
 *  rare:           위 + 잎 3장 흩날림 (600ms)
 *  epic:           위 + 별 파티클 5~7개 (900ms)
 *  legendary:      풀스크린 dim + 큰 식물 + 무지개 잔광 (1.5s)
 *
 *  prefers-reduced-motion: 텍스트 페이드만 200ms.
 *  성능: transform/opacity만 사용, 자동 unmount.
 */
import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import PlantSVG from './PlantSVG';
import { cn } from '@/lib/utils';

type Rarity = 'basic' | 'common' | 'rare' | 'epic' | 'legendary';

export interface HarvestBurstSpec {
  rarity: Rarity;
  speciesId: string;
  speciesName: string;
  totalYield: number;
  stage: number;
}

interface Props {
  burst: HarvestBurstSpec | null;
  onDone: () => void;
}

const DURATIONS: Record<Rarity, number> = {
  basic:     360,
  common:    360,
  rare:      720,
  epic:      980,
  legendary: 1600,
};

export default function HarvestBurst({ burst, onDone }: Props) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!burst) return;
    const dur = reduced ? 260 : DURATIONS[burst.rarity];
    const t = window.setTimeout(onDone, dur);
    return () => window.clearTimeout(t);
  }, [burst, reduced, onDone]);

  return (
    <AnimatePresence>
      {burst && (
        burst.rarity === 'legendary'
          ? <LegendaryBurst key="legendary" burst={burst} reduced={!!reduced} onDismiss={onDone} />
          : <CenterBurst key="center" burst={burst} reduced={!!reduced} />
      )}
    </AnimatePresence>
  );
}

// ── basic/common/rare/epic: 화면 중앙 상단 띄우는 가벼운 셀러브레이션 ─────
function CenterBurst({ burst, reduced }: { burst: HarvestBurstSpec; reduced: boolean }) {
  const showLeaves = !reduced && (burst.rarity === 'rare' || burst.rarity === 'epic');
  const showStars  = !reduced && burst.rarity === 'epic';

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="pointer-events-none fixed top-20 left-1/2 z-50 -translate-x-1/2"
    >
      {/* 중심 텍스트 */}
      <motion.div
        initial={{ y: 8, opacity: 0, scale: 0.96 }}
        animate={{ y: -6, opacity: 1, scale: 1 }}
        exit={{ y: -22, opacity: 0 }}
        transition={reduced ? { duration: 0.18 } : { type: 'spring', stiffness: 320, damping: 22 }}
        className={cn(
          'rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow-md backdrop-blur-sm',
          burst.rarity === 'epic'  ? 'text-[#7A4FA0] ring-1 ring-[#FFD44A]/50' :
          burst.rarity === 'rare'  ? 'text-[#6B4A8C]' :
                                     'text-[var(--bloom)]',
        )}
      >
        +{burst.totalYield}P · {burst.speciesName}
      </motion.div>

      {/* rare/epic: 잎 3장 흩날림 */}
      {showLeaves && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
          {[
            { x: -42, y: -10, rot: -35 },
            { x:  42, y: -14, rot:  30 },
            { x:   2, y: -38, rot:  10 },
          ].map((p, i) => (
            <span
              key={i}
              className="garden-burst-particle"
              style={{
                left: 0,
                top: 0,
                width: 10,
                height: 6,
                borderRadius: '50%',
                background: burst.rarity === 'epic' ? '#C088E8' : '#A8D08D',
                opacity: 0.85,
                animation: `garden-burst-leaf 600ms ${i * 60}ms ease-out forwards`,
                ['--burst-end-transform' as any]: `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* epic: 별 파티클 6개 */}
      {showStars && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
          {[
            { x: -52, y: -22, color: '#FFD44A' },
            { x:  52, y: -22, color: '#FFB8E8' },
            { x: -32, y: -44, color: '#FFD44A' },
            { x:  32, y: -44, color: '#FFFFFF' },
            { x: -60, y:   2, color: '#FFB8E8' },
            { x:  60, y:   2, color: '#FFD44A' },
          ].map((p, i) => (
            <span
              key={i}
              className="garden-burst-particle text-[12px] font-bold"
              style={{
                left: 0,
                top: 0,
                color: p.color,
                animation: `garden-burst-star 900ms ${i * 50}ms ease-out forwards`,
                ['--burst-mid-transform' as any]: `translate(${p.x * 0.5}px, ${p.y * 0.5}px) scale(1)`,
                ['--burst-end-transform' as any]: `translate(${p.x}px, ${p.y}px) scale(0.5)`,
              }}
            >
              ✦
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── legendary: 풀스크린 셀러브레이션 ───────────────────────────────
function LegendaryBurst({
  burst, reduced, onDismiss,
}: { burst: HarvestBurstSpec; reduced: boolean; onDismiss: () => void }) {
  return (
    <motion.div
      role="dialog"
      aria-label={`${burst.speciesName} 수확 셀러브레이션`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onDismiss}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/15 backdrop-blur-sm"
    >
      {/* 무지개 잔광 */}
      {!reduced && (
        <div
          aria-hidden
          className="garden-burst-particle absolute h-[280px] w-[280px] rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #FFD44A, #FFB8E8, #80E0FF, #A8D08D, #FFD44A)',
            filter: 'blur(36px)',
            animation: 'garden-burst-legendary-glow 1500ms ease-out forwards',
          }}
        />
      )}

      {/* 중앙 식물 */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 220, damping: 18 }}
        className="relative z-10 flex flex-col items-center gap-2"
      >
        <PlantSVG speciesId={burst.speciesId} stage={burst.stage} rarity="legendary" size={160} />
        <div className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-bold text-[#5A3E1E] shadow-lg">
          🌾 {burst.speciesName} · +{burst.totalYield}P
        </div>
        <div className="text-xs text-white/90 drop-shadow-md">전설의 수확</div>
      </motion.div>
    </motion.div>
  );
}
