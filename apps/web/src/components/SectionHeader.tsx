import { cn } from '@/lib/utils';

/**
 * 섹션 머리말 — kicker(넓은 자간의 작은 라벨) + 우측 수치.
 * 디자인의 "지난 7일 … 평균 82점", "저녁 … 1 / 5" 패턴을 한 곳으로 모은다.
 */
export default function SectionHeader({
  label,
  value,
  tone = 'muted',
  className,
}: {
  label: string;
  value?: React.ReactNode;
  /** now — 현재 시간대처럼 주의를 끌어야 하는 섹션은 bloom 색으로 */
  tone?: 'muted' | 'now';
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-2', className)}>
      <span className={cn('kicker', tone === 'now' && 'text-[var(--bloom)]')}>{label}</span>
      {value !== undefined && (
        <span
          className={cn(
            'text-[12px] tabular-nums',
            tone === 'now' ? 'text-[var(--bloom)]' : 'text-[var(--fg-muted)]',
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}
