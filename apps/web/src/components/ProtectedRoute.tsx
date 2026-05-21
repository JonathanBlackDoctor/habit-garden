import { Navigate, Outlet } from 'react-router-dom';
import { isAllowedUser, useAuth } from '@/lib/auth';

export default function ProtectedRoute() {
  const { user, authLoading } = useAuth();

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
  if (!isAllowedUser(user.uid)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-base)]">
        <p className="text-[var(--fg-muted)]">접근 권한이 없습니다.</p>
      </div>
    );
  }

  return <Outlet />;
}
