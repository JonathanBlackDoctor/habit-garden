import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { isOnboarded } from './onboardingState';

/**
 * 첫 실행 시 온보딩을 자동으로 1회 띄운다.
 * - 인증 로딩이 끝나고 uid 가 있으며(게스트 포함) 아직 온보딩을 안 끝낸 기기에서만.
 * - 한 세션에 한 번만 트리거(ref 가드)하여 재실행 후 다시 뜨지 않게 한다.
 */
export function useOnboardingTrigger() {
  const uid = useAppStore((s) => s.uid);
  const authLoading = useAppStore((s) => s.authLoading);
  const startOnboarding = useAppStore((s) => s.startOnboarding);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (authLoading || !uid) return;
    if (isOnboarded()) return;
    firedRef.current = true;
    // 첫 화면 렌더가 안정된 뒤 띄운다
    const t = setTimeout(() => startOnboarding(), 400);
    return () => clearTimeout(t);
  }, [uid, authLoading, startOnboarding]);
}
