import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ListRowProps {
  icon?: React.ReactNode;
  label: React.ReactNode;
  desc?: React.ReactNode;
  /** 우측 요소(토글/뱃지 등). 없고 onClick이 있으면 › 자동 표시 */
  trailing?: React.ReactNode;
  onClick?: () => void;
  /** › 표시 강제/숨김 */
  chevron?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  className?: string;
}

/**
 * 아이콘 + 라벨(+설명) + 트레일링으로 구성된 리스트 행.
 * 설정·메뉴·바로가기 등 반복되던 raw 버튼 마크업을 통일한다.
 * onClick이 있으면 button(터치 타깃 44px↑), 없으면 정적 div.
 */
export function ListRow({
  icon, label, desc, trailing, onClick, chevron, disabled, tone = 'default', className,
}: ListRowProps) {
  const isDanger = tone === 'danger';
  const showChevron = chevron ?? (!!onClick && !trailing);

  const inner = (
    <>
      {icon && (
        <span className={cn('shrink-0', isDanger ? 'text-[var(--danger)]' : 'text-[var(--leaf)]')}>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', isDanger ? 'text-[var(--danger)]' : 'text-[var(--fg-primary)]')}>
          {label}
        </p>
        {desc && <p className="mt-0.5 text-xs text-[var(--fg-faint)]">{desc}</p>}
      </div>
      {trailing}
      {showChevron && <ChevronRight size={16} className="shrink-0 text-[var(--fg-faint)]" />}
    </>
  );

  const base = 'flex w-full items-center gap-3 px-4 py-3 text-left';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(base, 'active:opacity-70 disabled:opacity-40', className)}
      >
        {inner}
      </button>
    );
  }
  return <div className={cn(base, className)}>{inner}</div>;
}
