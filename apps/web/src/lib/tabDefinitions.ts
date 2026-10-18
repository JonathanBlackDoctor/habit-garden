export type TabDef = {
  to: string;
  label: string;
  faith: boolean;
};

export const baseTabs: TabDef[] = [
  { to: '/', label: '오늘', faith: false },
  { to: '/habits', label: '습관', faith: false },
  { to: '/prayers', label: '신앙', faith: true },
  { to: '/more', label: '더보기', faith: false },
];

// 에디토리얼에서는 핵심 두 기능만 표시한다. 클래식은 기존 메뉴를 유지한다.
export const editorialTabs: TabDef[] = [
  { to: '/', label: '습관', faith: false },
  { to: '/prayers', label: '기도', faith: true },
];

export function getVisibleTabs(
  faithEnabled: boolean,
  uiDesign: 'editorial' | 'classic' = 'classic',
): TabDef[] {
  const tabs = uiDesign === 'editorial' ? editorialTabs : baseTabs;
  return tabs.filter((tab) => !tab.faith || faithEnabled);
}
