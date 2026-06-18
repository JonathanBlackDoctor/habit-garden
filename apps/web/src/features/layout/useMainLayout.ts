import { useCallback, useMemo } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { DEFAULT_ORDER, isMainWidgetId, mergeWidgetOrder, type MainWidgetId } from './widgetOrder';

// 순수 로직·상수·타입은 widgetOrder.ts 에서 정의하고 여기서 다시 내보낸다
// (기존 import 경로 호환). firebase 에 의존하는 훅만 이 파일에 둔다.
export * from './widgetOrder';

/** 현재 사용자의 오늘 탭 위젯 순서 (설정에서 읽어 정규화). */
export function useMainWidgetOrder(): MainWidgetId[] {
  const saved = useAppStore((s) => s.settings?.mainWidgetOrder);
  return useMemo(() => mergeWidgetOrder(saved), [saved]);
}

/** 현재 사용자의 숨김 위젯 목록. */
export function useHiddenWidgets(): MainWidgetId[] {
  const saved = useAppStore((s) => s.settings?.mainHiddenWidgets);
  return useMemo(() => (saved ?? []).filter(isMainWidgetId), [saved]);
}

/** 위젯 순서 + 숨김 목록을 함께 저장(merge)한다. settings/main 구독을 통해 자동 동기화된다. */
export function useSaveMainLayout() {
  const uid = useAppStore((s) => s.uid);

  const saveLayout = useCallback(
    async (order: MainWidgetId[], hidden: MainWidgetId[]) => {
      if (!uid) return;
      await setDoc(
        doc(db, 'users', uid, 'settings', 'main'),
        { mainWidgetOrder: order, mainHiddenWidgets: hidden, updatedAt: serverTimestamp() },
        { merge: true },
      );
    },
    [uid],
  );

  const resetLayout = useCallback(async () => {
    if (!uid) return;
    await setDoc(
      doc(db, 'users', uid, 'settings', 'main'),
      { mainWidgetOrder: [...DEFAULT_ORDER], mainHiddenWidgets: [], updatedAt: serverTimestamp() },
      { merge: true },
    );
  }, [uid]);

  return { saveLayout, resetLayout };
}
