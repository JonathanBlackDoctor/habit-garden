import { Home, CheckSquare, Flower2, HandHeart, BarChart2, MoreHorizontal } from 'lucide-react';
import { useFaithEnabled } from '@/lib/features';

export type TabDef = {
  to: string;
  icon: typeof Home;
  label: string;
  faith: boolean;
};

export const baseTabs: TabDef[] = [
  { to: '/',         icon: Home,           label: '오늘',   faith: false },
  { to: '/habits',   icon: CheckSquare,    label: '습관',   faith: false },
  { to: '/garden',   icon: Flower2,        label: '정원',   faith: false },
  { to: '/prayers',  icon: HandHeart,      label: '기도',   faith: true  },
  { to: '/progress', icon: BarChart2,      label: '진척',   faith: false },
  { to: '/more',     icon: MoreHorizontal, label: '더보기', faith: false },
];

export function useVisibleTabs(): TabDef[] {
  const faithEnabled = useFaithEnabled();
  return baseTabs.filter((t) => !t.faith || faithEnabled);
}
