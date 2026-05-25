// badges-v2.jsx — Soft, ethereal badge directions
// 4 directions, 6 tiers × 5 sub-levels, palette inspired by legendary/transcendent
// plants: soft radial gradients (white → pastel → deep), subtle halos, sparkle dots.
//
// Exposed globals:
//   BloomBadge, HaloBadge, CrystalBadge, OrbitBadge
//   SOFT_TIERS, tierOf, subOf, BadgeDefsV2

const tierOf = (lv) => Math.ceil(lv / 5);
const subOf  = (lv) => ((lv - 1) % 5) + 1;

// ─────────────────────────────────────────────────────────────
// 6 soft tier palettes. Color philosophy matches the user's plant codebase:
// white core → soft mid → deeper edge. Each tier shifts hue.
// ─────────────────────────────────────────────────────────────
const SOFT_TIERS = [
  { id:1, name:'Pearl Mist',    range:'Lv 1–5',
    c1:'#FFFFFF', c2:'#E5ECF0', c3:'#A8B8C0',
    petal:'#D8E2E8', accent:'#FFFFFF', gem:'#9CB0BC',
    glow:'#C8D8E0', dust:'#FFFFFF' },
  { id:2, name:'Rose Blush',    range:'Lv 6–10',
    c1:'#FFFFFF', c2:'#FFD8E2', c3:'#E89AB0',
    petal:'#FFCBD8', accent:'#FFE8F0', gem:'#E68AA8',
    glow:'#FFB0C8', dust:'#FFFFFF' },
  { id:3, name:'Golden Honey',  range:'Lv 11–15',
    c1:'#FFFFFF', c2:'#FFE89A', c3:'#E8B23A',
    petal:'#FFD97A', accent:'#FFF6C8', gem:'#E8A82A',
    glow:'#FFD24A', dust:'#FFF3C0' },
  { id:4, name:'Coral Dawn',    range:'Lv 16–20',
    c1:'#FFFFFF', c2:'#FFD7BC', c3:'#FF9E7A',
    petal:'#FFBC9A', accent:'#FFE8D8', gem:'#F2728C',
    glow:'#FF9E7A', dust:'#FFE3D0' },
  { id:5, name:'Amethyst',      range:'Lv 21–25',
    c1:'#FFFFFF', c2:'#E0D0FF', c3:'#9A7BFF',
    petal:'#C8B0FF', accent:'#F0E8FF', gem:'#7A5DD8',
    glow:'#9A7BFF', dust:'#F0E8FF' },
  { id:6, name:'Aurora',        range:'Lv 26–30',
    c1:'#FFFFFF', c2:'#C9A0FF', c3:'#3E3E7A',
    petal:'#A98CFF', accent:'#FFFFFF', gem:'#6A78D8',
    glow:'#C9A0FF', dust:'#FFFFFF' },
];

// ─────────────────────────────────────────────────────────────
// Shared <defs> — gradients/filters referenced by every badge.
// One global instance is mounted into the document via <BadgeDefsV2/>.
// IDs are tier-scoped: e.g.  bv2-core-3  for tier 3 radial core gradient.
// ─────────────────────────────────────────────────────────────
function BadgeDefsV2() {
  return (
    <svg width="0" height="0" style={{ position:'absolute' }} aria-hidden="true">
      <defs>
        {SOFT_TIERS.map(p => (
          <React.Fragment key={p.id}>
            <radialGradient id={`bv2-core-${p.id}`} cx="42%" cy="38%" r="65%">
              <stop offset="0%"  stopColor={p.c1}/>
              <stop offset="45%" stopColor={p.c2}/>
              <stop offset="100%" stopColor={p.c3}/>
            </radialGradient>
            <radialGradient id={`bv2-petal-${p.id}`} cx="50%" cy="35%" r="70%">
              <stop offset="0%"  stopColor={p.accent}/>
              <stop offset="60%" stopColor={p.petal}/>
              <stop offset="100%" stopColor={p.c3}/>
            </radialGradient>
            <radialGradient id={`bv2-halo-${p.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor={p.glow} stopOpacity="0.55"/>
              <stop offset="70%" stopColor={p.glow} stopOpacity="0.10"/>
              <stop offset="100%" stopColor={p.glow} stopOpacity="0"/>
            </radialGradient>
            <linearGradient id={`bv2-facet-${p.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"  stopColor={p.accent}/>
              <stop offset="50%" stopColor={p.petal}/>
              <stop offset="100%" stopColor={p.c3}/>
            </linearGradient>
          </React.Fragment>
        ))}
      </defs>

      {/* Soft CSS animations — slow rotation for halo, gentle pulse for cores. */}
      <style>{`
        @keyframes bv2-rot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bv2-rot-rev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes bv2-pulse { 0%,100% { opacity: 0.85; } 50% { opacity: 0.45; } }
        @keyframes bv2-twinkle { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        .bv2-rot   { animation: bv2-rot 28s linear infinite; transform-origin: 32px 32px; transform-box: fill-box; }
        .bv2-rot-r { animation: bv2-rot-rev 38s linear infinite; transform-origin: 32px 32px; transform-box: fill-box; }
        .bv2-halo  { animation: bv2-pulse 3.6s ease-in-out infinite; }
        .bv2-tw    { animation: bv2-twinkle 2.4s ease-in-out infinite; }

        /* ── Bloom direction ── */
        @keyframes bv2-bl-spin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bv2-bl-spinR  { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes bv2-bl-breath { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes bv2-bl-core   { 0%,100% { transform: scale(1); opacity: .55; } 50% { transform: scale(1.18); opacity: .9; } }
        @keyframes bv2-bl-sway   { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        @keyframes bv2-bl-bloom  {
          0%   { transform: scale(0.25) rotate(-40deg); opacity: 0; }
          55%  { transform: scale(1.12) rotate(8deg);   opacity: 1; }
          80%  { transform: scale(0.97) rotate(-2deg);  opacity: 1; }
          100% { transform: scale(1) rotate(0deg);       opacity: 1; }
        }
        @keyframes bv2-bl-burst  {
          0%   { transform: scale(0); opacity: 1; }
          80%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .bv2-bl-spin   { animation: bv2-bl-spin   var(--speed,60s) linear infinite;
                         transform-origin: 32px 32px; transform-box: fill-box; }
        .bv2-bl-spinR  { animation: bv2-bl-spinR  var(--speed,80s) linear infinite;
                         transform-origin: 32px 32px; transform-box: fill-box; }
        .bv2-bl-breath { animation: bv2-bl-breath var(--breathe,4.5s) ease-in-out infinite;
                         transform-origin: 32px 32px; transform-box: fill-box; }
        .bv2-bl-sway   { animation: bv2-bl-sway   var(--sway,6s) ease-in-out infinite;
                         transform-origin: 32px 32px; transform-box: fill-box; }
        .bv2-bl-core   { animation: bv2-bl-core 3.2s ease-in-out infinite;
                         transform-origin: 32px 32px; transform-box: fill-box; }
        .bv2-bl-bloom  { animation: bv2-bl-bloom 0.95s cubic-bezier(.2,.7,.3,1.2) both;
                         transform-origin: 32px 32px; transform-box: fill-box; }
        .bv2-bl-burst  { animation: bv2-bl-burst 0.9s ease-out both;
                         transform-origin: 32px 32px; transform-box: fill-box; }

        @media (prefers-reduced-motion: reduce) {
          .bv2-rot, .bv2-rot-r, .bv2-halo, .bv2-tw,
          .bv2-bl-spin, .bv2-bl-spinR, .bv2-bl-breath, .bv2-bl-sway,
          .bv2-bl-core, .bv2-bl-bloom, .bv2-bl-burst {
            animation: none !important;
          }
        }
      `}</style>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────
function SoftHalo({ tier, sub }) {
  if (sub < 5) return null;
  return (
    <>
      <circle cx="32" cy="32" r="30" fill={`url(#bv2-halo-${tier})`} className="bv2-halo"/>
      <circle cx="32" cy="32" r="28" fill="none" stroke={SOFT_TIERS[tier-1].glow} strokeWidth="0.5" opacity="0.4"/>
    </>
  );
}

function SparkleDots({ tier, sub, positions }) {
  if (sub < 3) return null;
  const dust = SOFT_TIERS[tier-1].dust;
  // sub3 = 2 dots, sub4 = 4 dots, sub5 = all 5
  const n = sub === 3 ? 2 : sub === 4 ? 4 : positions.length;
  const visible = positions.slice(0, n);
  return (
    <g>
      {visible.map(([x,y,r=1.1,delay=0], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={dust} className="bv2-tw"
                style={{ animationDelay: `${delay}s` }}/>
      ))}
    </g>
  );
}

// ============================================================
// DIRECTION 1 — BLOOM (꽃잎)  · ANIMATED  · STAGED GROWTH
// Within each tier, sub-levels visibly evolve:
//   1 = bud (closed)
//   2 = half-bloom (small petals)
//   3 = full-bloom (full petals + small leaves)
//   4 = + center gem + inner petal ring
//   5 = + halo + dust orbit + outer crown
// Across tiers, petal count + complexity grow.
// ============================================================
const BLOOM_PETALS = [
  // n: petal count, rx/ry: petal size, cy: distance from center, op: opacity
  // n2: inner-ring petal count (0 = none)
  { n:5,  rx:5.5, ry:9.5, cy:14, op:0.92, n2:0  },   // T1 — daisy
  { n:6,  rx:5.0, ry:10,  cy:14, op:0.92, n2:0  },   // T2 — rosette
  { n:8,  rx:4.2, ry:10,  cy:14, op:0.92, n2:0  },   // T3 — sunflower
  { n:6,  rx:5.2, ry:11,  cy:13, op:0.92, n2:6  },   // T4 — lily
  { n:8,  rx:4.6, ry:10.5,cy:14, op:0.92, n2:8  },   // T5 — peony
  { n:12, rx:3.5, ry:10.5,cy:14, op:0.92, n2:8  },   // T6 — chrysanthemum (now with inner ring too)
];

// Per-tier motion intensity. Higher tiers move a bit more.
const BLOOM_MOTION = [
  { spin: 90, breathe: 6.0, sway: 7.5 },  // T1 — barely visible
  { spin: 75, breathe: 5.5, sway: 7.0 },  // T2
  { spin: 60, breathe: 5.0, sway: 6.0 },  // T3
  { spin: 50, breathe: 4.5, sway: 5.5 },  // T4
  { spin: 40, breathe: 4.0, sway: 5.0 },  // T5
  { spin: 28, breathe: 3.4, sway: 4.5 },  // T6 — most alive
];

// Per-sub-level visible scale of petals. Makes the bloom literally open.
//   sub1 closed bud, sub5 fully open.
const SUB_PETAL_SCALE = [0.35, 0.65, 1.0, 1.0, 1.05];
const SUB_PETAL_OPACITY = [0.78, 0.92, 0.95, 0.95, 1.0];

function BloomBadge({ level, size = 32, burstKey, motion = true }) {
  const t = tierOf(level), s = subOf(level);
  const p = SOFT_TIERS[t-1];
  const cfg = BLOOM_PETALS[t-1];
  const m = BLOOM_MOTION[t-1];
  const petalScale = SUB_PETAL_SCALE[s-1];
  const petalOp = SUB_PETAL_OPACITY[s-1];

  // ── sub1: BUD ─────────────────────────────────────────────
  // A closed bud silhouette — 3 inward-pointing petals.
  // Visually unambiguously the smallest, "not yet bloomed" state.
  const Bud = (
    <g>
      {/* leaf / sepal */}
      <path d="M22 40 Q26 44 32 42 Q38 44 42 40 Q40 36 32 36 Q24 36 22 40 Z"
            fill={p.c3} opacity="0.55"/>
      {/* bud body — 3 closed petals */}
      <g>
        {[ -16, 0, 16 ].map((deg, i) => (
          <path key={i}
                d="M32 14 Q26 22 28 32 Q32 36 36 32 Q38 22 32 14 Z"
                fill={`url(#bv2-petal-${t})`} opacity={petalOp}
                transform={`rotate(${deg} 32 36)`}/>
        ))}
      </g>
      {/* highlight */}
      <ellipse cx="30" cy="20" rx="1.5" ry="3" fill={p.c1} opacity="0.6"/>
    </g>
  );

  // ── sub2+: open petals (count from tier; size from sub-level) ─
  const cy = 32 - (cfg.ry * petalScale) - 4;
  const petals = [];
  for (let i = 0; i < cfg.n; i++) {
    const deg = (360 / cfg.n) * i;
    petals.push(
      <ellipse key={`o${i}`} cx="32" cy={cy}
               rx={cfg.rx * petalScale} ry={cfg.ry * petalScale}
               fill={`url(#bv2-petal-${t})`} opacity={petalOp}
               transform={`rotate(${deg} 32 32)`}/>
    );
  }

  // ── sub4+: inner ring (or appear at s4 for tiers without n2) ──
  const innerPetals = [];
  const showInner = s >= 4 && (cfg.n2 > 0 || true);
  if (showInner) {
    const innerCount = cfg.n2 || cfg.n;
    const innerScale = (s >= 5 ? 0.78 : 0.7) * petalScale;
    const offset = 360 / innerCount / 2;
    const iry = (cfg.ry * innerScale);
    const icy = 32 - iry - 2;
    for (let i = 0; i < innerCount; i++) {
      const deg = (360 / innerCount) * i + offset;
      innerPetals.push(
        <ellipse key={`i${i}`} cx="32" cy={icy}
                 rx={cfg.rx * innerScale} ry={iry}
                 fill={`url(#bv2-petal-${t})`} opacity="0.85"
                 transform={`rotate(${deg} 32 32)`}/>
      );
    }
  }

  // ── sub3+: small leaves around the flower (outer ring accent) ─
  const leaves = [];
  if (s >= 3) {
    // 2 small leaves at south for s3, 4 for s4, 6 for s5
    const count = s === 3 ? 2 : s === 4 ? 4 : 6;
    for (let i = 0; i < count; i++) {
      const deg = -90 + (360 / count) * i;
      const rad = deg * Math.PI / 180;
      const R = 24;
      leaves.push(
        <ellipse key={i}
                 cx={32 + R * Math.cos(rad)}
                 cy={32 + R * Math.sin(rad)}
                 rx="2" ry="3.5"
                 fill={p.c3} opacity="0.55"
                 transform={`rotate(${deg + 90} ${32 + R * Math.cos(rad)} ${32 + R * Math.sin(rad)})`}/>
      );
    }
  }

  // ── sub5: outer crown ring + extra dust orbit ─────────────────
  const dustOrbit = [];
  if (s >= 5) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const deg = (360 / count) * i;
      const rad = deg * Math.PI / 180;
      dustOrbit.push(
        <circle key={i} cx={32 + 27 * Math.cos(rad)} cy={32 + 27 * Math.sin(rad)}
                r={1.1} fill={p.dust} opacity="0.85"/>
      );
    }
  }

  // ── small twinkles (sub3+) ────────────────────────────────────
  const sparkPos = [[12,18,1.2,0], [52,18,1.2,0.3], [32,52,1.1,0.6], [8,38,1.0,0.9], [56,38,1.0,1.2]];

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display:'block', overflow:'visible' }}>
      <g key={burstKey} className={motion ? "bv2-bl-bloom" : undefined}>
        <SoftHalo tier={t} sub={s}/>

        {/* sub5 dust orbit, counter-rotates */}
        {dustOrbit.length > 0 && (
          <g className={motion ? "bv2-bl-spinR" : undefined} style={{'--speed': `${m.spin * 1.4}s`}}>
            {dustOrbit}
          </g>
        )}

        {/* sub3+ outer leaves */}
        {leaves.length > 0 && (
          <g className={motion ? "bv2-bl-spin" : undefined} style={{'--speed': `${m.spin * 2}s`}}>
            {leaves}
          </g>
        )}

        {/* faint base glow center */}
        <circle cx="32" cy="32" r="6" fill={`url(#bv2-core-${t})`} opacity="0.45"
                className={motion ? "bv2-bl-core" : undefined}/>

        {/* main bloom: bud at sub1, petals from sub2+ */}
        {s === 1 ? (
          <g className={motion ? "bv2-bl-breath" : undefined} style={{'--breathe': `${m.breathe}s`}}>
            {Bud}
          </g>
        ) : (
          <g className={motion ? "bv2-bl-spin" : undefined} style={{'--speed': `${m.spin}s`}}>
            <g className={motion ? "bv2-bl-breath" : undefined} style={{'--breathe': `${m.breathe}s`}}>
              {petals}
            </g>
          </g>
        )}

        {/* sub4+: inner counter-rotating petal ring */}
        {innerPetals.length > 0 && (
          <g className={motion ? "bv2-bl-spinR" : undefined} style={{'--speed': `${m.spin * 0.7}s`}}>
            <g className={motion ? "bv2-bl-breath" : undefined} style={{'--breathe': `${m.breathe * 0.85}s`}}>
              {innerPetals}
            </g>
          </g>
        )}

        {/* sparkles */}
        <SparkleDots tier={t} sub={s} positions={sparkPos}/>

        {/* center finish */}
        {s >= 4 ? (
          <g>
            <circle cx="32" cy="32" r="4.5" fill={`url(#bv2-core-${t})`}/>
            <circle cx="32" cy="32" r="4.5" fill="none" stroke={p.accent} strokeWidth="0.6" opacity="0.7"/>
            <circle cx="30.5" cy="30.5" r="1.5" fill={p.c1} opacity="0.95"
                    className={motion ? "bv2-tw" : undefined}/>
          </g>
        ) : s >= 2 ? (
          <circle cx="32" cy="32" r="3" fill={p.accent} opacity="0.85"/>
        ) : null}
      </g>
    </svg>
  );
}

// ============================================================
// DIRECTION 2 — HALO (후광 / 햇무리)
// Soft orb at center with subtle radiating rays.
// ============================================================
const HALO_RAYS = [
  // tier → ray count
  { rays:0,  rings:0 },                // T1 — pure orb, no rays
  { rays:4,  rings:0 },                // T2
  { rays:8,  rings:0 },                // T3
  { rays:8,  rings:1 },                // T4 — + ring
  { rays:12, rings:1 },                // T5
  { rays:12, rings:2 },                // T6 — two counter-rotating ray sets
];

function HaloBadge({ level, size = 32 }) {
  const t = tierOf(level), s = subOf(level);
  const p = SOFT_TIERS[t-1];
  const cfg = HALO_RAYS[t-1];

  const sparkPos = [[14,16,1.0,0], [50,16,1.0,0.4], [50,48,1.0,0.8], [14,48,1.0,1.2], [32,8,0.9,0.6]];

  // Build rays
  const rayLines = [];
  for (let i = 0; i < cfg.rays; i++) {
    const deg = (360 / cfg.rays) * i;
    rayLines.push(
      <line key={i} x1="32" y1="9" x2="32" y2="3"
            stroke={p.glow} strokeWidth="1.2" strokeLinecap="round" opacity="0.7"
            transform={`rotate(${deg} 32 32)`}/>
    );
  }
  // Second offset ray set for T6
  const ray2 = [];
  if (cfg.rings === 2) {
    const off = 360 / cfg.rays / 2;
    for (let i = 0; i < cfg.rays; i++) {
      const deg = (360 / cfg.rays) * i + off;
      ray2.push(
        <line key={i} x1="32" y1="11" x2="32" y2="6"
              stroke={p.accent} strokeWidth="0.9" strokeLinecap="round" opacity="0.5"
              transform={`rotate(${deg} 32 32)`}/>
      );
    }
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display:'block', overflow:'visible' }}>
      <SoftHalo tier={t} sub={s}/>

      {/* Sub 2+: tier rays (slowly rotating) */}
      {s >= 2 && cfg.rays > 0 && (
        <g className="bv2-rot">{rayLines}</g>
      )}
      {s >= 2 && cfg.rings === 2 && (
        <g className="bv2-rot-r">{ray2}</g>
      )}

      {/* Sub 2+: outer ring */}
      {s >= 2 && cfg.rings >= 1 && (
        <circle cx="32" cy="32" r="16" fill="none" stroke={p.accent} strokeWidth="0.7" opacity="0.55"/>
      )}

      {/* Core orb — always present */}
      <circle cx="32" cy="32" r={s >= 4 ? 10 : 8} fill={`url(#bv2-core-${t})`}/>

      {/* Sub 3+: sparkle dust */}
      <SparkleDots tier={t} sub={s} positions={sparkPos}/>

      {/* Sub 4+: inner gem highlight (4-point star) */}
      {s >= 4 && (
        <path d="M32 26 L33.4 30.6 L38 32 L33.4 33.4 L32 38 L30.6 33.4 L26 32 L30.6 30.6 Z"
              fill={p.accent} opacity="0.85" className="bv2-tw"/>
      )}
      {s < 4 && (
        <circle cx="30.5" cy="30.5" r="1.6" fill={p.c1} opacity="0.85"/>
      )}
    </svg>
  );
}

// ============================================================
// DIRECTION 3 — CRYSTAL (수정 / 보석)
// Faceted gem silhouette. Tier varies gem cut.
// ============================================================
const CRYSTAL_SHAPES = [
  // T1 — soft round cabochon
  { path:'M20 32 Q20 16 32 16 Q44 16 44 32 Q44 48 32 48 Q20 48 20 32 Z',
    facets:[] },
  // T2 — oval cushion
  { path:'M18 32 Q18 14 32 14 Q46 14 46 32 Q46 50 32 50 Q18 50 18 32 Z',
    facets:['M22 24 Q32 18 42 24'] },
  // T3 — marquise (pointed oval)
  { path:'M32 10 Q46 22 32 54 Q18 22 32 10 Z',
    facets:['M32 10 L32 54', 'M20 28 L44 28'] },
  // T4 — pear/teardrop
  { path:'M32 8 Q46 18 46 36 Q46 52 32 54 Q18 52 18 36 Q18 18 32 8 Z',
    facets:['M32 8 L32 54', 'M22 24 L42 24', 'M22 40 L42 40'] },
  // T5 — diamond brilliant cut
  { path:'M32 10 L50 24 L42 50 L22 50 L14 24 Z',
    facets:['M32 10 L32 50', 'M14 24 L50 24', 'M32 24 L22 50', 'M32 24 L42 50'] },
  // T6 — multi-facet aurora gem (elongated hex)
  { path:'M32 6 L52 18 L52 38 L32 56 L12 38 L12 18 Z',
    facets:['M32 6 L32 56', 'M12 18 L52 38', 'M52 18 L12 38', 'M12 28 L52 28'] },
];

function CrystalBadge({ level, size = 32 }) {
  const t = tierOf(level), s = subOf(level);
  const p = SOFT_TIERS[t-1];
  const shape = CRYSTAL_SHAPES[t-1];

  const sparkPos = [[12,14,1.1,0], [52,14,1.1,0.4], [12,50,0.9,0.8], [52,50,0.9,1.2], [32,4,0.9,1.6]];

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display:'block', overflow:'visible' }}>
      <SoftHalo tier={t} sub={s}/>

      {/* Base gem silhouette — always */}
      <path d={shape.path} fill={`url(#bv2-facet-${t})`} stroke={p.gem} strokeWidth="0.8" strokeLinejoin="round" opacity="0.95"/>

      {/* Sub 2+: facet lines (inner geometry) */}
      {s >= 2 && shape.facets.length > 0 && (
        <g stroke={p.accent} strokeWidth="0.6" opacity="0.55" fill="none" strokeLinecap="round">
          {shape.facets.map((d, i) => <path key={i} d={d}/>)}
        </g>
      )}

      {/* Sub 3+: sparkle dust around */}
      <SparkleDots tier={t} sub={s} positions={sparkPos}/>

      {/* Sub 4+: inner highlight glow */}
      {s >= 4 && (
        <>
          <ellipse cx="28" cy="24" rx="6" ry="9" fill={p.c1} opacity="0.55"/>
          <circle cx="26" cy="20" r="2" fill={p.c1} opacity="0.85" className="bv2-tw"/>
        </>
      )}
      {s < 4 && (
        <ellipse cx="28" cy="22" rx="4" ry="6" fill={p.c1} opacity="0.4"/>
      )}
    </svg>
  );
}

// ============================================================
// DIRECTION 4 — ORBIT (궤도 / 천체)
// Central glowing orb with orbiting particle rings.
// ============================================================
const ORBIT_RINGS = [
  // [outer-particles, inner-particles, double-ring?]
  { outer:0,  inner:0,  rings:0 },   // T1 — just orb
  { outer:3,  inner:0,  rings:1 },   // T2 — 1 orbit, 3 motes
  { outer:5,  inner:0,  rings:1 },   // T3 — denser
  { outer:6,  inner:3,  rings:2 },   // T4 — double ring
  { outer:8,  inner:4,  rings:2 },   // T5
  { outer:10, inner:6,  rings:2 },   // T6 — galaxy
];

function moteRing(n, R, color, size = 1.4, opacity = 0.9) {
  if (n === 0) return null;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const rad = (360 / n) * i * Math.PI / 180;
    pts.push(<circle key={i} cx={32 + R*Math.cos(rad)} cy={32 + R*Math.sin(rad)} r={size} fill={color} opacity={opacity}/>);
  }
  return pts;
}

function OrbitBadge({ level, size = 32 }) {
  const t = tierOf(level), s = subOf(level);
  const p = SOFT_TIERS[t-1];
  const cfg = ORBIT_RINGS[t-1];

  const sparkPos = [[10,12,1.0,0], [54,12,1.0,0.4], [54,52,1.0,0.8], [10,52,1.0,1.2]];

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display:'block', overflow:'visible' }}>
      <SoftHalo tier={t} sub={s}/>

      {/* Sub 2+: outer orbit ring (line) */}
      {s >= 2 && cfg.rings >= 1 && (
        <ellipse cx="32" cy="32" rx="22" ry="22" fill="none" stroke={p.glow} strokeWidth="0.6" opacity="0.5"/>
      )}
      {s >= 2 && cfg.rings >= 2 && (
        <ellipse cx="32" cy="32" rx="14" ry="14" fill="none" stroke={p.accent} strokeWidth="0.5" opacity="0.55"/>
      )}

      {/* Sub 2+: outer particles, slow rotation */}
      {s >= 2 && cfg.outer > 0 && (
        <g className="bv2-rot">{moteRing(cfg.outer, 22, p.glow, 1.5, 0.9)}</g>
      )}
      {s >= 3 && cfg.inner > 0 && (
        <g className="bv2-rot-r">{moteRing(cfg.inner, 14, p.accent, 1.1, 0.85)}</g>
      )}

      {/* Core orb — always present */}
      <circle cx="32" cy="32" r={s >= 4 ? 9 : 7} fill={`url(#bv2-core-${t})`}/>
      <circle cx="30" cy="30" r={s >= 4 ? 2 : 1.4} fill={p.c1} opacity="0.85" className="bv2-tw"/>

      {/* Sub 3+: outer sparkles */}
      <SparkleDots tier={t} sub={s} positions={sparkPos}/>

      {/* Sub 4+: extra ring tick marks */}
      {s >= 4 && cfg.outer > 0 && (
        <g opacity="0.5">
          {moteRing(4, 26, p.accent, 0.7, 0.7)}
        </g>
      )}
    </svg>
  );
}

// Expose
Object.assign(window, {
  BadgeDefsV2,
  BloomBadge, HaloBadge, CrystalBadge, OrbitBadge,
  SOFT_TIERS, tierOf, subOf,
});
