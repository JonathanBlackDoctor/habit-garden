import { NavLink } from 'react-router-dom';
import { Home, CheckSquare, Flower2, BarChart2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/',         icon: Home,         label: '오늘' },
  { to: '/habits',   icon: CheckSquare,  label: '습관' },
  { to: '/garden',   icon: Flower2,      label: '정원' },
  { to: '/progress', icon: BarChart2,    label: '진척' },
  { to: '/more',     icon: MoreHorizontal, label: '더보기' },
];

export default function TabBar() {
  return (
    <nav className="tab-bar-safe fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="mx-auto flex w-full max-w-[480px] items-center justify-around">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
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
