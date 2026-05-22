import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  CheckSquare,
  Coins,
  Flower2,
  Sparkles,
  Flame,
  Lightbulb,
} from 'lucide-react';

type Tone = 'leaf' | 'bloom' | 'sky' | 'soil';
const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  leaf:  { bg: 'bg-[var(--leaf-soft)]',  fg: 'text-[var(--leaf)]' },
  bloom: { bg: 'bg-[var(--bloom-soft)]', fg: 'text-[var(--bloom)]' },
  sky:   { bg: 'bg-[var(--sky-soft)]',   fg: 'text-[var(--sky)]' },
  soil:  { bg: 'bg-[#EFE4D2]',           fg: 'text-[var(--soil)]' },
};

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Tutorial() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-4 pb-8 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 py-1">
        <button
          onClick={() => navigate(-1)}
          className="text-[var(--fg-muted)]"
          aria-label="뒤로 가기"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">튜토리얼</h2>
      </div>

      {/* Intro */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0, ease: EASE }}
      >
        <SectionLabel>Welcome</SectionLabel>
        <h3 className="mt-1.5 text-[18px] font-semibold tracking-tight text-[var(--fg-primary)]">
          환영합니다
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">
          습관 정원의 하루 흐름을 5단계로 안내해드립니다. 가볍게 따라오시면 됩니다.
        </p>
      </motion.section>

      {/* Steps */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
      >
        <StepCard
          step="STEP 01"
          icon={<CheckSquare size={16} />}
          tone="leaf"
          title="매일 습관을 0~5점으로 기록해요"
          desc="하루의 시간대(아침·점심·저녁·밤·언제든)별로 습관을 모아두고, 각 습관에 0~5점을 매깁니다."
          bullets={[
            "3점 이상이면 '달성'으로 카운트돼요",
            '0점은 미체크, 5점은 완벽 수행',
          ]}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.16, ease: EASE }}
      >
        <StepCard
          step="STEP 02"
          icon={<Coins size={16} />}
          tone="bloom"
          title="달성하면 포인트가 쌓여요"
          desc="습관마다 난이도 가중치가 있어, 어려운 습관일수록 더 많은 포인트를 줍니다."
          bullets={[
            '달성(3점 이상) 시 기본 1포인트 + 가중치',
            '오늘 점수가 메인 화면 상단에 표시돼요',
          ]}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.24, ease: EASE }}
      >
        <StepCard
          step="STEP 03"
          icon={<Flower2 size={16} />}
          tone="soil"
          title="포인트로 정원을 가꿔요"
          desc="모은 포인트로 씨앗을 심고 매일 물을 주면 식물이 자라납니다. 만개하면 수확해 보너스 포인트를 얻어요."
          bullets={[
            '씨앗 심기 50P',
            '물주기 20P',
            '수확 시 희귀도에 따라 보너스 포인트',
          ]}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.32, ease: EASE }}
      >
        <StepCard
          step="STEP 04"
          icon={<Sparkles size={16} />}
          tone="sky"
          title="하루를 한 줄로 마무리해요"
          desc="저녁에 짧은 회고를 남기면 +20포인트, AI 코치가 오늘의 패턴을 짧게 짚어줍니다."
          bullets={[
            '회고 작성 보너스 +20P',
            'AI 코치 피드백 자동 생성',
          ]}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.4, ease: EASE }}
      >
        <StepCard
          step="STEP 05"
          icon={<Flame size={16} />}
          tone="bloom"
          title="꾸준함을 한눈에 확인해요"
          desc="연속 달성일(스트릭), 레벨, 히트맵, 주간/월간 통계로 성장 흐름을 추적합니다."
          bullets={[
            '스트릭 🔥 — 연속 달성 일수',
            '레벨 — 누적 포인트 기반',
            '히트맵 — 최근 활동 시각화',
          ]}
        />
      </motion.div>

      {/* Pro Tip */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.48, ease: EASE }}
        className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 p-4 shadow-[var(--shadow-sm)] backdrop-blur-sm"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--leaf-soft)] text-[var(--leaf)]">
            <Lightbulb size={16} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[10.5px] uppercase tracking-[0.28em] text-[var(--fg-faint)]">
              Pro Tip
            </p>
            <p className="text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
              처음에는 습관 2~3개로 작게 시작해보세요. 매일 체크하는 습관 자체가 가장 중요한 첫 단계입니다.
            </p>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] uppercase tracking-[0.28em] text-[var(--fg-faint)]">{children}</p>
  );
}

function StepCard({
  step, icon, tone, title, desc, bullets,
}: {
  step: string;
  icon: React.ReactNode;
  tone: Tone;
  title: string;
  desc: string;
  bullets?: string[];
}) {
  const t = toneStyles[tone];
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 p-4 shadow-[var(--shadow-sm)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.bg} ${t.fg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[10.5px] uppercase tracking-[0.28em] text-[var(--fg-faint)]">{step}</p>
          <p className="text-[13.5px] font-medium text-[var(--fg-primary)]">{title}</p>
          <p className="text-[12.5px] leading-relaxed text-[var(--fg-muted)]">{desc}</p>
        </div>
      </div>
      {bullets && bullets.length > 0 && (
        <ul className="mt-3 ml-12 space-y-1">
          {bullets.map((b, i) => (
            <li
              key={i}
              className="text-[12px] leading-relaxed text-[var(--fg-muted)] before:mr-1 before:text-[var(--leaf)] before:content-['·']"
            >
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
