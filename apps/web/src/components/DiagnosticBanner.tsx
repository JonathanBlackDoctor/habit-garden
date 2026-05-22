import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import { getAuthDebug } from '@/lib/authDebug';

/**
 * 화면 하단에 진단 정보를 항상 표시. 모바일에서 콘솔이 없는 상황에서도
 * path/auth 상태/마지막 auth 이벤트/리다이렉트 결과를 캡쳐로 알릴 수 있게 한다.
 * 문제 해결 후 제거.
 */
export default function DiagnosticBanner() {
  const loc = useLocation();
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const uid = useAppStore((s) => s.uid);

  // 글로벌 __authDbg 변경을 받아 다시 그리기
  const [, force] = useState(0);
  useEffect(() => {
    const handler = () => force((n) => n + 1);
    window.addEventListener('authdbg', handler);
    return () => window.removeEventListener('authdbg', handler);
  }, []);

  const dbg = getAuthDebug();
  const uidShort = uid ? uid.slice(0, 6) + '…' : 'null';
  const email = (user as any)?.email ?? '-';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.82)',
        color: '#9EFF9E',
        fontSize: 10,
        lineHeight: 1.35,
        padding: '4px 8px',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      [DBG] path={loc.pathname} hash={typeof window !== 'undefined' ? window.location.hash : ''}
      {' '}authLoading={String(authLoading)} uid={uidShort} email={email}
      {'\n'}
      signInPath={dbg.signInPath} signInErr={dbg.signInErr}
      {'\n'}
      redirect={dbg.redirect} redirectErr={dbg.redirectErr}
      {'\n'}
      lastAuthEvent={dbg.lastAuthEvent}
    </div>
  );
}
