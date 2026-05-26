import { createContext, useContext, useEffect, useRef, useState } from 'react';

// 현재 활성 탭의 경로. keep-alive 캐러셀에서 어떤 탭이 보이는지 하위 페이지에 전달.
export const TabActiveContext = createContext<string | null>(null);

// 해당 path 탭이 '비활성 → 활성'으로 바뀔 때마다 1씩 증가하는 키.
// BloomBadge의 burstKey 등에 넘겨 탭에 들어올 때 애니메이션을 다시 재생하는 용도.
export function useTabBloomKey(path: string): number {
  const active = useContext(TabActiveContext);
  const [key, setKey] = useState(0);
  const wasActive = useRef<boolean | null>(null);
  useEffect(() => {
    const isActive = active === path;
    if (wasActive.current === false && isActive) setKey((k) => k + 1);
    wasActive.current = isActive;
  }, [active, path]);
  return key;
}
