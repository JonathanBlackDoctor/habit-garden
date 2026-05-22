import { motion } from 'framer-motion';
import { CheckSquare, Flower2, Sparkles, HandHeart, Shield } from 'lucide-react';

export function OnboardingInfo({ baseDelay = 0.28 }: { baseDelay?: number }) {
  return (
    <>
      <AboutSection delay={baseDelay} />
      <FeaturesSection delay={baseDelay + 0.08} />
      <DataSafetySection delay={baseDelay + 0.16} />
    </>
  );
}

export function AboutSection({ delay = 0 }: { delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className="mt-10"
    >
      <SectionLabel>About</SectionLabel>
      <h2 className="mt-1.5 text-[18px] font-semibold tracking-tight text-[var(--fg-primary)]">
        습관 정원이란
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">
        매일 작은 습관을 체크하면 포인트가 쌓이고, 그 포인트로 가상의 정원에 식물을 심어 키우는 PWA입니다.
        게임처럼 가볍게 습관을 들이고, AI 코치가 매일의 패턴을 짧게 짚어줍니다.
      </p>
    </motion.section>
  );
}

export function FeaturesSection({ delay = 0 }: { delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className="mt-8"
    >
      <SectionLabel>Features</SectionLabel>
      <h2 className="mt-1.5 text-[18px] font-semibold tracking-tight text-[var(--fg-primary)]">
        할 수 있는 것
      </h2>
      <div className="mt-3 space-y-2">
        <FeatureRow
          icon={<CheckSquare size={16} />}
          tone="leaf"
          title="습관 체크"
          desc="매일 정한 습관을 0~5점으로 기록하면 가중치에 따라 포인트가 쌓입니다."
        />
        <FeatureRow
          icon={<Flower2 size={16} />}
          tone="bloom"
          title="정원 가꾸기"
          desc="모은 포인트로 씨앗을 심어 식물을 키우고, 만개하면 수확 보상을 얻어요."
        />
        <FeatureRow
          icon={<Sparkles size={16} />}
          tone="sky"
          title="AI 일일 피드백 & 회고"
          desc="하루를 마무리하며 한 줄 회고를 적으면 AI가 짧은 코칭을 돌려드립니다."
        />
        <FeatureRow
          icon={<HandHeart size={16} />}
          tone="soil"
          title="신앙 기능 (선택)"
          desc="경건·기도제목 메뉴는 기본 OFF이며, 더보기에서 켤 수 있습니다."
        />
      </div>
    </motion.section>
  );
}

export function DataSafetySection({ delay = 0 }: { delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 p-5 shadow-[var(--shadow-sm)] backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--leaf-soft)]">
          <Shield size={16} className="text-[var(--leaf)]" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[14px] font-medium text-[var(--fg-primary)]">데이터는 안전합니다</p>
          <p className="text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
            Firebase 보안 규칙으로 본인 데이터는 본인 계정에서만 읽고 쓸 수 있어요. 관리자도 다른 사용자의 습관·기도·회고 내용을 들여다보지 않습니다.
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] uppercase tracking-[0.28em] text-[var(--fg-faint)]">{children}</p>
  );
}

type Tone = 'leaf' | 'bloom' | 'sky' | 'soil';
const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  leaf:  { bg: 'bg-[var(--leaf-soft)]',  fg: 'text-[var(--leaf)]' },
  bloom: { bg: 'bg-[var(--bloom-soft)]', fg: 'text-[var(--bloom)]' },
  sky:   { bg: 'bg-[var(--sky-soft)]',   fg: 'text-[var(--sky)]' },
  soil:  { bg: 'bg-[#EFE4D2]',           fg: 'text-[var(--soil)]' },
};

function FeatureRow({
  icon, title, desc, tone,
}: { icon: React.ReactNode; title: string; desc: string; tone: Tone }) {
  const t = toneStyles[tone];
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 p-4 shadow-[var(--shadow-sm)] backdrop-blur-sm">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.bg} ${t.fg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[13.5px] font-medium text-[var(--fg-primary)]">{title}</p>
        <p className="text-[12.5px] leading-relaxed text-[var(--fg-muted)]">{desc}</p>
      </div>
    </div>
  );
}
