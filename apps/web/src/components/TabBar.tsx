import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { CheckSquare, HandHeart, Home, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVisibleTabs } from '@/lib/tabs';
import { useScrollToTop } from '@/lib/scrollContext';
import { useTabBadges } from '@/lib/tabBadges';
import { useUiDesign } from '@/lib/features';

const CLASSIC_ICONS: Record<string, typeof Home> = {
  '/': Home,
  '/habits': CheckSquare,
  '/prayers': HandHeart,
  '/more': MoreHorizontal,
};

export default function TabBar() {
  const tabs = useVisibleTabs();
  const badges = useTabBadges();
  const uiDesign = useUiDesign();
  const classic = uiDesign === 'classic';
  const location = useLocation();
  const navigate = useNavigate();
  const scrollToTop = useScrollToTop();
  const isActivePath = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  // 이미 활성화된 탭을 다시 눌렀을 때의 동작.
  // 신앙 탭(/prayers)은 기도 ↔ 말씀 적용 뷰를 토글하고, 그 외 탭은 맨 위로 스크롤한다.
  const handleReTap = (e: React.MouseEvent, to: string) => {
    if (!isActivePath(to)) return; // 다른 탭으로 이동 — NavLink 기본 동작
    if (to === '/prayers') {
      e.preventDefault();
      const isApp = new URLSearchParams(location.search).get('view') === 'application';
      navigate(isApp ? '/prayers' : '/prayers?view=application');
      return;
    }
    scrollToTop();
  };
  return (
    <nav className="tab-bar-safe absolute bottom-0 left-0 right-0 z-40 border-t border-[var(--divider-soft)] bg-[var(--bg-base)] px-[18px] pt-[10px]">
      <div data-tour="tabbar" className="mx-auto flex w-full items-center justify-around">
        {tabs.map(({ to, label }) => {
          const badge = badges[to] ?? 0;
          const Icon = CLASSIC_ICONS[to] ?? MoreHorizontal;
          return (
          <NavLink
            key={to}
            to={to}
            data-tour={to === '/prayers' ? 'prayer-tab' : undefined}
            end={to === '/'}
            onClick={(e) => handleReTap(e, to)}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center transition-colors',
                classic ? 'gap-0.5 py-2 text-xs' : 'min-h-[43px] gap-[6px] pb-2 pt-1 text-[13.5px] tracking-[-0.01em]',
                isActive
                  ? classic ? 'font-medium text-[var(--leaf)]' : 'font-semibold text-[var(--fg-primary)]'
                  : 'text-[var(--fg-faint)]'
              )
            }
          >
            {({ isActive }) => (
              classic ? (
                <>
                  <span className="relative">
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.2 : 1.8}
                      className={isActive ? 'text-[var(--leaf)]' : 'text-[var(--fg-faint)]'}
                    />
                    {badge > 0 && (
                      <span
                        aria-label={`${badge}개 할 일`}
                        className="absolute -right-2.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--bg-surface)]"
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </span>
                  <span>{label}</span>
                </>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className={cn('h-1 w-1 rounded-full', isActive ? 'bg-[var(--leaf)]' : 'bg-transparent')}
                  />
                  <span className="flex items-baseline gap-[5px]">
                    <span>{label}</span>
                    {badge > 0 && <span aria-label={`${badge}개 할 일`} className="tabular-nums text-[12.5px] font-normal text-[var(--fg-faint)]">{badge > 99 ? '99+' : badge}</span>}
                  </span>
                </>
              )
            )}
          </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
