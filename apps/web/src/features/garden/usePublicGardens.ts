import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PublicGardenDoc } from 'shared/types/firestore';

function updatedMillis(g: PublicGardenDoc): number {
  const t = g.updatedAt as { toMillis?: () => number; seconds?: number } | undefined;
  return t?.toMillis?.() ?? (t?.seconds ?? 0) * 1000;
}

/**
 * 둘러보기 목록: 닉네임을 설정한 모든 사용자의 공개 정원.
 * 닉네임 미설정자는 gardens 문서가 없어 자연히 제외된다. 최신 활동순 정렬.
 */
export function useGardenList(): { gardens: PublicGardenDoc[]; loading: boolean } {
  const [gardens, setGardens] = useState<PublicGardenDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'gardens'),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as PublicGardenDoc)
          .filter((g) => (g.nickname ?? '').trim() !== '');
        list.sort((a, b) => updatedMillis(b) - updatedMillis(a));
        setGardens(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  return { gardens, loading };
}

/** 특정 사용자의 공개 정원 단건 구독. */
export function useOtherGarden(uid: string | null): { garden: PublicGardenDoc | null; loading: boolean } {
  const [garden, setGarden] = useState<PublicGardenDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setGarden(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'gardens', uid),
      (snap) => {
        setGarden(snap.exists() ? (snap.data() as PublicGardenDoc) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  return { garden, loading };
}
