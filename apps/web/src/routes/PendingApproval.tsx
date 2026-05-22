import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOutUser } from '@/lib/auth';
import { useAppStore } from '@/lib/store';

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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[var(--bg-base)] px-6">
      <div className="text-5xl">⏳</div>
      <h2 className="text-lg font-semibold text-[var(--fg-primary)]">승인 대기 중</h2>
      <p className="max-w-xs text-center text-sm text-[var(--fg-muted)]">
        관리자가 가입을 승인하면 자동으로 입장됩니다.<br />
        잠시만 기다려주세요.
      </p>
      {user?.email && (
        <p className="text-xs text-[var(--fg-faint)]">로그인: {user.email}</p>
      )}
      <button
        onClick={() => signOutUser()}
        className="mt-2 text-sm text-[var(--fg-muted)] underline"
      >
        로그아웃
      </button>
    </div>
  );
}
