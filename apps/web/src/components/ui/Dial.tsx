import * as React from 'react';
import { cn } from '@/lib/utils';

interface DialProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: number;
  label?: string;
  unit?: string;
  color?: string;
  className?: string;
}

// 게이지(270°) 형태의 원형 다이얼.
// 손잡이를 원 주위로 드래그해 값을 조절 — 슬라이더보다 미세 조정이 쉽다.
const START = -135; // 시작 각도(12시=0°, 시계방향), 하단에 90° 공백
const SWEEP = 270;

function angleToPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = angleToPoint(cx, cy, r, startDeg);
  const end = angleToPoint(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function Dial({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  size = 116,
  label,
  unit = '',
  color = 'var(--leaf)',
  className,
}: DialProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(8, size * 0.09);
  const r = size / 2 - stroke / 2 - 2;

  const clamped = Math.min(Math.max(value, min), max);
  const fraction = (clamped - min) / (max - min);
  const valueAngle = START + fraction * SWEEP;
  const thumb = angleToPoint(cx, cy, r, valueAngle);

  const setFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const px = ((clientX - rect.left) / rect.width) * size;
      const py = ((clientY - rect.top) / rect.height) * size;
      const dx = px - cx;
      const dy = py - cy;
      // 12시=0°, 시계방향 각도(-180..180)
      const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      // 게이지 기준 각도 g 로 변환 후 유효 범위[0,SWEEP]로 스냅 (하단 공백 → 가까운 끝)
      let g = deg - START; // [-45, 315]
      if (g < 0) g = 0;
      else if (g > SWEEP) g = SWEEP;
      const f = g / SWEEP;
      const raw = min + f * (max - min);
      const snapped = Math.round(raw / step) * step;
      const next = Math.min(Math.max(snapped, min), max);
      if (next !== value) onChange(next);
    },
    [size, cx, cy, min, max, step, value, onChange]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setFromPointer(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return;
    setFromPointer(e.clientX, e.clientY);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(Math.min(clamped + step, max));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(Math.max(clamped - step, min));
    }
  };

  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="touch-none select-none cursor-pointer"
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      >
        {/* 트랙 */}
        <path
          d={describeArc(cx, cy, r, START, START + SWEEP)}
          fill="none"
          stroke="var(--leaf-soft)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* 값 아크 */}
        {fraction > 0 && (
          <path
            d={describeArc(cx, cy, r, START, valueAngle)}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
        {/* 손잡이 */}
        <circle
          cx={thumb.x}
          cy={thumb.y}
          r={stroke * 0.72}
          fill="white"
          stroke={color}
          strokeWidth={Math.max(2, stroke * 0.28)}
        />
        {/* 가운데 값 */}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-bold tabular-nums"
          fontSize={size * 0.26}
          fill="var(--fg-primary)"
        >
          {clamped}
        </text>
        {unit && (
          <text
            x={cx}
            y={cy + size * 0.17}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={size * 0.11}
            fill="var(--fg-faint)"
          >
            {unit}
          </text>
        )}
      </svg>
      {label && <span className="text-sm text-[var(--fg-muted)]">{label}</span>}
    </div>
  );
}
