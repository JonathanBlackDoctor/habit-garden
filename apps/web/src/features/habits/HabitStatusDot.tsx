import { Check, Minus, Slash } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HabitStatus } from './habitStatus';

interface Props {
  status: HabitStatus;
  /** 지름(px). 그룹 개수에 따라 적응형으로 전달 */
  size?: number;
  /** 현재 시간대인지 — 미기록 글로우/색 강조에 사용 */
  isNow?: boolean;
  title?: string;
}

/** 4상태(이행/미이행/건너뜀/미기록)를 글리프+형태+색으로 구분하는 인디케이터. */
export default function HabitStatusDot({ status, size = 14, isNow = false, title }: Props) {
  // 글리프는 지름이 충분할 때만 — 12px 이하에서는 형태/색만으로 구분
  const showGlyph = size >= 14;
  const glyphSize = Math.round(size * 0.62);

  const base = 'inline-flex items-center justify-center rounded-full shrink-0';
  const style = { width: size, height: size } as const;

  if (status === 'achieved') {
    return (
      <span
        title={title}
        style={style}
        className={cn(base, 'bg-[var(--leaf)] text-white')}
      >
        {showGlyph && <Check size={glyphSize} strokeWidth={3} />}
      </span>
    );
  }

  if (status === 'skipped') {
    return (
      <span
        title={title}
        style={style}
        className={cn(base, 'bg-[var(--bg-base)] border border-[var(--border)] text-[var(--fg-faint)]')}
      >
        {showGlyph && <Minus size={glyphSize} strokeWidth={2.5} />}
      </span>
    );
  }

  if (status === 'missed') {
    return (
      <span
        title={title}
        style={style}
        className={cn(base, 'bg-[var(--wither)]/50 text-[var(--fg-muted)]')}
      >
        {showGlyph && <Slash size={glyphSize} strokeWidth={2.5} />}
      </span>
    );
  }

  // todo (미기록) — 점선 빈 원, 현재 시간대면 bloom 색 + 글로우 펄스
  return (
    <span
      title={title}
      style={style}
      className={cn(
        base,
        'bg-[var(--bg-surface)] border-2 border-dashed',
        isNow ? 'border-[var(--bloom)] habit-glow' : 'border-[var(--leaf)]'
      )}
    />
  );
}
