import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SectionHeaderProps {
  title: React.ReactNode;
  /** 우측 보조 액션(예: "정원 가기 →") */
  action?: { label: string; onClick: () => void };
  className?: string;
}

/** 카드/섹션 상단의 제목 + 우측 액션. 화면 전반의 헤더 위계를 통일한다. */
export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{title}</h3>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="flex items-center gap-1 text-xs text-[var(--leaf)] active:opacity-70"
        >
          {action.label}
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
