import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';

const PARTICLE_COUNT = 14;
const AUTO_DISMISS_MS = 1400;

interface Particle { x: number; y: number; rot: number; emoji: string; scale: number; delay: number }

function buildParticles(seed: number): Particle[] {
  // 정원 테마 — 꽃잎/잎/별
  const emojis = ['🌿', '🌱', '🌸', '✨', '🍃', '⭐'];
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const r = pseudoRandom(seed + i);
    return {
      x: (r * 2 - 1) * 180,
      y: -100 - pseudoRandom(seed + i + 1000) * 200,
      rot: (pseudoRandom(seed + i + 2000) * 2 - 1) * 360,
      emoji: emojis[Math.floor(pseudoRandom(seed + i + 3000) * emojis.length)],
      scale: 0.8 + pseudoRandom(seed + i + 4000) * 0.8,
      delay: pseudoRandom(seed + i + 5000) * 0.15,
    };
  });
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export default function CelebrationOverlay() {
  const kind     = useAppStore((s) => s.celebrationKind);
  const payload  = useAppStore((s) => s.celebrationPayload);
  const clear    = useAppStore((s) => s.clearCelebration);
  const [count, setCount] = useState(0);
  const seed = useMemo(() => Date.now() % 100000, [kind, payload?.title]);
  const particles = useMemo(() => buildParticles(seed), [seed]);

  // 포인트 카운트업
  useEffect(() => {
    if (!kind || !payload) { setCount(0); return; }
    const target = payload.points;
    if (target <= 0) { setCount(0); return; }
    const start = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kind, payload]);

  // 자동 dismiss
  useEffect(() => {
    if (!kind) return;
    const t = setTimeout(clear, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [kind, clear]);

  const headline =
    kind === 'perfect' ? '완벽!' :
    kind === 'streak7' ? '7일 연속!' :
    kind === 'levelup' ? '레벨 업!' : '';

  return (
    <AnimatePresence>
      {kind && payload && (
        <motion.div
          key="celeb"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={clear}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-[2px] cursor-pointer"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="relative flex flex-col items-center gap-2 rounded-3xl bg-[var(--bg-card,white)] px-10 py-8 shadow-2xl"
          >
            {/* 파티클 */}
            {particles.map((p, i) => (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0 }}
                animate={{ x: p.x, y: p.y, opacity: [0, 1, 1, 0], rotate: p.rot, scale: p.scale }}
                transition={{ duration: 1.1, delay: p.delay, ease: 'easeOut' }}
                className="pointer-events-none absolute text-2xl select-none"
                aria-hidden
              >
                {p.emoji}
              </motion.span>
            ))}

            <div className="text-xs font-medium tracking-wider text-[var(--leaf)]">
              {headline}
            </div>
            <div className="text-base font-semibold text-[var(--fg-primary)]">
              {payload.title}
            </div>
            <div className="mt-1 text-4xl font-bold tabular-nums text-[var(--bloom)]">
              +{count}<span className="ml-0.5 text-xl">P</span>
            </div>
            {payload.detail && (
              <div className="text-xs text-[var(--fg-muted)]">{payload.detail}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
