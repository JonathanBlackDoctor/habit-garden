import { useId } from 'react';

// 6 티어 × 5 서브레벨 = 30레벨 배지 (Bloom 시안 · level_desigh/badges-v2.jsx 포팅)
// 30 초과 레벨은 최고 티어(Aurora) 5단계로 고정한다.

type Tier = {
  id: number;
  name: string;
  c1: string; c2: string; c3: string;
  petal: string; accent: string; gem: string; glow: string; dust: string;
};

const SOFT_TIERS: Tier[] = [
  { id: 1, name: 'Pearl Mist',   c1: '#FFFFFF', c2: '#E5ECF0', c3: '#A8B8C0', petal: '#D8E2E8', accent: '#FFFFFF', gem: '#9CB0BC', glow: '#C8D8E0', dust: '#FFFFFF' },
  { id: 2, name: 'Rose Blush',   c1: '#FFFFFF', c2: '#FFD8E2', c3: '#E89AB0', petal: '#FFCBD8', accent: '#FFE8F0', gem: '#E68AA8', glow: '#FFB0C8', dust: '#FFFFFF' },
  { id: 3, name: 'Golden Honey', c1: '#FFFFFF', c2: '#FFE89A', c3: '#E8B23A', petal: '#FFD97A', accent: '#FFF6C8', gem: '#E8A82A', glow: '#FFD24A', dust: '#FFF3C0' },
  { id: 4, name: 'Coral Dawn',   c1: '#FFFFFF', c2: '#FFD7BC', c3: '#FF9E7A', petal: '#FFBC9A', accent: '#FFE8D8', gem: '#F2728C', glow: '#FF9E7A', dust: '#FFE3D0' },
  { id: 5, name: 'Amethyst',     c1: '#FFFFFF', c2: '#E0D0FF', c3: '#9A7BFF', petal: '#C8B0FF', accent: '#F0E8FF', gem: '#7A5DD8', glow: '#9A7BFF', dust: '#F0E8FF' },
  { id: 6, name: 'Aurora',       c1: '#FFFFFF', c2: '#C9A0FF', c3: '#3E3E7A', petal: '#A98CFF', accent: '#FFFFFF', gem: '#6A78D8', glow: '#C9A0FF', dust: '#FFFFFF' },
];

export const TIER_NAMES = SOFT_TIERS.map((t) => t.name);

export const tierOf = (level: number) => Math.min(6, Math.max(1, Math.ceil(Math.max(1, level) / 5)));
export const subOf  = (level: number) => (level > 30 ? 5 : ((Math.max(1, level) - 1) % 5) + 1);

const BLOOM_PETALS = [
  { n: 5,  rx: 5.5, ry: 9.5,  n2: 0 },
  { n: 6,  rx: 5.0, ry: 10,   n2: 0 },
  { n: 8,  rx: 4.2, ry: 10,   n2: 0 },
  { n: 6,  rx: 5.2, ry: 11,   n2: 6 },
  { n: 8,  rx: 4.6, ry: 10.5, n2: 8 },
  { n: 12, rx: 3.5, ry: 10.5, n2: 8 },
];

const BLOOM_MOTION = [
  { spin: 90, breathe: 6.0 },
  { spin: 75, breathe: 5.5 },
  { spin: 60, breathe: 5.0 },
  { spin: 50, breathe: 4.5 },
  { spin: 40, breathe: 4.0 },
  { spin: 28, breathe: 3.4 },
];

const SUB_PETAL_SCALE   = [0.35, 0.65, 1.0, 1.0, 1.05];
const SUB_PETAL_OPACITY = [0.78, 0.92, 0.95, 0.95, 1.0];

export type BloomBadgeProps = {
  level: number;
  size?: number;
  motion?: boolean;
};

export default function BloomBadge({ level, size = 28, motion = true }: BloomBadgeProps) {
  const uid = useId().replace(/[:]/g, '');
  const t = tierOf(level);
  const s = subOf(level);
  const p = SOFT_TIERS[t - 1];
  const cfg = BLOOM_PETALS[t - 1];
  const m = BLOOM_MOTION[t - 1];
  const petalScale = SUB_PETAL_SCALE[s - 1];
  const petalOp = SUB_PETAL_OPACITY[s - 1];

  const coreId  = `${uid}-core`;
  const petalId = `${uid}-petal`;
  const haloId  = `${uid}-halo`;

  const cls = (name: string) => (motion ? name : undefined);

  // sub1: 봉오리
  const Bud = (
    <g>
      <path d="M22 40 Q26 44 32 42 Q38 44 42 40 Q40 36 32 36 Q24 36 22 40 Z" fill={p.c3} opacity="0.55" />
      <g>
        {[-16, 0, 16].map((deg, i) => (
          <path
            key={i}
            d="M32 14 Q26 22 28 32 Q32 36 36 32 Q38 22 32 14 Z"
            fill={`url(#${petalId})`}
            opacity={petalOp}
            transform={`rotate(${deg} 32 36)`}
          />
        ))}
      </g>
      <ellipse cx="30" cy="20" rx="1.5" ry="3" fill={p.c1} opacity="0.6" />
    </g>
  );

  // sub2+: 외곽 꽃잎
  const cy = 32 - cfg.ry * petalScale - 4;
  const petals = [];
  for (let i = 0; i < cfg.n; i++) {
    const deg = (360 / cfg.n) * i;
    petals.push(
      <ellipse
        key={`o${i}`}
        cx="32" cy={cy}
        rx={cfg.rx * petalScale} ry={cfg.ry * petalScale}
        fill={`url(#${petalId})`} opacity={petalOp}
        transform={`rotate(${deg} 32 32)`}
      />,
    );
  }

  // sub4+: 안쪽 꽃잎 링
  const innerPetals = [];
  if (s >= 4) {
    const innerCount = cfg.n2 || cfg.n;
    const innerScale = (s >= 5 ? 0.78 : 0.7) * petalScale;
    const offset = 360 / innerCount / 2;
    const iry = cfg.ry * innerScale;
    const icy = 32 - iry - 2;
    for (let i = 0; i < innerCount; i++) {
      const deg = (360 / innerCount) * i + offset;
      innerPetals.push(
        <ellipse
          key={`i${i}`}
          cx="32" cy={icy}
          rx={cfg.rx * innerScale} ry={iry}
          fill={`url(#${petalId})`} opacity="0.85"
          transform={`rotate(${deg} 32 32)`}
        />,
      );
    }
  }

  // sub3+: 외곽 작은 잎
  const leaves = [];
  if (s >= 3) {
    const count = s === 3 ? 2 : s === 4 ? 4 : 6;
    for (let i = 0; i < count; i++) {
      const deg = -90 + (360 / count) * i;
      const rad = (deg * Math.PI) / 180;
      const R = 24;
      const lx = 32 + R * Math.cos(rad);
      const ly = 32 + R * Math.sin(rad);
      leaves.push(
        <ellipse
          key={i} cx={lx} cy={ly} rx="2" ry="3.5"
          fill={p.c3} opacity="0.55"
          transform={`rotate(${deg + 90} ${lx} ${ly})`}
        />,
      );
    }
  }

  // sub5: 별가루 궤도
  const dustOrbit = [];
  if (s >= 5) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const deg = (360 / count) * i;
      const rad = (deg * Math.PI) / 180;
      dustOrbit.push(
        <circle key={i} cx={32 + 27 * Math.cos(rad)} cy={32 + 27 * Math.sin(rad)} r={1.1} fill={p.dust} opacity="0.85" />,
      );
    }
  }

  // sub3+ 트윙클
  const sparkPos: Array<[number, number, number, number]> = [
    [12, 18, 1.2, 0], [52, 18, 1.2, 0.3], [32, 52, 1.1, 0.6], [8, 38, 1.0, 0.9], [56, 38, 1.0, 1.2],
  ];
  const sparkN = s < 3 ? 0 : s === 3 ? 2 : s === 4 ? 4 : sparkPos.length;

  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      style={{ display: 'block', overflow: 'visible' }}
      role="img"
      aria-label={`레벨 ${level} · ${p.name}`}
    >
      <defs>
        <radialGradient id={coreId} cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor={p.c1} />
          <stop offset="45%" stopColor={p.c2} />
          <stop offset="100%" stopColor={p.c3} />
        </radialGradient>
        <radialGradient id={petalId} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor={p.accent} />
          <stop offset="60%" stopColor={p.petal} />
          <stop offset="100%" stopColor={p.c3} />
        </radialGradient>
        <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.glow} stopOpacity="0.55" />
          <stop offset="70%" stopColor={p.glow} stopOpacity="0.10" />
          <stop offset="100%" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className={cls('bv2-bl-bloom')}>
        {/* sub5: 후광 */}
        {s >= 5 && (
          <>
            <circle cx="32" cy="32" r="30" fill={`url(#${haloId})`} className={cls('bv2-halo')} />
            <circle cx="32" cy="32" r="28" fill="none" stroke={p.glow} strokeWidth="0.5" opacity="0.4" />
          </>
        )}

        {/* sub5: 별가루 궤도 (역회전) */}
        {dustOrbit.length > 0 && (
          <g className={cls('bv2-bl-spinR')} style={{ ['--bv2-speed' as string]: `${m.spin * 1.4}s` }}>
            {dustOrbit}
          </g>
        )}

        {/* sub3+: 외곽 잎 */}
        {leaves.length > 0 && (
          <g className={cls('bv2-bl-spin')} style={{ ['--bv2-speed' as string]: `${m.spin * 2}s` }}>
            {leaves}
          </g>
        )}

        {/* 코어 글로우 */}
        <circle cx="32" cy="32" r="6" fill={`url(#${coreId})`} opacity="0.45" className={cls('bv2-bl-core')} />

        {/* 메인 블룸 */}
        {s === 1 ? (
          <g className={cls('bv2-bl-breath')} style={{ ['--bv2-breathe' as string]: `${m.breathe}s` }}>
            {Bud}
          </g>
        ) : (
          <g className={cls('bv2-bl-spin')} style={{ ['--bv2-speed' as string]: `${m.spin}s` }}>
            <g className={cls('bv2-bl-breath')} style={{ ['--bv2-breathe' as string]: `${m.breathe}s` }}>
              {petals}
            </g>
          </g>
        )}

        {/* sub4+: 안쪽 꽃잎 링 (역회전) */}
        {innerPetals.length > 0 && (
          <g className={cls('bv2-bl-spinR')} style={{ ['--bv2-speed' as string]: `${m.spin * 0.7}s` }}>
            <g className={cls('bv2-bl-breath')} style={{ ['--bv2-breathe' as string]: `${m.breathe * 0.85}s` }}>
              {innerPetals}
            </g>
          </g>
        )}

        {/* 트윙클 */}
        {sparkN > 0 && (
          <g>
            {sparkPos.slice(0, sparkN).map(([x, y, r, delay], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill={p.dust} className={cls('bv2-tw')} style={{ animationDelay: `${delay}s` }} />
            ))}
          </g>
        )}

        {/* 중앙 마감 */}
        {s >= 4 ? (
          <g>
            <circle cx="32" cy="32" r="4.5" fill={`url(#${coreId})`} />
            <circle cx="32" cy="32" r="4.5" fill="none" stroke={p.accent} strokeWidth="0.6" opacity="0.7" />
            <circle cx="30.5" cy="30.5" r="1.5" fill={p.c1} opacity="0.95" className={cls('bv2-tw')} />
          </g>
        ) : s >= 2 ? (
          <circle cx="32" cy="32" r="3" fill={p.accent} opacity="0.85" />
        ) : null}
      </g>
    </svg>
  );
}
