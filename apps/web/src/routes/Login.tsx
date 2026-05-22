import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle } from '@/lib/auth';
import { useAppStore } from '@/lib/store';
import { isAllowedUser } from '@/lib/auth';
import { setAuthDebug } from '@/lib/authDebug';

export default function Login() {
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user && isAllowedUser(user.uid)) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async () => {
    setAuthDebug({ loginBtnClicked: 'yes @ ' + new Date().toTimeString().slice(0, 8) });
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-[var(--bg-base)] px-6">
      {/* 로고 */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-6xl">🌱</div>
        <h1 className="text-2xl font-semibold text-[var(--fg-primary)]">습관 정원</h1>
        <p className="text-center text-sm text-[var(--fg-muted)]">
          매일 습관을 가꾸면<br />정원이 자랍니다
        </p>
      </div>

      {/* 로그인 버튼 */}
      <button
        onClick={handleLogin}
        className="flex w-full max-w-xs items-center justify-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-white px-6 py-3 text-sm font-medium text-[var(--fg-primary)] shadow-[var(--shadow-sm)] transition-opacity active:opacity-70"
      >
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Google로 로그인
      </button>

      <p className="text-xs text-[var(--fg-faint)]">본인 계정으로만 접근 가능합니다.</p>
    </div>
  );
}
