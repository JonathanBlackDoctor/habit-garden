import { useCallback, useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { PointLedgerDoc } from 'shared/types/firestore';

export interface PointLedgerEntry extends PointLedgerDoc {
  id: string;
}

const PAGE_SIZE = 50;

/**
 * 포인트 증감 원장(users/{uid}/pointLedger)을 최신순으로 구독한다.
 * '더 보기'를 누르면 PAGE_SIZE 만큼 더 불러온다(서버 limit 만 늘려 실시간 갱신 유지).
 */
export function usePointLedger() {
  const uid = useAppStore((s) => s.uid);
  const [entries, setEntries] = useState<PointLedgerEntry[]>([]);
  const [count, setCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  // uid 가 바뀌면 페이지 크기 초기화
  useEffect(() => {
    setCount(PAGE_SIZE);
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // limit+1 로 한 건 더 읽어 다음 페이지 존재 여부(hasMore)를 판단한다.
    const q = query(
      collection(db, 'users', uid, 'pointLedger'),
      orderBy('createdAt', 'desc'),
      limit(count + 1),
    );
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as PointLedgerDoc) }));
      setHasMore(docs.length > count);
      setEntries(docs.slice(0, count));
      setLoading(false);
    });
  }, [uid, count]);

  const loadMore = useCallback(() => setCount((c) => c + PAGE_SIZE), []);

  return { entries, loading, hasMore, loadMore };
}
