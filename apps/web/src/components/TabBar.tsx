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
  // 신앙 탭(/prayers)은 기도 ↔ 말씀 적용, 정원 탭(/garden)은 내 정원 ↔ 둘러보기 뷰를
  // 토글하고, 그 외 탭은 맨 위로 스크롤한다.
  const handleReTap = (e: React.MouseEvent, to: string) => {
    if (!isActivePath(to)) return; // 다른 탭으로 이동 — NavLink 기본 동작
    if (to === '/prayers') {
      e.preventDefault();
      const isApp = new URLSearchParams(location.search).get('view') === 'application';
      navigate(isApp ? '/prayers' : '/prayers?view=application');
      return;
    }
    if (to === '/garden') {
      e.preventDefault();
      const isBrowse = new URLSearchParams(location.search).get('view') === 'browse';
      navigate(isBrowse ? '/garden' : '/garden?view=browse');
      return;
    }
    scrollToTop();
  };
  return (
    <nav className="tab-bar-safe fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--border)] bg-[var(--bg-surface)]">
      <div data-tour="tabbar" className="mx-auto flex w-full max-w-[480px] items-center justify-around">
        {tabs.map(({ to, icon: Icon, label }) => {
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
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                isActive
                  ? 'text-[var(--leaf)]'
                  : 'text-[var(--fg-faint)]'
              )
            }
          >
            {({ isActive }) => (
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
            )}
          </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
