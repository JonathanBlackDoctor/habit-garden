import { useCallback, useMemo } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';

/**
 * 오늘(메인) 탭에서 사용자가 자유롭게 순서를 바꿀 수 있는 위젯들.
 * 상단바(레벨·포인트)와 회고 강조 배너는 정렬 대상이 아니며 항상 고정이다.
 * 여기 나열된 순서가 신규 사용자·미설정 사용자의 기본 순서가 된다.
 */
export const MAIN_WIDGET_IDS = [
  'recap',        // 어제 돌아보기
  'habits',       // 오늘의 습관
  'todos',        // 할 일 · 회고
  'garden',       // 정원 미리보기
  'condition',    // 컨디션
  'morningBrief', // 오늘의 브리프
  'coach',        // AI 코치
  'weeklyQuest',  // 주간 퀘스트
  'season',       // 시즌 챌린지
  'oneYearAgo',   // 1년 전 오늘
  'comeback',     // 컴백 환영
  'faith',        // 기도 · 말씀
] as const;

export type MainWidgetId = (typeof MAIN_WIDGET_IDS)[number];

const DEFAULT_ORDER: MainWidgetId[] = [...MAIN_WIDGET_IDS];

function isMainWidgetId(id: string): id is MainWidgetId {
  return (MAIN_WIDGET_IDS as readonly string[]).includes(id);
}

/**
 * 저장된 순서를 정규화한다.
 * - 알 수 없는(삭제된) id 는 버린다.
 * - 새로 추가돼 저장 순서에 없는 위젯은 기본 위치에 끼워 넣는다.
 * 덕분에 위젯을 추가/제거해도 사용자의 기존 순서가 깨지지 않는다.
 */
export function mergeWidgetOrder(saved?: string[]): MainWidgetId[] {
  const valid = (saved ?? []).filter(isMainWidgetId);
  if (valid.length === 0) return [...DEFAULT_ORDER];
  const result = [...valid];
  DEFAULT_ORDER.forEach((id, defaultIndex) => {
    if (!result.includes(id)) {
      const insertAt = Math.min(defaultIndex, result.length);
      result.splice(insertAt, 0, id);
    }
  });
  return result;
}

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
