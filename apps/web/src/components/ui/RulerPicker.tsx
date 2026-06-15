import * as React from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RulerPickerProps {
  /** 기록된 값. undefined 이면 '미기록' 상태로, 눈금은 defaultValue 위치에서 시작한다. */
  value: number | undefined;
  onChange: (v: number) => void;
  /** 미기록 상태를 다시 비우는 핸들러 (있으면 '지우기' 버튼 노출). */
  onClear?: () => void;
  min?: number;
  max?: number;
  step?: number;
  majorEvery?: number; // majorEvery * step 마다 굵은 눈금 + 라벨
  /** 미기록일 때 눈금을 가운데 맞춰 시작할 값 (예: 70). 미지정 시 min. */
  defaultValue?: number;
  gap?: number;        // 눈금 1칸 px
  unit?: string;
  label?: string;
  color?: string;
  className?: string;
}

/** 살짝 진동 — 지원 기기에서만. */
function tick() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(1);
  }
}

// 가로 스크롤 눈금 휠 — 가운데 포인터에 맞춰 좌우로 밀어 값을 조절한다.
// 미기록(value===undefined)과 0 을 구분한다: 미기록이면 placeholder('–')를 보여주고
// 눈금만 defaultValue 위치에 두며, 실제 값은 사용자가 조작할 때 비로소 확정된다.
export function RulerPicker({
  value,
  onChange,
  onClear,
  min = 0,
  max = 100,
  step = 1,
  majorEvery = 10,
  defaultValue,
  gap = 14,
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
  const lastTickRef = React.useRef<number>();

  // 미기록이면 눈금을 둘 기준 위치 (값은 아직 확정 안 함).
  const start = defaultValue ?? min;
  const effective = value ?? start;
  const isSet = value !== undefined;
  // 사용자가 한 번이라도 만졌으면(스크롤·버튼) 숫자를 보여준다.
  const [touched, setTouched] = React.useState(isSet);
  const [display, setDisplay] = React.useState(effective);

  const count = Math.round((max - min) / step); // 눈금 간격 개수
  const clampIdx = (i: number) => Math.min(Math.max(i, 0), count);
  const indexOf = (v: number) => clampIdx(Math.round((v - min) / step));
  const clampVal = (v: number) => Math.min(Math.max(v, min), max);

  // value 가 외부에서 비워지면(지우기) 다시 미기록 표시로.
  React.useEffect(() => {
    if (value === undefined) setTouched(false);
    else setTouched(true);
  }, [value]);

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

  // 외부 value(또는 미기록 기준값) → 스크롤 위치 동기화 (초기/리셋)
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || halfW === 0) return;
    const target = indexOf(effective) * gap;
    if (Math.abs(el.scrollLeft - target) > 1) {
      programmaticRef.current = true;
      el.scrollLeft = target;
      setDisplay(effective);
      requestAnimationFrame(() => {
        programmaticRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, halfW, gap, min, max, step]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || programmaticRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const i = clampIdx(Math.round(el.scrollLeft / gap));
      const v = min + i * step;
      setTouched(true);
      setDisplay(v);
      if (lastTickRef.current !== v) {
        lastTickRef.current = v;
        tick();
      }
      // 스크롤이 멈추면 값 확정
      if (commitRef.current) clearTimeout(commitRef.current);
      commitRef.current = setTimeout(() => {
        if (v !== value) onChange(v);
      }, 140);
    });
  };

  const nudge = (dir: 1 | -1) => {
    const next = clampVal((value ?? start) + dir * step);
    setTouched(true);
    tick();
    onChange(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      nudge(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      nudge(-1);
    }
  };

  const ticks = React.useMemo(
    () => Array.from({ length: count + 1 }, (_, i) => i),
    [count]
  );

  const showNumber = isSet || touched;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="flex w-full items-center justify-center gap-3">
        {/* − 미세 조정 */}
        <button
          type="button"
          aria-label={`${label ?? ''} 1 감소`}
          onClick={() => nudge(-1)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg-muted)] active:scale-95 active:bg-[var(--bg-surface)]"
        >
          <Minus size={15} />
        </button>

        <div className="flex min-w-[4.5rem] items-baseline justify-center gap-1">
          <span
            className={cn(
              'text-3xl font-bold tabular-nums',
              showNumber ? 'text-[var(--fg-primary)]' : 'text-[var(--fg-faint)]',
            )}
          >
            {showNumber ? display : '–'}
          </span>
          {unit && <span className="text-sm text-[var(--fg-faint)]">{unit}</span>}
        </div>

        {/* + 미세 조정 */}
        <button
          type="button"
          aria-label={`${label ?? ''} 1 증가`}
          onClick={() => nudge(1)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg-muted)] active:scale-95 active:bg-[var(--bg-surface)]"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="relative w-full">
        {/* 가운데 포인터 */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-10 h-9 w-0.5 -translate-x-1/2"
          style={{ backgroundColor: showNumber ? color : 'var(--fg-faint)' }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `6px solid ${showNumber ? color : 'var(--fg-faint)'}`,
          }}
        />

        <div
          ref={scrollRef}
          role="slider"
          tabIndex={0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={showNumber ? display : undefined}
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

      <div className="mt-1 flex items-center gap-2">
        {label && <span className="text-sm text-[var(--fg-muted)]">{label}</span>}
        {isSet && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] text-[var(--fg-faint)] active:text-[var(--fg-muted)]"
          >
            <RotateCcw size={11} /> 지우기
          </button>
        )}
      </div>
    </div>
  );
}
