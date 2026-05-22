import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { signOutUser } from '@/lib/auth';
import { useAppStore } from '@/lib/store';
import { CheckSquare, Flower2, Sparkles, HandHeart, Shield, Mail } from 'lucide-react';

export default function PendingApproval() {
  const user    = useAppStore((s) => s.user);
  const profile = useAppStore((s) => s.profile);
  const authLoading = useAppStore((s) => s.authLoading);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (profile?.status === 'approved') {
      navigate('/', { replace: true });
    }
  }, [user, profile, authLoading, navigate]);

  if (profile?.status === 'rejected') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--bg-base)] px-6">
        <div className="text-5xl">🚫</div>
        <p className="text-base text-[var(--fg-primary)]">접근이 거부되었습니다.</p>
        <button
          onClick={() => signOutUser()}
          className="text-sm text-[var(--fg-muted)] underline"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--bg-base)]">
      {/* 배경 그라데이션 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(55% 40% at 50% 0%, var(--leaf-soft) 0%, rgba(231, 240, 221, 0) 70%)',
        }}
      />

      <div className="relative mx-auto max-w-md px-6 pb-12 pt-12">
        {/* 히어로 */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <PulseRing />
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--fg-faint)]">Pending Approval</p>
            <h1 className="text-[26px] font-bold tracking-tight text-[var(--fg-primary)]">승인 대기 중입니다</h1>
            <p className="mt-1 max-w-[300px] text-[13px] leading-relaxed text-[var(--fg-muted)]">
              가입 신청이 접수되었어요. 관리자가 승인하면 이 화면이 자동으로 메인으로 바뀝니다.
            </p>
          </div>
          {user?.email && (
            <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--bg-surface)]/60 px-3 py-1 text-[11px] text-[var(--fg-muted)] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--leaf)]" />
              {user.email}
            </div>
          )}
        </motion.section>

        {/* 빠른 승인 — 강조 카드 */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-10 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--bloom)]/20 bg-[var(--bloom-soft)]/60 p-5 shadow-[var(--shadow-sm)] backdrop-blur-sm"
        >
          <div
            aria-hidden
            className="absolute left-0 top-0 h-full w-[3px]"
            style={{ background: 'var(--bloom)' }}
          />
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-[var(--shadow-sm)]">
              <Mail size={16} className="text-[var(--bloom)]" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[14px] font-medium text-[var(--fg-primary)]">빠른 승인 받기</p>
              <p className="text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
                아래 이메일로 <span className="font-medium text-[var(--fg-primary)]">"습관 정원 가입 신청"</span> 한 줄만 보내주시면 확인 후 바로 승인해드릴게요.
              </p>
              <a
                href="mailto:alpaomegastartend@gmail.com?subject=%EC%8A%B5%EA%B4%80%20%EC%A0%95%EC%9B%90%20%EA%B0%80%EC%9E%85%20%EC%8B%A0%EC%B2%AD"
                className="mt-1 inline-flex items-center gap-1.5 break-all text-[12.5px] font-medium text-[var(--bloom)] underline-offset-4 hover:underline"
              >
                alpaomegastartend@gmail.com
                <span aria-hidden>→</span>
              </a>
            </div>
          </div>
        </motion.section>

        {/* 만든 사람 */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 p-5 shadow-[var(--shadow-sm)] backdrop-blur-sm"
        >
          <p className="text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
            안녕하세요. 이 앱은 <span className="font-medium text-[var(--fg-primary)]">조나단</span>이 가족·지인과 함께 쓰려고 개인적으로 만든 프로젝트입니다. 광고도 없고, 데이터는 본인에게만 보입니다.
          </p>
        </motion.section>

        {/* 소개 */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
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

        {/* 주요 기능 */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.36, ease: [0.22, 1, 0.36, 1] }}
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

        {/* 데이터 안전성 */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.44, ease: [0.22, 1, 0.36, 1] }}
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

        {/* 로그아웃 */}
        <div className="mt-10 flex flex-col items-center gap-2">
          <button
            onClick={() => signOutUser()}
            className="text-[12.5px] text-[var(--fg-muted)] underline-offset-4 hover:underline"
          >
            로그아웃
          </button>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--fg-faint)]">
            <span className="h-px w-6 bg-[var(--border)]" />
            <span className="tracking-wider">MADE BY 조나단</span>
            <span className="h-px w-6 bg-[var(--border)]" />
          </div>
        </div>
      </div>
    </div>
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

function PulseRing() {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ background: 'var(--leaf)', opacity: 0.12 }}
        animate={{ scale: [1, 1.35, 1], opacity: [0.18, 0, 0.18] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.span
        aria-hidden
        className="absolute inset-2 rounded-full"
        style={{ background: 'var(--leaf)', opacity: 0.18 }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.24, 0.06, 0.24] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
      />
      <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[var(--shadow-md)]">
        <span className="text-[22px] leading-none">🌱</span>
      </div>
    </div>
  );
}
