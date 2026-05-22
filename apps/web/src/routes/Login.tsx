import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { signInWithGoogle } from '@/lib/auth';
import { useAppStore } from '@/lib/store';

export default function Login() {
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--bg-base)]">
      {/* 배경 그라데이션 블롭 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, var(--leaf-soft) 0%, rgba(231, 240, 221, 0) 70%), radial-gradient(80% 60% at 50% 100%, var(--bloom-soft) 0%, rgba(250, 238, 218, 0) 65%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }}
      />

      {/* 떠 있는 잎 모티프 */}
      <FloatingLeaf className="absolute left-6 top-24 text-[var(--leaf)]/30" delay={0} size={28} />
      <FloatingLeaf className="absolute right-10 top-40 text-[var(--leaf)]/20" delay={0.6} size={22} rotate={-20} />
      <FloatingLeaf className="absolute left-10 bottom-32 text-[var(--bloom)]/25" delay={1.2} size={20} rotate={35} />

      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center justify-between px-7 pb-10 pt-16">
        {/* 히어로 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-5"
        >
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 blur-2xl"
              style={{ background: 'radial-gradient(50% 50% at 50% 50%, var(--leaf-soft) 0%, transparent 70%)' }}
            />
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="text-[68px] leading-none"
            >
              🌱
            </motion.div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--fg-faint)]">Habit Garden</p>
            <h1 className="text-[34px] font-bold tracking-tight text-[var(--fg-primary)]">습관 정원</h1>
            <p className="mt-1 text-center text-[13px] leading-relaxed text-[var(--fg-muted)]">
              매일의 작은 습관이<br />당신의 정원을 자라게 합니다
            </p>
          </div>
        </motion.div>

        {/* 로그인 + 안내 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full flex-col items-center gap-5"
        >
          <button
            onClick={handleLogin}
            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white px-6 py-3.5 text-[15px] font-medium text-[var(--fg-primary)] shadow-[var(--shadow-md)] transition-all duration-200 active:scale-[0.985] active:opacity-90"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white to-[#FAFBF7] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            />
            <svg viewBox="0 0 24 24" width="18" height="18" className="relative">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="relative">Google 계정으로 시작하기</span>
          </button>

          {/* 안내 카드 */}
          <div className="relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 px-5 py-4 shadow-[var(--shadow-sm)] backdrop-blur-sm">
            <div
              aria-hidden
              className="absolute left-0 top-0 h-full w-[3px]"
              style={{ background: 'linear-gradient(180deg, var(--leaf) 0%, var(--bloom) 100%)' }}
            />
            <div className="space-y-2 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
              <p className="text-[var(--fg-primary)]">초대된 분만 사용할 수 있는 비공개 앱입니다.</p>
              <p>
                Google 로그인하면 자동으로 가입 신청이 접수돼요. 빠른 승인을 원하시면 아래 이메일로 알려주세요.
              </p>
            </div>
          </div>
        </motion.div>

        {/* 푸터 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col items-center gap-1 pt-4"
        >
          <div className="flex items-center gap-2 text-[11px] text-[var(--fg-faint)]">
            <span className="h-px w-6 bg-[var(--border)]" />
            <span className="tracking-wider">MADE BY 조나단</span>
            <span className="h-px w-6 bg-[var(--border)]" />
          </div>
          <a
            href="mailto:alpaomegastartend@gmail.com"
            className="text-[11px] text-[var(--fg-faint)] underline-offset-4 hover:underline"
          >
            alpaomegastartend@gmail.com
          </a>
        </motion.div>
      </div>
    </div>
  );
}

function FloatingLeaf({
  className,
  size = 24,
  rotate = 15,
  delay = 0,
}: { className?: string; size?: number; rotate?: number; delay?: number }) {
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ transformOrigin: 'center' }}
      initial={{ opacity: 0, rotate }}
      animate={{ opacity: 1, y: [0, -10, 0], rotate: [rotate, rotate + 8, rotate] }}
      transition={{
        opacity: { duration: 1.2, delay },
        y: { duration: 6, repeat: Infinity, ease: 'easeInOut', delay },
        rotate: { duration: 8, repeat: Infinity, ease: 'easeInOut', delay },
      }}
    >
      <path
        fill="currentColor"
        d="M12 2C7 6 4 10 4 14a8 8 0 0 0 16 0c0-4-3-8-8-12Zm0 4c3 3 5 6 5 9a5 5 0 0 1-10 0c0-3 2-6 5-9Z"
      />
    </motion.svg>
  );
}
