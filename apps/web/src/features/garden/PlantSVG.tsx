/**
 * PlantSVG — 11종 × stage별 벡터 식물 렌더러
 * stage 0: 씨앗, stage 1: 새싹, stage 2: 성장, stage 3: 개화, stage 4+: 만개, stage 5+: 최고
 *
 * 종별 비주얼 분기:
 *  - sprout/herb/sunflower/maple/lotus (기본 5종): 기존 곡선·꽃 차이만
 *  - clover: 4-잎 클로버 (개화 단계)
 *  - rose: 다중 꽃잎 원
 *  - cactus: 굵은 줄기 + 가시
 *  - orchid: 보라색 우아한 꽃잎
 *  - bamboo: 마디가 있는 곧은 줄기
 *  - cosmos: 큰 꽃잎 6개 + 별 반짝
 *  - 희귀 이상은 stage>=3 부터 글로우 효과
 */
import { cn } from '@/lib/utils';

type Rarity = 'basic' | 'common' | 'rare' | 'epic';

interface PlantSVGProps {
  speciesId: string;
  stage: number;
  withered?: boolean;
  size?: number;
  className?: string;
  rarity?: Rarity;
}

export default function PlantSVG({ speciesId, stage, withered, size = 72, className, rarity = 'basic' }: PlantSVGProps) {
  const col = withered ? '#C7B68A' : getColor(speciesId);
  const accent = withered ? '#D1C4A8' : getAccent(speciesId);
  const s = stage;
  const showGlow = !withered && (rarity === 'rare' || rarity === 'epic') && s >= 3;

  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className={cn('transition-all duration-500', className)}
      aria-label={`${speciesId} stage ${stage}`}
      style={showGlow ? { filter: `drop-shadow(0 0 ${rarity === 'epic' ? 8 : 5}px ${accent})` } : undefined}
    >
      {/* 화분/흙 */}
      <ellipse cx="40" cy="74" rx="16" ry="4" fill={withered ? '#D1C4A8' : '#A68B6A'} opacity="0.7" />

      {/* stage 0: 씨앗 */}
      {s === 0 && (
        <ellipse cx="40" cy="68" rx="6" ry="4" fill={withered ? '#D1C4A8' : '#8A6E4B'} />
      )}

      {/* 종별 줄기/잎 모양 — stage 1부터 분기 */}
      {s >= 1 && renderStemAndLeaves(speciesId, s, col, withered)}

      {/* 개화 단계 (stage 3+): 종별 꽃 분기 */}
      {s >= 3 && renderFlower(speciesId, accent, withered)}

      {/* 만개 단계 (stage 4+): 풍성한 보조 꽃송이 */}
      {s >= 4 && renderBloom(speciesId, accent, withered)}

      {/* 최고 단계 (stage 5+): 상단 액센트 */}
      {s >= 5 && (
        <circle cx="40" cy="18" r="7" fill={withered ? '#D1C4A8' : accent} opacity="0.95" />
      )}

      {/* 에픽 (코스모스 등) 만개 시 별 반짝 */}
      {!withered && rarity === 'epic' && s >= 3 && (
        <g opacity="0.9">
          <text x="14" y="22" fontSize="10" fill="#FFD44A">✦</text>
          <text x="60" y="18" fontSize="8"  fill="#FFB8E8">✦</text>
          <text x="58" y="50" fontSize="7"  fill="#FFD44A">✧</text>
        </g>
      )}
    </svg>
  );
}

// ── 줄기와 잎 (stage 1~2) ────────────────────────────────
function renderStemAndLeaves(speciesId: string, stage: number, col: string, withered?: boolean): React.ReactNode {
  // 선인장: 굵은 줄기 + 가시
  if (speciesId === 'cactus') {
    return (
      <>
        <rect x="34" y={stage >= 2 ? 36 : 50} width="12" height={stage >= 2 ? 32 : 18} rx="6"
              fill={col} opacity="0.92" />
        {/* 가시 */}
        {!withered && stage >= 2 && (
          <g stroke="#FFFFFF" strokeWidth="0.6" opacity="0.7">
            <line x1="36" y1="42" x2="34" y2="40" />
            <line x1="44" y1="44" x2="46" y2="42" />
            <line x1="36" y1="54" x2="34" y2="52" />
            <line x1="44" y1="56" x2="46" y2="54" />
            <line x1="36" y1="64" x2="34" y2="62" />
            <line x1="44" y1="66" x2="46" y2="64" />
          </g>
        )}
        {/* 작은 곁가지 */}
        {stage >= 2 && (
          <rect x="46" y="44" width="8" height="14" rx="4" fill={col} opacity="0.88" />
        )}
      </>
    );
  }

  // 대나무: 곧은 줄기 + 마디
  if (speciesId === 'bamboo') {
    const stalkTop = stage >= 2 ? 28 : 48;
    return (
      <>
        <line x1="40" y1="68" x2="40" y2={stalkTop} stroke={col} strokeWidth="4" strokeLinecap="round" />
        {/* 마디 */}
        <line x1="34" y1="60" x2="46" y2="60" stroke={col} strokeWidth="1.5" opacity="0.7" />
        {stage >= 2 && <line x1="34" y1="44" x2="46" y2="44" stroke={col} strokeWidth="1.5" opacity="0.7" />}
        {stage >= 2 && (
          <>
            <ellipse cx="28" cy="38" rx="9" ry="4" fill={col} opacity="0.85" transform="rotate(-30 28 38)" />
            <ellipse cx="52" cy="36" rx="9" ry="4" fill={col} opacity="0.85" transform="rotate(30 52 36)" />
          </>
        )}
      </>
    );
  }

  // 기본 (sprout/sunflower/herb/maple/lotus/clover/rose/orchid/cosmos)
  return (
    <>
      <line x1="40" y1="68" x2="40" y2={stage >= 2 ? 38 : 52}
            stroke={col} strokeWidth={stage >= 2 ? 3.5 : 3} strokeLinecap="round" />
      <ellipse cx="36" cy="56" rx="7" ry="5" fill={col} opacity="0.85" transform="rotate(-20 36 56)" />
      <ellipse cx="44" cy="56" rx="7" ry="5" fill={col} opacity="0.85" transform="rotate(20 44 56)" />
      {stage >= 2 && (
        <>
          <ellipse cx="30" cy="48" rx="10" ry="7" fill={col} opacity="0.9" transform="rotate(-25 30 48)" />
          <ellipse cx="50" cy="48" rx="10" ry="7" fill={col} opacity="0.9" transform="rotate(25 50 48)" />
          <ellipse cx="38" cy="42" rx="8" ry="6" fill={col} opacity="0.8" />
        </>
      )}
    </>
  );
}

// ── 종별 꽃 (stage 3) ────────────────────────────────────
function renderFlower(speciesId: string, accent: string, withered?: boolean): React.ReactNode {
  const c = withered ? '#C7B68A' : accent;
  const stem = withered ? '#C7B68A' : '#5D8F3E';

  // 클로버: 4-잎 패턴
  if (speciesId === 'clover') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="28" r="6" fill={c} opacity="0.9" />
        <circle cx="48" cy="28" r="6" fill={c} opacity="0.9" />
        <circle cx="40" cy="20" r="6" fill={c} opacity="0.9" />
        <circle cx="40" cy="34" r="5" fill={c} opacity="0.85" />
      </g>
    );
  }

  // 장미: 다중 꽃잎 원
  if (speciesId === 'rose') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <circle cx="40" cy="24" r="10" fill={c} opacity="0.9" />
        <circle cx="40" cy="24" r="7"  fill={c} opacity="0.7" />
        <circle cx="40" cy="24" r="4"  fill="#FFFFFF" opacity="0.4" />
      </g>
    );
  }

  // 선인장: 윗부분에 작은 흰꽃
  if (speciesId === 'cactus') {
    return (
      <g>
        <circle cx="40" cy="34" r="4" fill={withered ? '#C7B68A' : '#FFF6D8'} opacity="0.95" />
        <circle cx="40" cy="34" r="2" fill={c} opacity="0.8" />
      </g>
    );
  }

  // 난초: 우아한 보라 꽃잎 3장
  if (speciesId === 'orchid') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="34" cy="24" rx="6" ry="9" fill={c} opacity="0.88" transform="rotate(-25 34 24)" />
        <ellipse cx="46" cy="24" rx="6" ry="9" fill={c} opacity="0.88" transform="rotate(25 46 24)" />
        <ellipse cx="40" cy="20" rx="5" ry="8" fill={c} opacity="0.92" />
        <circle cx="40" cy="26" r="2.5" fill="#FFF6D8" opacity="0.85" />
      </g>
    );
  }

  // 대나무: 잎 다발만 (꽃 없음)
  if (speciesId === 'bamboo') {
    return (
      <g>
        <ellipse cx="32" cy="32" rx="8" ry="3.5" fill={c} opacity="0.85" transform="rotate(-25 32 32)" />
        <ellipse cx="48" cy="30" rx="8" ry="3.5" fill={c} opacity="0.85" transform="rotate(25 48 30)" />
        <ellipse cx="40" cy="26" rx="7" ry="3" fill={c} opacity="0.9" />
      </g>
    );
  }

  // 코스모스: 큰 꽃잎 6개
  if (speciesId === 'cosmos') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="2.5" strokeLinecap="round" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={deg} cx="40" cy="16" rx="3.5" ry="8" fill={c} opacity="0.85"
                   transform={`rotate(${deg} 40 26)`} />
        ))}
        <circle cx="40" cy="26" r="3" fill="#FFD44A" opacity="0.95" />
      </g>
    );
  }

  // 기본: 단일 꽃 (sprout/sunflower/herb/maple/lotus 등)
  return (
    <>
      <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="26" r="8" fill={c} opacity="0.9" />
      <circle cx="40" cy="26" r="4" fill="white" opacity="0.6" />
    </>
  );
}

// ── 만개 보조 꽃송이 (stage 4+) ────────────────────────────
function renderBloom(speciesId: string, accent: string, withered?: boolean): React.ReactNode {
  const c = withered ? '#D1C4A8' : accent;
  // 선인장은 만개해도 꽃송이 안 늘림 (가시 줄기 그대로)
  if (speciesId === 'cactus') return null;
  return (
    <>
      <circle cx="28" cy="32" r="8" fill={c} opacity="0.85" />
      <circle cx="52" cy="30" r="7" fill={c} opacity="0.75" />
      <circle cx="40" cy="25" r="9" fill={c} opacity="0.9" />
    </>
  );
}

// ── 컬러 맵 ────────────────────────────────────────────────
function getColor(speciesId: string): string {
  const map: Record<string, string> = {
    sprout:    '#5D8F3E',
    sunflower: '#6AAB3C',
    herb:      '#4F7A37',
    maple:     '#7C4A1E',
    lotus:     '#4F7A8A',
    clover:    '#3A8C3A',
    rose:      '#5A8C3E',
    cactus:    '#3F6B2F',
    orchid:    '#6B4A8C',
    bamboo:    '#5A8C3E',
    cosmos:    '#7A4FA0',
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
    clover:    '#7FD17F',
    rose:      '#E85A88',
    cactus:    '#7FAE5F',
    orchid:    '#C088E8',
    bamboo:    '#A8D08D',
    cosmos:    '#FFB8E8',
  };
  return map[speciesId] ?? '#A8D08D';
}
