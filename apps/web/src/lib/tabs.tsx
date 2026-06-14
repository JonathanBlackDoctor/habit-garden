import { Home, CheckSquare, Flower2, HandHeart, MoreHorizontal } from 'lucide-react';
import { useFaithEnabled } from '@/lib/features';

export type TabDef = {
  to: string;
  icon: typeof Home;
  label: string;
  faith: boolean;
};

// 진척(통계·배지·리포트)은 매일 보는 정보가 아니라 가끔 들여다보는 회고성 화면이라
// 하단 탭에서 빼고 '더보기'의 바로가기로 옮겼다. (레벨·스트릭은 오늘 탭 상단에 상존)
export const baseTabs: TabDef[] = [
  { to: '/',         icon: Home,           label: '오늘',   faith: false },
  { to: '/habits',   icon: CheckSquare,    label: '습관',   faith: false },
  { to: '/garden',   icon: Flower2,        label: '정원',   faith: false },
  { to: '/prayers',  icon: HandHeart,      label: '기도',   faith: true  },
  { to: '/more',     icon: MoreHorizontal, label: '더보기', faith: false },
];

export function useVisibleTabs(): TabDef[] {
  const faithEnabled = useFaithEnabled();
  return baseTabs.filter((t) => !t.faith || faithEnabled);
}
