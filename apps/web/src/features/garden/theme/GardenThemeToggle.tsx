import { motion } from 'framer-motion';
import { Leaf, Sunset } from 'lucide-react';
import { useGardenTheme } from './useGardenTheme';
import { cn } from '@/lib/utils';

export default function GardenThemeToggle() {
  const theme = useGardenTheme((s) => s.theme);
  const toggle = useGardenTheme((s) => s.toggle);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={theme === 'sunset'}
      aria-label={theme === 'meadow' ? '저녁햇살 무드로 전환' : '메도우 무드로 전환'}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      }}
      className={cn(
        'relative inline-flex items-center gap-0.5 rounded-full px-1 py-1',
        'border border-[var(--border-soft)] bg-white/70 backdrop-blur-sm',
        'shadow-[var(--shadow-sm)] outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--leaf)] focus-visible:ring-offset-1',
      )}
    >
      <span className="relative z-10 flex h-5 w-7 items-center justify-center">
        <Leaf size={12} className={theme === 'meadow' ? 'text-white' : 'text-[var(--fg-faint)]'} />
      </span>
      <span className="relative z-10 flex h-5 w-7 items-center justify-center">
        <Sunset size={12} className={theme === 'sunset' ? 'text-white' : 'text-[var(--fg-faint)]'} />
      </span>
      <motion.span
        aria-hidden
        className="absolute top-1 bottom-1 w-7 rounded-full"
        animate={{
          left: theme === 'meadow' ? 4 : 32,
          background: theme === 'meadow'
            ? 'linear-gradient(135deg, #4F7A37, #3E5F2A)'
            : 'linear-gradient(135deg, #C24E2A, #8A2E12)',
        }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      />
    </button>
  );
}
