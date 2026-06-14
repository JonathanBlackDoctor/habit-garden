import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useVisibleTabs } from '@/lib/tabs';
import { useScrollToTop } from '@/lib/scrollContext';

export default function TabBar() {
  const tabs = useVisibleTabs();
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
    <nav className="tab-bar-safe fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--border)] bg-[var(--bg-surface)]">
      <div data-tour="tabbar" className="mx-auto flex w-full max-w-[480px] items-center justify-around">
        {tabs.map(({ to, icon: Icon, label }) => (
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
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={isActive ? 'text-[var(--leaf)]' : 'text-[var(--fg-faint)]'}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
