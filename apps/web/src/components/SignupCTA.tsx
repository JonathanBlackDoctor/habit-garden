import { useState } from 'react';
import { Sparkles, ArrowRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { upgradeGuestWithGoogle } from '@/lib/auth';
import { useIsGuest, useIsPremium } from '@/lib/features';

const OWNER_EMAIL = 'alpaomegastartend@gmail.com';

/**
 * 가입자 전용(AI·서버) 기능 자리에 표시하는 가입 유도 카드.
 * - 게스트(익명): Google 가입 버튼 → 데이터 유지한 채 계정 업그레이드.
 * - 미승인 정식 계정: 승인 대기 안내 + 빠른 승인 이메일.
 * - 승인 사용자에게는 아무것도 렌더링하지 않음(방어적).
 */
export default function SignupCTA({
  title = '가입하면 열리는 기능',
  desc = 'AI 코치·주간 인사이트·여러 기기 동기화·푸시 알림은 가입한 분께 열려요.',
}: {
  title?: string;
  desc?: string;
}) {
  const isGuest = useIsGuest();
  const isPremium = useIsPremium();
  const [loading, setLoading] = useState(false);

  if (isPremium) return null;

  const onUpgrade = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await upgradeGuestWithGoogle();
    } catch (e) {
      console.error(e);
      toast.error('가입에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 미승인 정식 계정 — 승인 대기 안내
  if (!isGuest) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-[var(--bloom)]" />
          <p className="text-sm font-medium text-[var(--fg-primary)]">승인 대기 중</p>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
          {desc} 승인되면 자동으로 열립니다. 빠른 승인을 원하시면{' '}
          <a
            href={`mailto:${OWNER_EMAIL}?subject=${encodeURIComponent('습관 정원 가입 신청')}`}
            className="text-[var(--leaf)] underline-offset-2 hover:underline"
          >
            {OWNER_EMAIL}
          </a>{' '}
          로 알려주세요.
        </p>
      </div>
    );
  }

  // 게스트 — Google 가입 유도
  return (
    <div className="relative overflow-hidden rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
      <div
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: 'linear-gradient(180deg, var(--leaf) 0%, var(--bloom) 100%)' }}
      />
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-[var(--leaf)]" />
        <p className="text-sm font-medium text-[var(--fg-primary)]">{title}</p>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">{desc}</p>
      <button
        onClick={onUpgrade}
        disabled={loading}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--leaf)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-sm)] active:opacity-80 disabled:opacity-50"
      >
        {loading ? '연결 중…' : 'Google로 가입하고 내 정원 지키기'}
        {!loading && <ArrowRight size={16} />}
      </button>
      <p className="mt-2 text-center text-[11px] text-[var(--fg-faint)]">
        가입도 사용도 모두 무료예요
      </p>
    </div>
  );
}
