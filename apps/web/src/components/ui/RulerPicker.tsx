import * as React from 'react';
import { cn } from '@/lib/utils';

interface RulerPickerProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  majorEvery?: number; // majorEvery * step 마다 굵은 눈금 + 라벨
  gap?: number;        // 눈금 1칸 px
  unit?: string;
  label?: string;
  color?: string;
  className?: string;
}

// 사진 기울기·타이머 설정에서 쓰는 가로 스크롤 눈금 휠.
// 가운데 포인터에 맞춰 좌우로 밀어 값을 조절한다 — 미세 조정이 쉽다.
export function RulerPicker({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  majorEvery = 10,
  gap = 12,
  unit = '',
  label,
  color = 'var(--leaf)',
  className,
}: RulerPickerProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [halfW, setHalfW] = React.useState(0);
  const programmaticRef = React.useRef(false);
  const rafRef = React.useRef<number>();
  const commitRef = React.useRef<ReturnType<typeof setTimeout>>();
  const [display, setDisplay] = React.useState(value);

  const count = Math.round((max - min) / step); // 눈금 간격 개수
  const clampIdx = (i: number) => Math.min(Math.max(i, 0), count);
  const indexOf = (v: number) => clampIdx(Math.round((v - min) / step));

  // 컨테이너 너비 측정 → 양끝 여백(가운데 정렬용)
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setHalfW(el.clientWidth / 2 - gap / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gap]);

  // 외부 value → 스크롤 위치 동기화 (초기/리셋)
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || halfW === 0) return;
    const target = indexOf(value) * gap;
    if (Math.abs(el.scrollLeft - target) > 1) {
      programmaticRef.current = true;
      el.scrollLeft = target;
      setDisplay(value);
      requestAnimationFrame(() => {
        programmaticRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, halfW, gap, min, max, step]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || programmaticRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const i = clampIdx(Math.round(el.scrollLeft / gap));
      const v = min + i * step;
      setDisplay(v);
      // 스크롤이 멈추면 값 확정
      if (commitRef.current) clearTimeout(commitRef.current);
      commitRef.current = setTimeout(() => {
        if (v !== value) onChange(v);
      }, 140);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(value + step, max));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(value - step, min));
    }
  };

  const ticks = React.useMemo(
    () => Array.from({ length: count + 1 }, (_, i) => i),
    [count]
  );

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums text-[var(--fg-primary)]">{display}</span>
        {unit && <span className="text-sm text-[var(--fg-faint)]">{unit}</span>}
      </div>

      <div className="relative w-full">
        {/* 가운데 포인터 */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-10 h-9 w-0.5 -translate-x-1/2"
          style={{ backgroundColor: color }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `6px solid ${color}`,
          }}
        />

        <div
          ref={scrollRef}
          role="slider"
          tabIndex={0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={display}
          aria-label={label}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          className="flex h-14 items-start overflow-x-auto overflow-y-hidden outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          <div style={{ flex: `0 0 ${halfW}px` }} />
          {ticks.map((i) => {
            const major = i % majorEvery === 0;
            const v = min + i * step;
            return (
              <div
                key={i}
                className="relative flex shrink-0 flex-col items-center"
                style={{ width: gap, scrollSnapAlign: 'center' }}
              >
                <div
                  style={{
                    width: major ? 2 : 1,
                    height: major ? 26 : 14,
                    backgroundColor: major ? 'var(--fg-muted)' : 'var(--border)',
                  }}
                />
                {major && (
                  <span className="absolute top-7 whitespace-nowrap text-[10px] tabular-nums text-[var(--fg-faint)]">
                    {v}
                  </span>
                )}
              </div>
            );
          })}
          <div style={{ flex: `0 0 ${halfW}px` }} />
        </div>
      </div>

      {label && <span className="mt-1 text-sm text-[var(--fg-muted)]">{label}</span>}
    </div>
  );
}
