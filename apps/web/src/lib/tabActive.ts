import { createContext, useContext, useEffect, useRef, useState } from 'react';

// 현재 활성 탭 경로 + 재탭 신호(nonce). nonce는 이미 활성인 탭을 다시 눌렀을 때 증가.
export type TabActive = { path: string | null; nonce: number };
export const TabActiveContext = createContext<TabActive>({ path: null, nonce: 0 });

// 해당 path 탭이 '활성화'되거나(다른 탭 → 이 탭) '재탭'될 때마다 1씩 증가하는 키.
// BloomBadge burstKey, CountUp replayKey 등에 넘겨 탭 진입/재탭 시 애니메이션을 재생.
// 슬라이드/스크롤 전환이 끝난 뒤(SETTLE_MS) 발화 → 화면 밖에서 재생돼 못 보는 마스킹 방지.
const SETTLE_MS = 380;
export function useTabBloomKey(path: string): number {
  const { path: active, nonce } = useContext(TabActiveContext);
  const [key, setKey] = useState(0);
  const prev = useRef<TabActive | null>(null);
  useEffect(() => {
    const isActive = active === path;
    if (prev.current === null) { prev.current = { path: active, nonce }; return; } // 최초 마운트는 건너뜀
    const becameActive = isActive && prev.current.path !== path; // 다른 탭 → 이 탭
    const retapped = isActive && nonce !== prev.current.nonce;   // 활성 상태에서 재탭
    prev.current = { path: active, nonce };
    if (becameActive || retapped) {
      const id = setTimeout(() => setKey((k) => k + 1), SETTLE_MS);
      return () => clearTimeout(id); // 전환이 빠르게 중첩되면 이전 예약 취소
    }
  }, [active, nonce, path]);
  return key;
}
