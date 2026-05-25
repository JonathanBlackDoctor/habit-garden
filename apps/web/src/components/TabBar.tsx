import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useVisibleTabs } from '@/lib/tabs';
import { useScrollToTop } from '@/lib/scrollContext';

export default function TabBar() {
  const tabs = useVisibleTabs();
  const location = useLocation();
  const scrollToTop = useScrollToTop();
  const isActivePath = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
  return (
    <nav className="tab-bar-safe fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="mx-auto flex w-full max-w-[480px] items-center justify-around">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => { if (isActivePath(to)) scrollToTop(); }}
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
