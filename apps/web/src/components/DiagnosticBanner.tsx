import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import { getAuthDebug } from '@/lib/authDebug';

/**
 * 화면 하단의 진단 배너. pointer-events:none 으로 클릭이 그 아래 콘텐츠로 통과되게 한다.
 * (배너가 로그인 버튼을 가려 클릭을 가로채는 사고 방지)
 */
export default function DiagnosticBanner() {
  const loc = useLocation();
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const uid = useAppStore((s) => s.uid);

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
        pointerEvents: 'none', // 클릭이 디버그 배너를 통과해서 그 아래로 가도록
      }}
    >
      [DBG] path={loc.pathname} hash={typeof window !== 'undefined' ? window.location.hash : ''}
      {' '}authLoading={String(authLoading)} uid={uidShort} email={email}
      {'\n'}signInPath={dbg.signInPath} signInErr={dbg.signInErr}
      {'\n'}redirect={dbg.redirect} redirectErr={dbg.redirectErr}
      {'\n'}lastAuthEvent={dbg.lastAuthEvent}
      {'\n'}lastClick={dbg.lastClick} loginBtnClicked={dbg.loginBtnClicked}
    </div>
  );
}
