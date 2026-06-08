/**
 * PlantSVG — 종 × stage별 벡터 식물 렌더러 (부드러운 일러스트풍)
 * stage 0: 씨앗, stage 1: 새싹, stage 2: 성장, stage 3: 개화, stage 4+: 만개, stage 5+: 최고
 *
 * 디자인 원칙:
 *  - 모든 종이 leafGrad/stemGrad/flowerGrad(색 명→암 파생) 로 입체감을 가진다.
 *  - 줄기는 곡선 path, 잎은 잎 모양 path(중앙맥 포함) 로 자연스럽게.
 *  - 그라데이션 id 는 useId() 로 인스턴스마다 고유 → 도감/정원 다중 렌더 충돌 방지.
 *  - 등급 위계는 RARITY_FX 데이터 기반 장식 레이어(글로우·후광·sparkle·궤도 입자)로 단계적 강화.
 *  - decorative=false (도감 그리드 등) 면 필터·후광·모션을 끄고 그라데이션만 유지(성능).
 */
import { useId } from 'react';
import { cn } from '@/lib/utils';

type Rarity = 'basic' | 'common' | 'rare' | 'epic' | 'legendary' | 'transcendent';

interface PlantSVGProps {
  speciesId: string;
  stage: number;
  withered?: boolean;
  size?: number;
  className?: string;
  rarity?: Rarity;
  /** false 면 글로우·후광·sparkle·흔들림을 끔 (도감 등 다중 렌더 성능용) */
  decorative?: boolean;
}

interface Ctx {
  gid: (n: string) => string;
  leafFill: string;
  stemFill: string;
  flowerFill: string;
}

// ── 등급별 장식 escalation ────────────────────────────────
const RARITY_FX: Record<Rarity, {
  glowRadius: number; glowOpacity: number;
  aura: 'none' | 'soft' | 'halo' | 'celestial';
  sparkleCount: number; motes: number; pulse: boolean;
}> = {
  basic:        { glowRadius: 0,  glowOpacity: 0,    aura: 'none',      sparkleCount: 0,  motes: 0, pulse: false },
  common:       { glowRadius: 0,  glowOpacity: 0,    aura: 'none',      sparkleCount: 0,  motes: 0, pulse: false },
  rare:         { glowRadius: 5,  glowOpacity: 0.45, aura: 'soft',      sparkleCount: 0,  motes: 0, pulse: false },
  epic:         { glowRadius: 8,  glowOpacity: 0.55, aura: 'soft',      sparkleCount: 3,  motes: 0, pulse: false },
  legendary:    { glowRadius: 15, glowOpacity: 0.78, aura: 'halo',      sparkleCount: 8,  motes: 5, pulse: true },
  transcendent: { glowRadius: 24, glowOpacity: 0.95, aura: 'celestial', sparkleCount: 12, motes: 8, pulse: true },
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function PlantSVG({
  speciesId, stage, withered, size = 72, className, rarity = 'basic', decorative = true,
}: PlantSVGProps) {
  const uid = useId();
  const gid = (n: string) => `g${uid.replace(/:/g, '')}-${n}`;

  const col = withered ? '#C7B68A' : getColor(speciesId);
  const accent = withered ? '#D1C4A8' : getAccent(speciesId);
  const s = stage;
  const fx = RARITY_FX[rarity];

  const deco = decorative && !withered;
  const showGlow = deco && fx.glowRadius > 0 && s >= 2;
  const glowColor = rarity === 'transcendent' ? '#E6CBFF' : rarity === 'legendary' ? '#FFD44A' : accent;
  const showAura = deco && fx.aura !== 'none' && s >= 2;
  const showSparkles = deco && fx.sparkleCount > 0 && s >= 3;
  const showMotes = deco && fx.motes > 0 && s >= 3;

  const leafFill = withered ? col : `url(#${gid('leaf')})`;
  const stemFill = withered ? col : `url(#${gid('stem')})`;
  const flowerFill = withered ? accent : `url(#${gid('flower')})`;
  const ctx: Ctx = { gid, leafFill, stemFill, flowerFill };

  // idle 흔들림 — 종마다 위상/주기를 달리해 lockstep 방지
  const h = hashStr(speciesId);
  const swayStyle = deco && s >= 1
    ? {
        transformBox: 'view-box' as const,
        transformOrigin: '40px 70px',
        animationDelay: `${(h % 7) * 0.35}s`,
        animationDuration: `${6 + (h % 4)}s`,
      }
    : undefined;

  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className={cn('transition-all duration-500', className)}
      aria-label={`${speciesId} stage ${stage}`}
      style={{
        ...(rarity === 'transcendent' ? { overflow: 'visible' as const } : {}),
        ...(showGlow
          ? { filter: `drop-shadow(0 0 ${fx.glowRadius}px color-mix(in srgb, ${glowColor} ${Math.round(fx.glowOpacity * 100)}%, transparent))` }
          : {}),
      }}
    >
      <defs>
        {!withered && (
          <>
            <linearGradient id={gid('leaf')} gradientUnits="userSpaceOnUse" x1="40" y1="6" x2="40" y2="72">
              <stop offset="0%" stopColor={`color-mix(in srgb, ${col} 66%, white)`} />
              <stop offset="100%" stopColor={`color-mix(in srgb, ${col} 84%, black)`} />
            </linearGradient>
            <linearGradient id={gid('stem')} gradientUnits="userSpaceOnUse" x1="40" y1="6" x2="40" y2="72">
              <stop offset="0%" stopColor={`color-mix(in srgb, ${col} 74%, white)`} />
              <stop offset="100%" stopColor={`color-mix(in srgb, ${col} 90%, black)`} />
            </linearGradient>
            <radialGradient id={gid('flower')} cx="50%" cy="38%" r="62%">
              <stop offset="0%" stopColor={`color-mix(in srgb, ${accent} 52%, white)`} />
              <stop offset="58%" stopColor={accent} />
              <stop offset="100%" stopColor={`color-mix(in srgb, ${accent} 86%, black)`} />
            </radialGradient>
          </>
        )}
        <radialGradient id={gid('shadow')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2A2E27" stopOpacity="0.32" />
          <stop offset="65%" stopColor="#2A2E27" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#2A2E27" stopOpacity="0" />
        </radialGradient>
        {showAura && (
          <radialGradient id={gid('aura')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={glowColor} stopOpacity="0.5" />
            <stop offset="55%" stopColor={glowColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>

      {/* 그라운드 섀도 — 식물이 땅에 앉은 느낌 */}
      <ellipse cx="40" cy="74" rx="16" ry="3.4" fill={withered ? '#C7B68A' : `url(#${gid('shadow')})`} opacity={withered ? 0.4 : 1} />

      {/* 후광 (식물 뒤) */}
      {showAura && renderAura(fx.aura, gid, glowColor, fx.pulse)}

      {/* stage 0: 씨앗 */}
      {s === 0 && (
        <ellipse cx="40" cy="68" rx="6" ry="4" fill={withered ? '#D1C4A8' : '#8A6E4B'} />
      )}

      {/* 본체 (잔잔한 흔들림) */}
      <g className={swayStyle ? 'plant-sway' : undefined} style={swayStyle}>
        {s >= 1 && renderStemAndLeaves(speciesId, s, withered, ctx)}
        {s >= 3 && renderFlower(speciesId, accent, withered, ctx)}
        {s >= 4 && renderBloom(speciesId, accent, withered, ctx)}
        {s >= 5 && rarity !== 'transcendent' && (
          <circle cx="40" cy="18" r="7" fill={withered ? '#D1C4A8' : flowerFill} opacity="0.95" />
        )}
      </g>

      {/* sparkle (에픽/전설) */}
      {showSparkles && renderSparkles(fx.sparkleCount, rarity)}

      {/* 궤도 입자 (전설) */}
      {showMotes && renderMotes(fx.motes, glowColor)}
    </svg>
  );
}

// ── 공유 프리미티브 ────────────────────────────────────────

/** 잎 모양 path + 옅은 중앙맥 (small size 가독 고려) */
function softLeaf(
  cx: number, cy: number, len: number, width: number, angle: number,
  fill: string, vein: string, key?: React.Key,
): React.ReactNode {
  const tipY = cy - len;
  const midY = cy - len / 2;
  const half = width / 2;
  const d = `M${cx} ${cy} Q${cx - half} ${midY} ${cx} ${tipY} Q${cx + half} ${midY} ${cx} ${cy} Z`;
  return (
    <g key={key} transform={`rotate(${angle} ${cx} ${cy})`}>
      <path d={d} fill={fill} />
      <path d={`M${cx} ${cy - 1.5} L${cx} ${tipY + 1.5}`} stroke={vein} strokeWidth="0.7" opacity="0.28" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** 곡선 줄기 (직선 line 대체) */
function curvedStem(
  fromX: number, fromY: number, toX: number, toY: number,
  bend: number, width: number, stroke: string, key?: React.Key,
): React.ReactNode {
  const midX = (fromX + toX) / 2 + bend;
  const midY = (fromY + toY) / 2;
  return (
    <path key={key} d={`M${fromX} ${fromY} Q${midX} ${midY} ${toX} ${toY}`}
          stroke={stroke} strokeWidth={width} strokeLinecap="round" fill="none" />
  );
}

/** 꽃잎 링 (cosmos/daisy/peony/lily 등 반복 패턴 일반화) */
function petalRing(
  count: number, cx: number, cy: number, rx: number, ry: number,
  pivotY: number, fill: string, opacity = 0.9,
): React.ReactNode {
  return Array.from({ length: count }).map((_, i) => {
    const deg = (360 / count) * i;
    return (
      <ellipse key={deg} cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} opacity={opacity}
               transform={`rotate(${deg} ${cx} ${pivotY})`} />
    );
  });
}

// ── 등급 장식 레이어 ──────────────────────────────────────
const HALO_ORIGIN = { transformBox: 'view-box' as const, transformOrigin: '40px 26px' };

function renderAura(kind: 'none' | 'soft' | 'halo' | 'celestial', gid: (n: string) => string, color: string, pulse: boolean): React.ReactNode {
  if (kind === 'none') return null;

  // rare/epic: 단순 후광
  if (kind === 'soft') {
    return <circle cx="40" cy="26" r="30" fill={`url(#${gid('aura')})`} className={pulse ? 'aura-pulse' : undefined} />;
  }

  // transcendent: 무지개빛 후광 + 3겹 회전 광선(서로 다른 속도·방향) + 이중 광륜
  if (kind === 'celestial') {
    const RAYS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
    return (
      <>
        <circle cx="40" cy="26" r="38" fill={`url(#${gid('aura')})`} className="aura-pulse" />
        {/* 긴 광선 (느리게 정방향) */}
        <g className="halo-rotate" style={HALO_ORIGIN}>
          <g stroke="#FFFFFF" strokeWidth="1.6" opacity="0.6" strokeLinecap="round">
            {RAYS.map((d) => (
              <line key={d} x1="40" y1="6" x2="40" y2="-3" transform={`rotate(${d} 40 26)`} />
            ))}
          </g>
        </g>
        {/* 중간 광선 (반대로) */}
        <g className="halo-rotate" style={{ ...HALO_ORIGIN, animationDirection: 'reverse', animationDuration: '20s' }}>
          <g stroke={color} strokeWidth="1.2" opacity="0.5" strokeLinecap="round">
            {[15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345].map((d) => (
              <line key={d} x1="40" y1="10" x2="40" y2="3" transform={`rotate(${d} 40 26)`} />
            ))}
          </g>
        </g>
        {/* 이중 광륜 */}
        <circle cx="40" cy="26" r="26" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" className="aura-pulse" />
        <circle cx="40" cy="26" r="20" fill="none" stroke={color} strokeWidth="1.2" opacity="0.55" className="aura-pulse" />
      </>
    );
  }

  // legendary: 맥동 후광 + 회전 광선 버스트(서로 반대로 도는 2겹) + 광륜
  return (
    <>
      <circle cx="40" cy="26" r="34" fill={`url(#${gid('aura')})`} className="aura-pulse" />
      {/* 긴 광선 (느리게 회전) */}
      <g className="halo-rotate" style={HALO_ORIGIN}>
        <g stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
            <line key={d} x1="40" y1="8" x2="40" y2="0" transform={`rotate(${d} 40 26)`} />
          ))}
        </g>
      </g>
      {/* 짧은 광선 (반대로, 더 느리게) */}
      <g className="halo-rotate" style={{ ...HALO_ORIGIN, animationDirection: 'reverse', animationDuration: '24s' }}>
        <g stroke={color} strokeWidth="1" opacity="0.35" strokeLinecap="round">
          {[22, 67, 112, 157, 202, 247, 292, 337].map((d) => (
            <line key={d} x1="40" y1="12" x2="40" y2="6" transform={`rotate(${d} 40 26)`} />
          ))}
        </g>
      </g>
      <circle cx="40" cy="26" r="22" fill="none" stroke={color} strokeWidth="1" opacity="0.45" className="aura-pulse" />
    </>
  );
}

// 4-점 별 (원점 기준) — 전설 sparkle 용
const STAR4 = 'M0,-3.4 L0.9,-0.9 L3.4,0 L0.9,0.9 L0,3.4 L-0.9,0.9 L-3.4,0 L-0.9,-0.9 Z';
const SPARKLE_POS: [number, number][] = [
  [14, 20], [60, 16], [58, 46], [22, 48], [68, 32], [12, 38], [70, 52], [40, 7],
  [30, 10], [50, 10], [16, 54], [64, 8],
];
function renderSparkles(count: number, rarity: Rarity): React.ReactNode {
  const star = rarity === 'legendary' || rarity === 'transcendent';
  const color = rarity === 'transcendent' ? '#FFFFFF' : rarity === 'legendary' ? '#FFF3C0' : '#FFFFFF';
  return SPARKLE_POS.slice(0, count).map(([x, y], i) => (
    <g key={i} className="sparkle" style={{ animationDelay: `${i * 0.28}s` }}>
      {star
        ? <path d={STAR4} fill={color} transform={`translate(${x} ${y}) scale(${0.85 + (i % 3) * 0.3})`} />
        : <circle cx={x} cy={y} r="1.7" fill={color} />}
    </g>
  ));
}

function moteRing(n: number, R: number, color: string, reverse?: boolean): React.ReactNode {
  return (
    <g className="halo-rotate" style={reverse ? { ...HALO_ORIGIN, animationDirection: 'reverse', animationDuration: '22s' } : HALO_ORIGIN}>
      {Array.from({ length: n }).map((_, i) => {
        const rad = ((360 / n) * i * Math.PI) / 180;
        return (
          <circle key={i} cx={40 + R * Math.cos(rad)} cy={26 + R * Math.sin(rad)} r={reverse ? 1.4 : 1.9}
                  fill={color} opacity="0.9" />
        );
      })}
    </g>
  );
}

function renderMotes(count: number, color: string): React.ReactNode {
  // 바깥 궤도 + 안쪽 역방향 궤도 2겹
  return (
    <>
      {moteRing(count, 27, color)}
      {moteRing(Math.max(2, count - 2), 17, '#FFFFFF', true)}
    </>
  );
}

// ── 줄기와 잎 (stage 1~2) ────────────────────────────────
function renderStemAndLeaves(speciesId: string, stage: number, withered: boolean | undefined, ctx: Ctx): React.ReactNode {
  const { leafFill, stemFill } = ctx;

  // 선인장: 굵은 줄기 + 가시
  if (speciesId === 'cactus') {
    return (
      <>
        <rect x="34" y={stage >= 2 ? 36 : 50} width="12" height={stage >= 2 ? 32 : 18} rx="6" fill={leafFill} />
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
        {stage >= 2 && (
          <rect x="46" y="44" width="8" height="14" rx="4" fill={leafFill} opacity="0.92" />
        )}
      </>
    );
  }

  // 대나무: 곧은 줄기 + 마디
  if (speciesId === 'bamboo') {
    const stalkTop = stage >= 2 ? 28 : 48;
    return (
      <>
        <line x1="40" y1="68" x2="40" y2={stalkTop} stroke={stemFill} strokeWidth="4" strokeLinecap="round" />
        <line x1="34" y1="60" x2="46" y2="60" stroke={stemFill} strokeWidth="1.5" opacity="0.7" />
        {stage >= 2 && <line x1="34" y1="44" x2="46" y2="44" stroke={stemFill} strokeWidth="1.5" opacity="0.7" />}
        {stage >= 2 && (
          <>
            {softLeaf(28, 38, 14, 8, -65, leafFill, stemFill, 'bl')}
            {softLeaf(52, 36, 14, 8, 65, leafFill, stemFill, 'br')}
          </>
        )}
      </>
    );
  }

  // 생명나무: 굵은 줄기 + 큰 둥근 잎 덩어리
  if (speciesId === 'tree_of_life') {
    return (
      <>
        <rect x="36" y={stage >= 2 ? 32 : 50} width="8" height={stage >= 2 ? 36 : 18} rx="2"
              fill={withered ? '#C7B68A' : '#7C4A1E'} opacity="0.95" />
        {stage >= 2 && (
          <>
            <circle cx="40" cy="30" r="14" fill={leafFill} opacity="0.92" />
            <circle cx="28" cy="38" r="9" fill={leafFill} opacity="0.82" />
            <circle cx="52" cy="38" r="9" fill={leafFill} opacity="0.82" />
            <circle cx="40" cy="20" r="8" fill={leafFill} opacity="0.95" />
          </>
        )}
      </>
    );
  }

  // 소나무·고사리: 가는 잎이 깃털처럼
  if (speciesId === 'pine' || speciesId === 'fern') {
    return (
      <>
        {curvedStem(40, 68, 40, stage >= 2 ? 28 : 50, 1.5, 3, stemFill, 'st')}
        {[58, 50, 42, 34].slice(0, stage + 1).map((y, i) => (
          <g key={i}>
            <line x1="40" y1={y} x2={40 - 12} y2={y - 3} stroke={leafFill} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1={y} x2={40 + 12} y2={y - 3} stroke={leafFill} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ))}
      </>
    );
  }

  // 이끼: 낮고 옆으로 퍼지는 덩어리
  if (speciesId === 'moss') {
    return (
      <>
        <ellipse cx="40" cy="66" rx="18" ry="5" fill={leafFill} opacity="0.92" />
        {stage >= 1 && <ellipse cx="32" cy="62" rx="8" ry="4" fill={leafFill} opacity="0.85" />}
        {stage >= 1 && <ellipse cx="50" cy="62" rx="8" ry="4" fill={leafFill} opacity="0.85" />}
      </>
    );
  }

  // 기본 (sprout/sunflower/herb/maple/lotus/clover/rose/orchid/cosmos 등)
  const topY = stage >= 2 ? 38 : 52;
  return (
    <>
      {curvedStem(40, 69, 40, topY, 2.5, stage >= 2 ? 3.5 : 3, stemFill, 'st')}
      {softLeaf(40, 60, 13, 9, -54, leafFill, stemFill, 'a')}
      {softLeaf(40, 60, 13, 9, 54, leafFill, stemFill, 'b')}
      {stage >= 2 && softLeaf(40, 52, 16, 11, -52, leafFill, stemFill, 'c')}
      {stage >= 2 && softLeaf(40, 52, 16, 11, 52, leafFill, stemFill, 'd')}
      {stage >= 2 && softLeaf(40, 47, 14, 10, 0, leafFill, stemFill, 'e')}
    </>
  );
}

// ── 종별 꽃 (stage 3) ────────────────────────────────────
function renderFlower(speciesId: string, accent: string, withered: boolean | undefined, ctx: Ctx): React.ReactNode {
  const { gid, flowerFill } = ctx;
  const c = withered ? '#C7B68A' : accent;
  const petal = withered ? c : flowerFill;
  const stem = withered ? '#C7B68A' : ctx.stemFill;

  // 클로버: 4-잎 패턴
  if (speciesId === 'clover') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="28" r="6" fill={petal} opacity="0.9" />
        <circle cx="48" cy="28" r="6" fill={petal} opacity="0.9" />
        <circle cx="40" cy="20" r="6" fill={petal} opacity="0.9" />
        <circle cx="40" cy="34" r="5" fill={petal} opacity="0.85" />
      </g>
    );
  }

  // 장미: 다중 꽃잎 원
  if (speciesId === 'rose') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <circle cx="40" cy="24" r="10" fill={petal} opacity="0.92" />
        <circle cx="40" cy="24" r="7" fill={petal} opacity="0.7" />
        <circle cx="40" cy="24" r="4" fill="#FFFFFF" opacity="0.4" />
      </g>
    );
  }

  // 선인장: 윗부분에 작은 흰꽃
  if (speciesId === 'cactus') {
    return (
      <g>
        <circle cx="40" cy="34" r="4" fill={withered ? '#C7B68A' : '#FFF6D8'} opacity="0.95" />
        <circle cx="40" cy="34" r="2" fill={petal} opacity="0.8" />
      </g>
    );
  }

  // 난초: 우아한 보라 꽃잎 3장
  if (speciesId === 'orchid') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="34" cy="24" rx="6" ry="9" fill={petal} opacity="0.9" transform="rotate(-25 34 24)" />
        <ellipse cx="46" cy="24" rx="6" ry="9" fill={petal} opacity="0.9" transform="rotate(25 46 24)" />
        <ellipse cx="40" cy="20" rx="5" ry="8" fill={petal} opacity="0.94" />
        <circle cx="40" cy="26" r="2.5" fill="#FFF6D8" opacity="0.85" />
      </g>
    );
  }

  // 대나무: 잎 다발만 (꽃 없음)
  if (speciesId === 'bamboo') {
    return (
      <g>
        <ellipse cx="32" cy="32" rx="8" ry="3.5" fill={petal} opacity="0.85" transform="rotate(-25 32 32)" />
        <ellipse cx="48" cy="30" rx="8" ry="3.5" fill={petal} opacity="0.85" transform="rotate(25 48 30)" />
        <ellipse cx="40" cy="26" rx="7" ry="3" fill={petal} opacity="0.9" />
      </g>
    );
  }

  // 코스모스: 큰 꽃잎 6개
  if (speciesId === 'cosmos') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="2.5" strokeLinecap="round" />
        {petalRing(6, 40, 16, 3.5, 8, 26, petal, 0.88)}
        <circle cx="40" cy="26" r="3" fill="#FFD44A" opacity="0.95" />
      </g>
    );
  }

  // 민들레: 노란 꽃잎 (활짝 핀 민들레)
  if (speciesId === 'dandelion') {
    const dandelionYellow = withered ? '#C7B68A' : '#FFD700';
    const dandelionCenter = withered ? '#C7B68A' : '#FFA500';
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="2.5" strokeLinecap="round" />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <ellipse
            key={deg}
            cx={40 + 7 * Math.cos(((deg - 90) * Math.PI) / 180)}
            cy={24 + 7 * Math.sin(((deg - 90) * Math.PI) / 180)}
            rx="2.5" ry="5"
            fill={dandelionYellow}
            opacity="0.92"
            transform={`rotate(${deg} ${40 + 7 * Math.cos(((deg - 90) * Math.PI) / 180)} ${24 + 7 * Math.sin(((deg - 90) * Math.PI) / 180)})`}
          />
        ))}
        <circle cx="40" cy="24" r="4" fill={dandelionCenter} opacity="0.95" />
      </g>
    );
  }

  // 튤립: 잔 모양 (아래 좁고 위 넓은 컵)
  if (speciesId === 'tulip') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {/* 뒤쪽 꽃잎 (살짝 어둡게) */}
        <ellipse cx="33" cy="20" rx="6" ry="10" fill={petal} opacity="0.7" transform="rotate(-18 33 20)" />
        <ellipse cx="47" cy="20" rx="6" ry="10" fill={petal} opacity="0.7" transform="rotate(18 47 20)" />
        {/* 앞쪽 본체 (컵 형태) */}
        <path d="M36 30 Q27 22 28 16 Q30 8 40 8 Q50 8 52 16 Q53 22 44 30 Z" fill={petal} opacity="0.94" />
        {/* 꽃잎 결 */}
        <path d="M40 8 Q38 18 37 28 M40 8 Q42 18 43 28" stroke={withered ? '#C7B68A' : '#FFFFFF'} strokeWidth="0.8" opacity="0.38" fill="none" strokeLinecap="round" />
      </g>
    );
  }

  // 데이지: 흰 꽃잎 5장 + 노란 중심
  if (speciesId === 'daisy') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="2.5" strokeLinecap="round" />
        {petalRing(5, 40, 18, 3, 7, 26, petal, 0.92)}
        <circle cx="40" cy="26" r="3" fill="#FFD44A" />
      </g>
    );
  }

  // 민트: 작은 잎 다발 (꽃 없이)
  if (speciesId === 'mint') {
    return (
      <g>
        <ellipse cx="32" cy="30" rx="6" ry="3" fill={petal} opacity="0.88" transform="rotate(-25 32 30)" />
        <ellipse cx="48" cy="28" rx="6" ry="3" fill={petal} opacity="0.88" transform="rotate(25 48 28)" />
        <ellipse cx="40" cy="22" rx="5" ry="3" fill={petal} opacity="0.9" />
      </g>
    );
  }

  // 카네이션: 주름진 꽃잎
  if (speciesId === 'carnation') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <circle cx="36" cy="24" r="6" fill={petal} opacity="0.85" />
        <circle cx="44" cy="24" r="6" fill={petal} opacity="0.85" />
        <circle cx="40" cy="20" r="6" fill={petal} opacity="0.9" />
        <circle cx="40" cy="24" r="3" fill={withered ? '#C7B68A' : '#FFFFFF'} opacity="0.5" />
      </g>
    );
  }

  // 수국: 작은 꽃송이가 모인 둥근 덩어리
  if (speciesId === 'hydrangea') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {[[34, 26], [46, 26], [40, 18], [32, 20], [48, 20], [40, 28]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="3.5" fill={petal} opacity="0.85" />
        ))}
      </g>
    );
  }

  // 반딧불꽃: 빛 점이 박힌 꽃
  if (speciesId === 'firefly_flower') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="40" cy="24" r="9" fill={withered ? '#C7B68A' : '#5A4F8A'} opacity="0.85" />
        {!withered && [[36, 22], [44, 22], [40, 18], [38, 28], [42, 28]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="1.5" fill="#FFE066" opacity="1">
            <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
          </circle>
        ))}
      </g>
    );
  }

  // 무지개붓꽃: 위아래로 흐르는 꽃잎
  if (speciesId === 'rainbow_iris') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="34" cy="24" rx="5" ry="10" fill={withered ? '#C7B68A' : '#FF80A0'} opacity="0.88" transform="rotate(-20 34 24)" />
        <ellipse cx="46" cy="24" rx="5" ry="10" fill={withered ? '#C7B68A' : '#FFD44A'} opacity="0.88" transform="rotate(20 46 24)" />
        <ellipse cx="40" cy="18" rx="5" ry="11" fill={withered ? '#C7B68A' : '#80E0FF'} opacity="0.9" />
        <circle cx="40" cy="26" r="3" fill={withered ? '#C7B68A' : '#FFFFFF'} opacity="0.7" />
      </g>
    );
  }

  // 달꽃: 반달 모양 꽃잎 + 빛
  if (speciesId === 'moonbloom') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <circle cx="40" cy="22" r="11" fill={withered ? '#C7B68A' : '#E8E0FF'} opacity="0.85" />
        <circle cx="40" cy="22" r="6" fill={withered ? '#D1C4A8' : '#FFFFFF'} opacity="0.92" />
        <path d="M40 18 Q44 22 40 26 Q36 22 40 18 Z" fill={withered ? '#D1C4A8' : '#FFE6A8'} opacity="0.95" />
      </g>
    );
  }

  // 생명나무: 큰 빛 구체
  if (speciesId === 'tree_of_life') {
    return (
      <g>
        <circle cx="40" cy="24" r="6" fill={withered ? '#D1C4A8' : '#FFE066'} opacity="0.95">
          {!withered && <animate attributeName="r" values="6;7;6" dur="3s" repeatCount="indefinite" />}
        </circle>
        <circle cx="40" cy="24" r="3" fill="#FFFFFF" opacity="0.7" />
      </g>
    );
  }

  // ── 연약 전설 5종 (그라데이션·다층 꽃잎) ──────────────────

  // 수정장미
  if (speciesId === 'crystal_rose') {
    return (
      <g>
        <defs>
          <radialGradient id={gid('crystal-rose')} cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#FF9AD0" />
            <stop offset="100%" stopColor="#C0418F" />
          </radialGradient>
        </defs>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <polygon key={deg} points="40,8 36,22 40,26 44,22"
                   fill={withered ? c : `url(#${gid('crystal-rose')})`} opacity="0.9"
                   transform={`rotate(${deg} 40 24)`} />
        ))}
        <polygon points="40,18 34,24 40,32 46,24" fill={withered ? '#D1C4A8' : '#FFFFFF'} opacity="0.9" />
        <polygon points="40,20 37,24 40,29 43,24" fill={withered ? c : '#FF6FB5'} opacity="0.85" />
        <circle cx="40" cy="24" r="2" fill={withered ? '#D1C4A8' : '#FFFFFF'}>
          {!withered && <animate attributeName="opacity" values="1;0.4;1" dur="2.2s" repeatCount="indefinite" />}
        </circle>
      </g>
    );
  }

  // 별빛백합
  if (speciesId === 'starlight_lily') {
    return (
      <g>
        <defs>
          <radialGradient id={gid('starlight-lily')} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#A9C0FF" />
            <stop offset="100%" stopColor="#4A4F9E" />
          </radialGradient>
        </defs>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={deg} cx="40" cy="14" rx="3.5" ry="11"
                   fill={withered ? c : `url(#${gid('starlight-lily')})`} opacity="0.92"
                   transform={`rotate(${deg} 40 25)`} />
        ))}
        <circle cx="40" cy="25" r="4" fill={withered ? '#D1C4A8' : '#FFE89A'} opacity="0.95" />
        <circle cx="40" cy="25" r="1.6" fill={withered ? '#C7B68A' : '#FFFFFF'} />
        {!withered && [[28, 16], [52, 16], [40, 8]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="1.2" fill="#FFFFFF">
            <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </g>
    );
  }

  // 오로라난초
  if (speciesId === 'aurora_orchid') {
    return (
      <g>
        <defs>
          <linearGradient id={gid('aurora-orchid')} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF8AD0" />
            <stop offset="50%" stopColor="#9A7BFF" />
            <stop offset="100%" stopColor="#6FE6E0" />
          </linearGradient>
        </defs>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="30" cy="22" rx="7" ry="11" fill={withered ? c : `url(#${gid('aurora-orchid')})`} opacity="0.9" transform="rotate(-30 30 22)" />
        <ellipse cx="50" cy="22" rx="7" ry="11" fill={withered ? c : `url(#${gid('aurora-orchid')})`} opacity="0.9" transform="rotate(30 50 22)" />
        <ellipse cx="40" cy="16" rx="6" ry="11" fill={withered ? c : `url(#${gid('aurora-orchid')})`} opacity="0.92" />
        <ellipse cx="34" cy="28" rx="5" ry="8" fill={withered ? c : `url(#${gid('aurora-orchid')})`} opacity="0.85" transform="rotate(-15 34 28)" />
        <ellipse cx="46" cy="28" rx="5" ry="8" fill={withered ? c : `url(#${gid('aurora-orchid')})`} opacity="0.85" transform="rotate(15 46 28)" />
        <circle cx="40" cy="24" r="3" fill={withered ? '#D1C4A8' : '#FFFFFF'} opacity="0.9">
          {!withered && <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.5s" repeatCount="indefinite" />}
        </circle>
      </g>
    );
  }

  // 황금모란
  if (speciesId === 'golden_peony') {
    return (
      <g>
        <defs>
          <radialGradient id={gid('golden-peony')} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#FFF3C0" />
            <stop offset="55%" stopColor="#FFD24A" />
            <stop offset="100%" stopColor="#E0902A" />
          </radialGradient>
        </defs>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <ellipse key={`o${deg}`} cx="40" cy="14" rx="5" ry="9"
                   fill={withered ? c : `url(#${gid('golden-peony')})`} opacity="0.85"
                   transform={`rotate(${deg} 40 24)`} />
        ))}
        {[22, 67, 112, 157, 202, 247, 292, 337].map((deg) => (
          <ellipse key={`i${deg}`} cx="40" cy="18" rx="3.5" ry="6"
                   fill={withered ? c : `url(#${gid('golden-peony')})`} opacity="0.95"
                   transform={`rotate(${deg} 40 24)`} />
        ))}
        <circle cx="40" cy="24" r="3.5" fill={withered ? '#D1C4A8' : '#FFF8D8'} opacity="0.95" />
      </g>
    );
  }

  // 여명백합
  if (speciesId === 'dawn_lily') {
    return (
      <g>
        <defs>
          <radialGradient id={gid('dawn-lily')} cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#FFFBEA" />
            <stop offset="40%" stopColor="#FFD79A" />
            <stop offset="75%" stopColor="#FF9E7A" />
            <stop offset="100%" stopColor="#F2728C" />
          </radialGradient>
        </defs>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {!withered && (
          <g stroke="#FFE6A8" strokeWidth="1" opacity="0.7">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line key={deg} x1="40" y1="24" x2="40" y2="6" transform={`rotate(${deg} 40 24)`}>
                <animate attributeName="opacity" values="0.7;0.15;0.7" dur="3s" begin={`${(deg / 360).toFixed(2)}s`} repeatCount="indefinite" />
              </line>
            ))}
          </g>
        )}
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={deg} cx="40" cy="15" rx="4" ry="10"
                   fill={withered ? c : `url(#${gid('dawn-lily')})`} opacity="0.92"
                   transform={`rotate(${deg} 40 24)`} />
        ))}
        <circle cx="40" cy="24" r="5" fill={withered ? '#D1C4A8' : '#FFFBEA'} opacity="0.95">
          {!withered && <animate attributeName="r" values="5;6;5" dur="2.8s" repeatCount="indefinite" />}
        </circle>
      </g>
    );
  }

  // 해바라기: 넓은 노란 꽃잎 + 진한 갈색 중심
  if (speciesId === 'sunflower') {
    const petalColor = withered ? '#C7B68A' : '#FFD700';
    const petalInner = withered ? '#B8A87A' : '#FFC200';
    const centerColor = withered ? '#8B7A5A' : '#5C3317';
    const centerInner = withered ? '#7A6A4A' : '#3D2009';
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="27" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5].map((deg) => (
          <ellipse
            key={deg}
            cx={40 + 10 * Math.cos(((deg - 90) * Math.PI) / 180)}
            cy={26 + 10 * Math.sin(((deg - 90) * Math.PI) / 180)}
            rx="2" ry="6"
            fill={petalColor}
            opacity="0.92"
            transform={`rotate(${deg} ${40 + 10 * Math.cos(((deg - 90) * Math.PI) / 180)} ${26 + 10 * Math.sin(((deg - 90) * Math.PI) / 180)})`}
          />
        ))}
        {[11.25, 33.75, 56.25, 78.75, 101.25, 123.75, 146.25, 168.75, 191.25, 213.75, 236.25, 258.75, 281.25, 303.75, 326.25, 348.75].map((deg) => (
          <ellipse
            key={`inner-${deg}`}
            cx={40 + 8 * Math.cos(((deg - 90) * Math.PI) / 180)}
            cy={26 + 8 * Math.sin(((deg - 90) * Math.PI) / 180)}
            rx="1.5" ry="4.5"
            fill={petalInner}
            opacity="0.75"
            transform={`rotate(${deg} ${40 + 8 * Math.cos(((deg - 90) * Math.PI) / 180)} ${26 + 8 * Math.sin(((deg - 90) * Math.PI) / 180)})`}
          />
        ))}
        <circle cx="40" cy="26" r="6" fill={centerColor} opacity="0.97" />
        <circle cx="40" cy="26" r="4" fill={centerInner} opacity="0.85" />
        {[[38, 24], [42, 24], [38, 28], [42, 28], [40, 22], [40, 30]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="0.7" fill="#C8A87A" opacity="0.6" />
        ))}
      </g>
    );
  }

  // ── 초월: 천상수 — 빛의 별나무 (8각 빛별 + 방사 광선 + 궤도 보석) ──
  if (speciesId === 'celestial_tree') {
    const star = withered ? '#D1C4A8' : `url(#${gid('ct-core')})`;
    return (
      <g>
        <defs>
          <radialGradient id={gid('ct-core')} cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#FFF1A8" />
            <stop offset="100%" stopColor="#F2B33A" />
          </radialGradient>
          <radialGradient id={gid('ct-halo')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE89A" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FFE89A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <line x1="40" y1="40" x2="40" y2="30" stroke={stem} strokeWidth="3.5" strokeLinecap="round" />
        {/* 빛무리 (맥동) */}
        <circle cx="40" cy="24" r="22" fill={withered ? 'none' : `url(#${gid('ct-halo')})`}>
          {!withered && <animate attributeName="r" values="19;24;19" dur="3.4s" repeatCount="indefinite" />}
        </circle>
        {/* 방사 광선 (god-ray 3겹 — viewBox 밖까지 길게) */}
        {!withered && (
          <g className="halo-rotate" style={{ transformBox: 'view-box', transformOrigin: '40px 24px' }}>
            <g stroke="#FFF6CF" strokeWidth="1.4" opacity="0.5" strokeLinecap="round">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
                <line key={d} x1="40" y1="6" x2="40" y2="-22" transform={`rotate(${d} 40 24)`} />
              ))}
            </g>
            <g stroke="#FFF6CF" strokeWidth="1.1" opacity="0.85" strokeLinecap="round">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
                <line key={d} x1="40" y1="9" x2="40" y2="-4" transform={`rotate(${d} 40 24)`} />
              ))}
            </g>
            <g stroke="#FFD66A" strokeWidth="0.9" opacity="0.7" strokeLinecap="round">
              {[22, 67, 112, 157, 202, 247, 292, 337].map((d) => (
                <line key={d} x1="40" y1="12" x2="40" y2="-2" transform={`rotate(${d} 40 24)`} />
              ))}
            </g>
          </g>
        )}
        {/* 8각 빛별 (STAR4 두 겹) */}
        <path d={STAR4} fill={star} transform="translate(40 24) scale(3.4)" />
        <path d={STAR4} fill={star} opacity="0.85" transform="translate(40 24) rotate(45) scale(2.8)" />
        <path d={STAR4} fill={withered ? '#E4D8BC' : '#FFFFFF'} transform="translate(40 24) scale(1.5)">
          {!withered && <animate attributeName="opacity" values="1;0.55;1" dur="2.2s" repeatCount="indefinite" />}
        </path>
        {/* 궤도 보석 (반짝임) */}
        {!withered && [[26, 15], [54, 15], [40, 39], [23, 31], [57, 31]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="1.5" fill="#FFF1A8">
            <animate attributeName="opacity" values="1;0.2;1" dur="2s" begin={`${i * 0.35}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </g>
    );
  }

  // ── 초월: 영겁화 — 오로라빛 3겹 꽃잎 + 맥동 코어 ──
  if (speciesId === 'eternal_bloom') {
    const outer = withered ? c : `url(#${gid('eb-petal')})`;
    const inner = withered ? '#D1C4A8' : `url(#${gid('eb-core')})`;
    return (
      <g>
        <defs>
          <linearGradient id={gid('eb-petal')} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFB8E8" />
            <stop offset="50%" stopColor="#C9A0FF" />
            <stop offset="100%" stopColor="#80E0FF" />
          </linearGradient>
          <radialGradient id={gid('eb-core')} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#FF9AD8" />
            <stop offset="100%" stopColor="#9A6BFF" />
          </radialGradient>
        </defs>
        <line x1="40" y1="40" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {petalRing(12, 40, 11, 3, 7, 24, outer, 0.85)}
        {petalRing(10, 40, 14, 2.5, 5.5, 24, withered ? '#E4D8BC' : '#FFE3F4', 0.8)}
        {petalRing(8, 40, 17, 2, 4.5, 24, inner, 0.9)}
        <circle cx="40" cy="24" r="6" fill={inner}>
          {!withered && <animate attributeName="r" values="5.4;6.6;5.4" dur="3s" repeatCount="indefinite" />}
        </circle>
        <circle cx="40" cy="24" r="3" fill={withered ? '#E4D8BC' : '#FFFFFF'}>
          {!withered && <animate attributeName="opacity" values="1;0.5;1" dur="2.2s" repeatCount="indefinite" />}
        </circle>
        {/* 흩날리는 꽃잎 입자 */}
        {!withered && [[24, 20, 0], [56, 22, 1.3], [20, 30, 2.6], [58, 33, 0.7]].map(([cx, cy, delay], i) => (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx="2.2" ry="1.3" fill={i % 2 ? '#C9A0FF' : '#FFB8E8'} opacity="0">
              <animate attributeName="opacity" values="0;0.85;0" dur="4s" begin={`${delay}s`} repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="translate"
                values="0 0; -3 -16; -5 -30" dur="4s" begin={`${delay}s`} repeatCount="indefinite" />
            </ellipse>
          </g>
        ))}
      </g>
    );
  }

  // ── 초월: 은하백합 — 6장 백합 + 성운 코어 + 별가루 ──
  if (speciesId === 'galaxy_lily') {
    const petalG = withered ? c : `url(#${gid('gl-petal')})`;
    return (
      <g>
        <defs>
          <linearGradient id={gid('gl-petal')} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C9A0FF" />
            <stop offset="55%" stopColor="#80B0FF" />
            <stop offset="100%" stopColor="#3E3E7A" />
          </linearGradient>
          <radialGradient id={gid('gl-core')} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#EAF0FF" />
            <stop offset="45%" stopColor="#6A78D8" />
            <stop offset="100%" stopColor="#23234E" />
          </radialGradient>
          <radialGradient id={gid('gl-nebula')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#9A7BFF" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#5A6BD8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#5A6BD8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <line x1="40" y1="40" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {/* 흐릿한 성운 헤일로 (코어 뒤) */}
        {!withered && (
          <circle cx="40" cy="24" r="22" fill={`url(#${gid('gl-nebula')})`}>
            <animate attributeName="r" values="20;25;20" dur="5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;1;0.7" dur="5s" repeatCount="indefinite" />
          </circle>
        )}
        {/* 옅은 궤도 링 */}
        {!withered && (
          <ellipse cx="40" cy="24" rx="19" ry="6" fill="none" stroke="#C9D2FF" strokeWidth="0.6" opacity="0.4">
            <animateTransform attributeName="transform" type="rotate" from="0 40 24" to="360 40 24" dur="22s" repeatCount="indefinite" />
          </ellipse>
        )}
        {/* 바깥 6장 + 안쪽 6장(엇갈림) 백합 꽃잎 */}
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={deg} cx="40" cy="12" rx="3.6" ry="11" fill={petalG} opacity="0.92"
                   transform={`rotate(${deg} 40 24)`} />
        ))}
        {[30, 90, 150, 210, 270, 330].map((deg) => (
          <ellipse key={`i-${deg}`} cx="40" cy="16" rx="2.4" ry="7.5" fill={petalG} opacity="0.7"
                   transform={`rotate(${deg} 40 24)`} />
        ))}
        {/* 성운 코어 */}
        <circle cx="40" cy="24" r="9" fill={withered ? '#D1C4A8' : `url(#${gid('gl-core')})`} opacity="0.95" />
        {/* 별가루 (반짝임) */}
        {!withered && [[35, 19], [45, 19], [40, 15], [34, 28], [46, 28], [40, 31], [38, 23], [30, 16], [50, 16], [28, 24], [52, 25], [40, 9]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="0.85" fill="#FFFFFF">
            <animate attributeName="opacity" values="1;0.15;1" dur="1.9s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        ))}
        <circle cx="40" cy="24" r="2.6" fill={withered ? '#E4D8BC' : '#FFFFFF'} opacity="0.95" />
      </g>
    );
  }

  // 기본: 단일 꽃 (sprout/herb/maple/lotus 등)
  return (
    <>
      <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="26" r="8" fill={petal} opacity="0.92" />
      <circle cx="40" cy="26" r="3.5" fill="#FFFFFF" opacity="0.55" />
    </>
  );
}

// ── 만개 보조 꽃송이 (stage 4+) ────────────────────────────
function renderBloom(speciesId: string, accent: string, withered: boolean | undefined, ctx: Ctx): React.ReactNode {
  const c = withered ? '#D1C4A8' : ctx.flowerFill;
  const NO_BLOOM_OVERLAY = new Set([
    'cactus', 'moss', 'mint', 'pine', 'fern', 'tree_of_life', 'bamboo',
    'crystal_rose', 'starlight_lily', 'aurora_orchid', 'golden_peony', 'dawn_lily',
    'sunflower', 'tulip',
    'celestial_tree', 'eternal_bloom', 'galaxy_lily',
  ]);
  if (NO_BLOOM_OVERLAY.has(speciesId)) return null;
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
    dandelion: '#6B8E2E',
    moss:      '#4A6B3A',
    tulip:     '#5A8C4E',
    daisy:     '#5D8F3E',
    mint:      '#4F8C5E',
    pine:      '#2D5A3E',
    fern:      '#3E7A4F',
    hydrangea: '#4F7A8A',
    carnation: '#5A8C3E',
    firefly_flower: '#5A4F8A',
    rainbow_iris:   '#6B4F8C',
    moonbloom: '#4F5A8C',
    tree_of_life: '#5A3E1E',
    crystal_rose:   '#5A8C3E',
    starlight_lily: '#4A5E8C',
    aurora_orchid:  '#5A7A8C',
    golden_peony:   '#5A8C3E',
    dawn_lily:      '#6A8C4E',
    celestial_tree: '#7A6A3A',
    eternal_bloom:  '#6A4F8C',
    galaxy_lily:    '#3E3E7A',
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
    dandelion: '#FFE066',
    moss:      '#7AAE6F',
    tulip:     '#E85A6E',
    daisy:     '#FFFFFF',
    mint:      '#A8E0C0',
    pine:      '#3E7A4F',
    fern:      '#A8D0A0',
    hydrangea: '#A0C8E0',
    carnation: '#FFA0B5',
    firefly_flower: '#FFE066',
    rainbow_iris:   '#FF80FF',
    moonbloom: '#E8E0FF',
    tree_of_life: '#FFD44A',
    crystal_rose:   '#FF8AD0',
    starlight_lily: '#A9C0FF',
    aurora_orchid:  '#9A7BFF',
    golden_peony:   '#FFD24A',
    dawn_lily:      '#FF9E7A',
    celestial_tree: '#FFE89A',
    eternal_bloom:  '#FF8AD0',
    galaxy_lily:    '#A9C0FF',
  };
  return map[speciesId] ?? '#A8D08D';
}
