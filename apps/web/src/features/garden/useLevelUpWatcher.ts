import { useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { ProgressDoc } from 'shared/types/firestore';

/**
 * 레벨업 감지기 — progress/main 의 level 증가를 감지해 레벨업 창을 띄운다.
 * 서버(levelEngine)가 보상을 자동 지급하므로, 클라이언트는 변화만 감지해 연출한다.
 * AppLayout 에 한 번만 마운트한다(중복 구독 방지).
 */
export function useLevelUpWatcher() {
  const uid = useAppStore((s) => s.uid);
  const showLevelUp = useAppStore((s) => s.showLevelUp);
  // 마지막으로 본 레벨. 첫 스냅샷·사용자 전환 시에는 연출하지 않는다(null = 미초기화).
  const lastLevel = useRef<number | null>(null);

  useEffect(() => {
    if (!uid) return;
    lastLevel.current = null; // 사용자 전환 시 초기화
    return onSnapshot(doc(db, 'users', uid, 'progress', 'main'), (snap) => {
      if (!snap.exists()) return;
      const level = (snap.data() as ProgressDoc).level ?? 1;
      const prev = lastLevel.current;
      lastLevel.current = level;
      // 첫 스냅샷은 기준선만 잡고 연출하지 않는다.
      if (prev != null && level > prev) {
        showLevelUp(prev, level);
      }
    });
  }, [uid, showLevelUp]);
}
