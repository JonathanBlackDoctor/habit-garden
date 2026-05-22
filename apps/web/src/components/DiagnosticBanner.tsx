import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/lib/store';

/**
 * 화면 어느 분기로 갔는지 즉시 보이게 하는 진단 배너.
 * 모바일에서 콘솔을 못 보는 사용자가 "흰 화면" 증상의 원인을 캡쳐로 알릴 수 있게 한다.
 * 빌드 시 ?debug=1 쿼리 또는 항상 표시 (현재 항상 표시 — 문제 해결 후 제거 예정).
 */
export default function DiagnosticBanner() {
  const loc = useLocation();
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const uid = useAppStore((s) => s.uid);

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
        background: 'rgba(0,0,0,0.78)',
        color: '#9EFF9E',
        fontSize: 10,
        lineHeight: 1.3,
        padding: '4px 8px',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      [DBG] path={loc.pathname} hash={typeof window !== 'undefined' ? window.location.hash : ''}
      {'  '}authLoading={String(authLoading)} uid={uidShort} email={email}
    </div>
  );
}
