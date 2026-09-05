import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageHeader({
  kicker,
  title,
  summary,
  action,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  summary?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('relative', className)}>
      {kicker && <div className="page-kicker">{kicker}</div>}
      <div className="mt-[8px] flex items-start justify-between gap-4">
        <h1 className="page-title min-w-0 flex-1 whitespace-pre-line">{title}</h1>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
      {summary && <div className="mt-2 text-[14px] tracking-[-0.01em] text-[var(--fg-muted)]">{summary}</div>}
    </header>
  );
}

export function SectionHeading({
  title,
  meta,
  action,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="section-title">{title}</h2>
        {meta && <span className="meta-copy tabular-nums">{meta}</span>}
      </div>
      {action && <div className="shrink-0 text-[13.5px] tracking-[-0.01em] text-[var(--fg-muted)]">{action}</div>}
    </div>
  );
}

export function ProgressRail({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn('h-1 overflow-hidden rounded-full bg-[var(--divider-soft)]', className)}
    >
      <div className="h-full rounded-full bg-[var(--leaf)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatusCircle({
  checked = false,
  skipped = false,
  label,
  onClick,
  score,
  className,
}: {
  checked?: boolean;
  skipped?: boolean;
  label: string;
  onClick?: () => void;
  score?: number;
  className?: string;
}) {
  const content = score ?? (checked ? '✓' : skipped ? '—' : '');
  const classes = cn(
    'grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border text-[11px] font-semibold leading-none transition-colors',
    checked
      ? 'border-[var(--fg-primary)] bg-[var(--fg-primary)] text-[var(--bg-base)]'
      : 'border-[var(--border)] bg-transparent text-[var(--fg-faint)]',
    className,
  );
  if (!onClick) return <span aria-hidden="true" className={classes}>{content}</span>;
  return (
    <button type="button" aria-label={label} aria-pressed={checked} onClick={onClick} className="-m-3 grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full">
      <span aria-hidden="true" className={classes}>{content}</span>
    </button>
  );
}

export function SegmentTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-5 border-b border-[var(--divider-soft)]">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative min-h-[42px] py-2 text-[14px] tracking-[-0.01em]',
              active ? 'font-semibold text-[var(--fg-primary)]' : 'text-[var(--fg-faint)]',
            )}
          >
            {item.label}
            <span className={cn('absolute inset-x-0 bottom-[-1px] h-[2px]', active ? 'bg-[var(--fg-primary)]' : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
  );
}

export function MenuRow({
  title,
  meta,
  right,
  onClick,
  destructive = false,
}: {
  title: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15.5px] tracking-[-0.018em]', destructive ? 'text-[var(--bloom)]' : 'text-[var(--fg-primary)]')}>{title}</span>
        {meta && <span className="meta-copy mt-0.5 block">{meta}</span>}
      </span>
      {right ?? (onClick ? <ChevronRight size={15} strokeWidth={1.5} className="text-[var(--fg-faint)]" /> : null)}
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className="editorial-row">{content}</button> : <div className="editorial-row">{content}</div>;
}
