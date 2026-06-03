import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--leaf)] disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        ghost:  'text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)] active:opacity-70',
        onDark: 'text-white/90 hover:bg-white/15 active:bg-white/20',
        danger: 'text-[var(--danger)] hover:bg-[var(--danger-soft)] active:opacity-70',
      },
      // 시각 크기는 작아도 터치 타깃은 44px(md)/36px(sm) 확보
      size: {
        md: 'h-11 w-11',
        sm: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {}

/** 아이콘 전용 버튼. 작은 아이콘이라도 44px 터치 타깃을 보장한다. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';

export { iconButtonVariants };
