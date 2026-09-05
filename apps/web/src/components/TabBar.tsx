import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useVisibleTabs } from '@/lib/tabs';
import { useScrollToTop } from '@/lib/scrollContext';
import { useTabBadges } from '@/lib/tabBadges';

export default function TabBar() {
  const tabs = useVisibleTabs();
  const badges = useTabBadges();
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
          return (
          <NavLink
            key={to}
            to={to}
            data-tour={to === '/prayers' ? 'prayer-tab' : undefined}
            end={to === '/'}
            onClick={(e) => handleReTap(e, to)}
            className={({ isActive }) =>
              cn(
                'flex min-h-[43px] flex-1 flex-col items-center gap-[6px] pb-2 pt-1 text-[13.5px] tracking-[-0.01em] transition-colors',
                isActive
                  ? 'font-semibold text-[var(--fg-primary)]'
                  : 'text-[var(--fg-faint)]'
              )
            }
          >
            {({ isActive }) => (
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
            )}
          </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
