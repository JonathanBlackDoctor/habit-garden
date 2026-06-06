import { useState } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { CheckSquare, Coins, Flower2, Sparkles, Flame } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1] as const;

type Slide = {
  emoji: string;
  badge: { icon: React.ReactNode; tone: Tone }[];
  eyebrow: string;
  title: string;
  body: string;
};

type Tone = 'leaf' | 'bloom' | 'sky' | 'soil';
const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  leaf:  { bg: 'bg-[var(--leaf-soft)]',  fg: 'text-[var(--leaf)]' },
  bloom: { bg: 'bg-[var(--bloom-soft)]', fg: 'text-[var(--bloom)]' },
  sky:   { bg: 'bg-[var(--sky-soft)]',   fg: 'text-[var(--sky)]' },
  soil:  { bg: 'bg-[#EFE4D2]',           fg: 'text-[var(--soil)]' },
};

const SLIDES: Slide[] = [
  {
    emoji: '🌱',
    badge: [],
    eyebrow: 'Habit Garden',
    title: '습관 정원에 오신 걸\n환영해요',
    body: '매일의 작은 습관이 모여 당신만의 정원을 자라게 합니다. 30초만 둘러보면 핵심 사용법을 익힐 수 있어요.',
  },
  {
    emoji: '✅',
    badge: [
      { icon: <CheckSquare size={18} />, tone: 'leaf' },
      { icon: <Coins size={18} />, tone: 'bloom' },
    ],
    eyebrow: 'Step 1 · 습관 체크',
    title: '습관을 체크하면\n포인트가 쌓여요',
    body: '매일 습관을 0~5점으로 기록해요. 어려운 습관일수록 가중치가 높아 더 많은 포인트를 줍니다.',
  },
  {
    emoji: '🌷',
    badge: [{ icon: <Flower2 size={18} />, tone: 'bloom' }],
    eyebrow: 'Step 2 · 정원 가꾸기',
    title: '포인트로\n정원을 가꿔요',
    body: '모은 포인트로 씨앗을 심고 물을 주며 식물을 키워요. 만개하면 수확해 보너스 포인트를 얻습니다.',
  },
  {
    emoji: '✨',
    badge: [
      { icon: <Sparkles size={18} />, tone: 'sky' },
      { icon: <Flame size={18} />, tone: 'bloom' },
    ],
    eyebrow: 'Step 3 · 회고 & 꾸준함',
    title: '하루를 돌아보고\n꾸준함을 키워요',
    body: '저녁에 한 줄 회고를 남기면 +20P, AI 코치가 오늘의 패턴을 짚어줘요. 스트릭·레벨로 성장을 추적합니다.',
  },
];

export default function WelcomeCarousel({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const go = (next: number) => {
    if (next < 0 || next > SLIDES.length - 1) return;
    setDir(next > index ? 1 : -1);
    setIndex(next);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 60;
    if (info.offset.x < -threshold) go(index + 1);
    else if (info.offset.x > threshold) go(index - 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[60] overflow-hidden bg-[var(--bg-base)]"
      role="dialog"
      aria-modal="true"
      aria-label="습관 정원 둘러보기"
    >
      {/* 배경 그라데이션 블롭 — Login 화면과 동일한 첫인상 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, var(--leaf-soft) 0%, rgba(231, 240, 221, 0) 70%), radial-gradient(80% 60% at 50% 100%, var(--bloom-soft) 0%, rgba(250, 238, 218, 0) 65%)',
        }}
      />

      <div className="relative mx-auto flex h-full max-w-[480px] flex-col px-7 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),20px)]">
        {/* 상단: 건너뛰기 */}
        <div className="flex items-center justify-end pt-2">
          <button
            onClick={onSkip}
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--fg-faint)] active:opacity-60"
          >
            건너뛰기
          </button>
        </div>

        {/* 슬라이드 본문 */}
        <div className="relative flex flex-1 items-center">
          <motion.div
            className="w-full"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
          >
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={index}
                custom={dir}
                initial={{ opacity: 0, x: dir * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -40 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex flex-col items-center text-center"
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative text-[80px] leading-none"
                >
                  <div
                    aria-hidden
                    className="absolute inset-0 -z-10 blur-2xl"
                    style={{
                      background:
                        'radial-gradient(50% 50% at 50% 50%, var(--leaf-soft) 0%, transparent 70%)',
                    }}
                  />
                  {slide.emoji}
                </motion.div>

                {slide.badge.length > 0 && (
                  <div className="mt-6 flex items-center gap-2">
                    {slide.badge.map((b, i) => {
                      const t = toneStyles[b.tone];
                      return (
                        <div
                          key={i}
                          className={`flex h-11 w-11 items-center justify-center rounded-full ${t.bg} ${t.fg} shadow-[var(--shadow-sm)]`}
                        >
                          {b.icon}
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="mt-7 text-[11px] uppercase tracking-[0.32em] text-[var(--fg-faint)]">
                  {slide.eyebrow}
                </p>
                <h1 className="mt-2 whitespace-pre-line text-[28px] font-bold leading-tight tracking-tight text-[var(--fg-primary)]">
                  {slide.title}
                </h1>
                <p className="mt-4 max-w-[300px] text-[14px] leading-relaxed text-[var(--fg-muted)]">
                  {slide.body}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* 하단: 도트 + CTA */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={`${i + 1}번째 안내로 이동`}
                className="py-1.5"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    i === index
                      ? 'w-6 bg-[var(--leaf)]'
                      : 'w-1.5 bg-[var(--border)]'
                  }`}
                />
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {isLast ? (
              <motion.button
                key="start"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={onStart}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--leaf)] px-6 py-4 text-[16px] font-semibold text-white shadow-[var(--shadow-md)] transition-all duration-200 active:scale-[0.985] active:opacity-90"
              >
                둘러보기 시작
              </motion.button>
            ) : (
              <motion.button
                key="next"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => go(index + 1)}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--leaf)] px-6 py-4 text-[16px] font-semibold text-white shadow-[var(--shadow-md)] transition-all duration-200 active:scale-[0.985] active:opacity-90"
              >
                다음
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
