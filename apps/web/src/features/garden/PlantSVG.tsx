/**
 * PlantSVG — 5종 × stage별 벡터 식물 렌더러
 * stage 0: 씨앗, stage 1: 새싹, stage 2: 성장, stage 3: 개화, stage 4+: 만개
 */
import { cn } from '@/lib/utils';

interface PlantSVGProps {
  speciesId: string;
  stage: number;
  withered?: boolean;
  size?: number;
  className?: string;
}

export default function PlantSVG({ speciesId, stage, withered, size = 72, className }: PlantSVGProps) {
  const col = withered ? '#C7B68A' : getColor(speciesId);
  const s = stage;

  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className={cn('transition-all duration-500', className)}
      aria-label={`${speciesId} stage ${stage}`}
    >
      {/* 화분/흙 */}
      <ellipse cx="40" cy="74" rx="16" ry="4" fill={withered ? '#D1C4A8' : '#A68B6A'} opacity="0.7" />

      {/* stage 0: 씨앗 */}
      {s === 0 && (
        <ellipse cx="40" cy="68" rx="6" ry="4" fill={withered ? '#D1C4A8' : '#8A6E4B'} />
      )}

      {/* stage 1: 새싹 */}
      {s >= 1 && (
        <>
          <line x1="40" y1="68" x2="40" y2="52" stroke={col} strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="36" cy="56" rx="7" ry="5" fill={col} opacity="0.85" transform="rotate(-20 36 56)" />
          <ellipse cx="44" cy="56" rx="7" ry="5" fill={col} opacity="0.85" transform="rotate(20 44 56)" />
        </>
      )}

      {/* stage 2: 성장 */}
      {s >= 2 && (
        <>
          <line x1="40" y1="68" x2="40" y2="38" stroke={col} strokeWidth="3.5" strokeLinecap="round" />
          <ellipse cx="30" cy="48" rx="10" ry="7" fill={col} opacity="0.9" transform="rotate(-25 30 48)" />
          <ellipse cx="50" cy="48" rx="10" ry="7" fill={col} opacity="0.9" transform="rotate(25 50 48)" />
          <ellipse cx="38" cy="42" rx="8" ry="6" fill={col} opacity="0.8" />
        </>
      )}

      {/* stage 3: 개화 — 종마다 꽃 색 다름 */}
      {s >= 3 && (
        <>
          {getFlower(speciesId, withered)}
        </>
      )}

      {/* stage 4+: 만개 — 더 풍성하게 */}
      {s >= 4 && (
        <>
          <circle cx="28" cy="32" r="8" fill={withered ? '#D1C4A8' : getAccent(speciesId)} opacity="0.85" />
          <circle cx="52" cy="30" r="7" fill={withered ? '#D1C4A8' : getAccent(speciesId)} opacity="0.75" />
          <circle cx="40" cy="25" r="9" fill={withered ? '#D1C4A8' : getAccent(speciesId)} opacity="0.9" />
        </>
      )}

      {/* stage 5+: 최고 단계 (maple/lotus 전용) */}
      {s >= 5 && (
        <circle cx="40" cy="18" r="7" fill={withered ? '#D1C4A8' : getAccent(speciesId)} opacity="0.95" />
      )}
    </svg>
  );
}

function getColor(speciesId: string): string {
  const map: Record<string, string> = {
    sprout:    '#5D8F3E',
    sunflower: '#6AAB3C',
    herb:      '#4F7A37',
    maple:     '#7C4A1E',
    lotus:     '#4F7A8A',
  };
  return map[speciesId] ?? '#4F7A37';
}

function getAccent(speciesId: string): string {
  const map: Record<string, string> = {
    sprout:    '#A8D08D',
    sunflower: '#FFD44A',
    herb:      '#C7E0A8',
    maple:     '#E87043',
    lotus:     '#D4A0C4',
  };
  return map[speciesId] ?? '#A8D08D';
}

function getFlower(speciesId: string, withered?: boolean): React.ReactNode {
  const c = withered ? '#C7B68A' : getAccent(speciesId);
  const stem = withered ? '#C7B68A' : '#5D8F3E';
  return (
    <>
      <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="26" r="8" fill={c} opacity="0.9" />
      <circle cx="40" cy="26" r="4" fill="white" opacity="0.6" />
    </>
  );
}
