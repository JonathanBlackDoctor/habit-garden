import { useNavigate } from 'react-router-dom';
import { signOutUser } from '@/lib/auth';
import { Heart, Cloud, BookOpen, Settings, LogOut } from 'lucide-react';

const items = [
  { icon: Cloud,    label: '컨디션',   to: '/condition' },
  { icon: BookOpen, label: '플래너',   to: '/planner' },
  { icon: Heart,    label: '경건',     to: '/devotion' },
  { icon: Settings, label: '관리',     to: '/admin' },
];

export default function More() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-4 space-y-2">
      <h2 className="py-2 text-base font-semibold text-[var(--fg-primary)]">더보기</h2>
      {items.map(({ icon: Icon, label, to }) => (
        <button
          key={to}
          onClick={() => navigate(to)}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] active:opacity-70"
        >
          <Icon size={18} className="text-[var(--leaf)]" />
          {label}
        </button>
      ))}
      <button
        onClick={() => signOutUser()}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3.5 text-sm text-red-500 shadow-[var(--shadow-sm)] active:opacity-70 mt-4"
      >
        <LogOut size={18} />
        로그아웃
      </button>
    </div>
  );
}
