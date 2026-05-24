import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { signOutUser, useAuth } from '@/lib/auth';

export default function ProtectedRoute() {
  const { user, profile, authLoading } = useAuth();
  const [stuckTooLong, setStuckTooLong] = useState(false);

  useEffect(() => {
    if (authLoading || !user || profile) {
      setStuckTooLong(false);
      return;
    }
    const t = setTimeout(() => setStuckTooLong(true), 8000);
    return () => clearTimeout(t);
  }, [authLoading, user, profile]);

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

  // 익명 게스트: 프로필 없이 바로 로컬 기능으로 진입.
  if (user.isAnonymous) return <Outlet />;

  // 프로필 문서는 클라이언트 self-create 폴백 또는 ensureUserProfile Cloud Function이 만듭니다.
  // 8초 이상 도착하지 않으면 보안 규칙/네트워크 문제 가능성을 안내합니다.
  if (!profile) {
    if (!stuckTooLong) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-base)]">
          <div className="flex flex-col items-center gap-3 text-[var(--fg-muted)]">
            <div className="text-3xl">🌱</div>
            <p className="text-sm">계정 초기화 중…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--bg-base)] px-6 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="text-sm text-[var(--fg-primary)]">계정 정보를 가져오지 못했어요.</p>
        <p className="max-w-xs text-xs leading-relaxed text-[var(--fg-muted)]">
          네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요. 문제가 계속되면<br />
          <span className="text-[var(--fg-primary)]">alpaomegastartend@gmail.com</span> 으로 알려주세요.
        </p>
        <div className="mt-2 flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-white px-4 py-2 text-xs text-[var(--fg-primary)] shadow-[var(--shadow-sm)]"
          >
            새로고침
          </button>
          <button
            onClick={() => signOutUser()}
            className="rounded-[var(--radius)] px-4 py-2 text-xs text-[var(--fg-muted)] underline-offset-4 hover:underline"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  // 미승인(pending) 정식 계정도 로컬 기능에 진입할 수 있다.
  // AI·서버 프리미엄 기능은 화면 내부에서 useIsPremium() 으로 게이트한다.
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
