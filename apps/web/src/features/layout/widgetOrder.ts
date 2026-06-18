/**
 * 오늘(메인) 탭 위젯 순서·숨김의 순수 로직 (firebase 비의존 — 단위 테스트 가능).
 * 저장/구독 등 부수효과가 있는 훅은 useMainLayout.ts 에 둔다.
 */

/**
 * 오늘(메인) 탭에서 사용자가 자유롭게 순서를 바꿀 수 있는 위젯들.
 * 상단바(레벨·포인트)와 회고 강조 배너는 정렬 대상이 아니며 항상 고정이다.
 * 여기 나열된 순서가 신규 사용자·미설정 사용자의 기본 순서가 된다.
 */
export const MAIN_WIDGET_IDS = [
  'recap',        // 아침 브리핑 (어제 돌아보기 + 오늘의 브리프 + 어제 다짐 실천)
  'habits',       // 오늘의 습관
  'todos',        // 할 일 · 회고
  'garden',       // 정원 미리보기
  'forecast',     // 내일 정원 예보 (선제적 생기 피드백)
  'condition',    // 컨디션
  'coach',        // AI 코치
  'weeklyQuest',  // 주간 퀘스트
  'season',       // 시즌 챌린지
  'oneYearAgo',   // 1년 전 오늘
  'comeback',     // 컴백 환영
  'faith',        // 기도 · 말씀
] as const;

export type MainWidgetId = (typeof MAIN_WIDGET_IDS)[number];

export const DEFAULT_ORDER: MainWidgetId[] = [...MAIN_WIDGET_IDS];

/**
 * 초보자 코어 — 신규 사용자 첫 화면에 보여줄 위젯(핵심 루프: 습관→정원, 할 일).
 * 나머지 위젯은 처음엔 숨겨 두고 '위젯 편집'에서 직접 켤 수 있다.
 */
export const BEGINNER_CORE_WIDGETS: MainWidgetId[] = ['habits', 'garden', 'todos'];

/** 신규 사용자 첫 실행 시 기본으로 숨길 위젯 (코어를 제외한 전부). */
export const BEGINNER_HIDDEN_WIDGETS: MainWidgetId[] = MAIN_WIDGET_IDS.filter(
  (id) => !BEGINNER_CORE_WIDGETS.includes(id),
);

export function isMainWidgetId(id: string): id is MainWidgetId {
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
