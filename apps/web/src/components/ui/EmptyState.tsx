import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  desc?: React.ReactNode;
  /** 1차 행동(예: Button) */
  action?: React.ReactNode;
  className?: string;
}

/** 데이터가 비었을 때의 통일된 표현(아이콘 + 제목 + 설명 + 액션). */
export function EmptyState({ icon, title, desc, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      {icon && <div className="mb-1 text-[var(--fg-faint)]">{icon}</div>}
      <p className="text-sm font-medium text-[var(--fg-primary)]">{title}</p>
      {desc && <p className="max-w-[36ch] text-xs leading-snug text-[var(--fg-faint)]">{desc}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
