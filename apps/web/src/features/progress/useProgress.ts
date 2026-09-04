import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { ProgressDoc } from 'shared/types/firestore';

/**
 * users/{uid}/progress/main 구독 — 스트릭 등 통계 읽기 전용.
 * 문서는 서버 트리거들이 merge 쓰기로 암묵 생성하므로 클라이언트 부트스트랩이 없다.
 * 문서가 아직 없으면 null — 소비자는 `?? 0` 기본값으로 처리한다.
 */
export function useProgress(): ProgressDoc | null {
  const uid = useAppStore((s) => s.uid);
  const [progress, setProgress] = useState<ProgressDoc | null>(null);

  useEffect(() => {
    if (!uid) { setProgress(null); return; }
    return onSnapshot(doc(db, 'users', uid, 'progress', 'main'), (snap) => {
      setProgress(snap.exists() ? (snap.data() as ProgressDoc) : null);
    });
  }, [uid]);

  return progress;
}
