import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold leading-tight',
  {
    variants: {
      variant: {
        neutral:      'bg-[var(--bg-base)] text-[var(--fg-muted)]',
        leaf:         'bg-[var(--leaf-soft)] text-[var(--leaf)]',
        bloom:        'bg-[var(--bloom)] text-white',
        'bloom-soft': 'bg-[var(--bloom-soft)] text-[var(--bloom)]',
        sky:          'bg-[var(--sky-soft)] text-[var(--sky)]',
        danger:       'bg-[var(--danger-soft)] text-[var(--danger)]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/** 시맨틱 알약(pill). 화면마다 제각각이던 카운트/상태 칩을 통일한다. */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
