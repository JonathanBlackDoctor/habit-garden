import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** 목록 내부 등 좁은 공간용 — 여백을 줄이고 아이콘 강조를 뺀다. */
  compact?: boolean;
  className?: string;
}

/**
 * 공용 빈 화면. 아이콘 + 제목 + 설명 + (선택) 행동 버튼.
 * compact 모드는 목록 안쪽의 작은 빈 상태(기존 인라인 텍스트 대체)에 쓴다.
 */
export default function EmptyState({
  icon: Icon, title, description, action, compact, className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      {Icon && !compact && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--leaf-soft)] text-[var(--leaf)]">
          <Icon size={26} strokeWidth={1.75} />
        </div>
      )}
      <div className="space-y-1">
        <p
          className={cn(
            'text-sm',
            compact ? 'text-[var(--fg-faint)]' : 'font-semibold text-[var(--fg-primary)]',
          )}
        >
          {title}
        </p>
        {description && (
          <p className="text-xs leading-relaxed text-[var(--fg-muted)]">{description}</p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
