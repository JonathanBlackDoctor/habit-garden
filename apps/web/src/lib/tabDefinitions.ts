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

export function getVisibleTabs(faithEnabled: boolean): TabDef[] {
  return baseTabs.filter((tab) => !tab.faith || faithEnabled);
}
