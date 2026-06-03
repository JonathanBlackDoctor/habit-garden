import * as React from 'react';
import { cn } from '@/lib/utils';

const padMap = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
} as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 내부 패딩. 리스트(divide-y)를 담을 땐 'none' */
  padding?: keyof typeof padMap;
}

/**
 * 표면 카드 프리미티브. 화면에서 `.card`/raw className 대신 사용한다.
 * 색·radius·그림자는 토큰 경유로 고정한다.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'md', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[var(--radius)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]',
        padMap[padding],
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';
