import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export default function ProtectedRoute() {
  const { user, profile, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-3 text-[var(--fg-muted)]">
          <div className="text-3xl">🌱</div>
          <p className="text-sm">로딩 중…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // 프로필 문서는 ensureUserProfile (Auth onCreate)에 의해 짧은 시간 안에 생성됨.
  // 아직 도착하지 않은 경우 로딩 표시.
  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-3 text-[var(--fg-muted)]">
          <div className="text-3xl">🌱</div>
          <p className="text-sm">계정 초기화 중…</p>
        </div>
      </div>
    );
  }

  if (profile.status === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  if (profile.status === 'rejected') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--bg-base)] px-6">
        <div className="text-4xl">🚫</div>
        <p className="text-sm text-[var(--fg-primary)]">접근이 거부되었습니다.</p>
        <p className="text-xs text-[var(--fg-faint)] text-center">
          이 계정은 이용이 허용되지 않았습니다. 관리자에게 문의하세요.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
