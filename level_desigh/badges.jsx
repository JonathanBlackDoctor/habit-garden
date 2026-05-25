// badges.jsx — Three design directions for 30-level badge progression
// Each direction implements the same tier structure (6 tiers × 5 sub-levels).
// Exposed globals: ModernBadge, ClassicBadge, MinimalBadge, TIER_META, tierOf, subOf

const TIER_META = [
  { name: "Bronze",      range: "Lv 1–5",   sub: "Wood / Bronze" },
  { name: "Silver",      range: "Lv 6–10",  sub: "Iron / Silver" },
  { name: "Gold",        range: "Lv 11–15", sub: "Gold" },
  { name: "Platinum",    range: "Lv 16–20", sub: "Platinum + Gem" },
  { name: "Diamond",     range: "Lv 21–25", sub: "Diamond + Crown" },
  { name: "Transcendent",range: "Lv 26–30", sub: "Cosmic / Aura" },
];

const tierOf = (lv) => Math.ceil(lv / 5);
const subOf  = (lv) => ((lv - 1) % 5) + 1;

// ─────────────────────────────────────────────────────────────
// Shared SVG defs — injected once into <body>.
// Gradients/filters referenced by id from every badge instance.
// ─────────────────────────────────────────────────────────────
function BadgeDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        {/* ── Modern Flat ── */}
        <linearGradient id="m-bronze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c89368" />
          <stop offset="1" stopColor="#7d4f2c" />
        </linearGradient>
        <linearGradient id="m-silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6ecf2" />
          <stop offset="1" stopColor="#8d97a4" />
        </linearGradient>
        <linearGradient id="m-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd97a" />
          <stop offset="1" stopColor="#b8862a" />
        </linearGradient>
        <linearGradient id="m-platinum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dde7ef" />
          <stop offset="1" stopColor="#7a8fa3" />
        </linearGradient>
        <linearGradient id="m-diamond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8efff" />
          <stop offset="1" stopColor="#5a8fc7" />
        </linearGradient>
        <linearGradient id="m-cosmic" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8be0" />
          <stop offset=".5" stopColor="#8a6cff" />
          <stop offset="1" stopColor="#3ad6ff" />
        </linearGradient>
        <radialGradient id="m-cosmic-r" cx=".5" cy=".5" r=".55">
          <stop offset="0" stopColor="#fff7ff" />
          <stop offset=".4" stopColor="#c08bff" />
          <stop offset="1" stopColor="#3a1f7a" />
        </radialGradient>

        {/* ── RPG Classic ── (richer metallic gradients) */}
        <linearGradient id="c-bronze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0a070" />
          <stop offset=".5" stopColor="#a06032" />
          <stop offset="1" stopColor="#5a3018" />
        </linearGradient>
        <linearGradient id="c-silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7faff" />
          <stop offset=".45" stopColor="#a8b3c0" />
          <stop offset="1" stopColor="#4d5663" />
        </linearGradient>
        <linearGradient id="c-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset=".45" stopColor="#e0a82a" />
          <stop offset="1" stopColor="#7d4f0e" />
        </linearGradient>
        <linearGradient id="c-platinum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5fbff" />
          <stop offset=".45" stopColor="#b8c8d8" />
          <stop offset="1" stopColor="#4a5a6e" />
        </linearGradient>
        <linearGradient id="c-diamond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfdff" />
          <stop offset=".4" stopColor="#9dd5ff" />
          <stop offset="1" stopColor="#2a4d8a" />
        </linearGradient>
        <radialGradient id="c-cosmic" cx=".5" cy=".4" r=".7">
          <stop offset="0" stopColor="#fff1ff" />
          <stop offset=".3" stopColor="#d68bff" />
          <stop offset=".7" stopColor="#5a2da8" />
          <stop offset="1" stopColor="#1a0838" />
        </radialGradient>
        <radialGradient id="c-ruby" cx=".35" cy=".3" r=".7">
          <stop offset="0" stopColor="#ffc4c4" />
          <stop offset=".5" stopColor="#e02a3a" />
          <stop offset="1" stopColor="#6a0010" />
        </radialGradient>
        <radialGradient id="c-sapphire" cx=".35" cy=".3" r=".7">
          <stop offset="0" stopColor="#b9d8ff" />
          <stop offset=".5" stopColor="#2e6ddb" />
          <stop offset="1" stopColor="#0a1f5a" />
        </radialGradient>
        <radialGradient id="c-diamondGem" cx=".4" cy=".3" r=".7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".5" stopColor="#cdeaff" />
          <stop offset="1" stopColor="#5d8fc7" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// ============================================================
// DIRECTION A — Modern Flat
// Clean silhouettes with subtle gradients; reads well at 24–32px.
// ============================================================

const M_PALETTES = {
  1: { fill: "url(#m-bronze)",   rim: "#5a3a20", accent: "#fff2dc", gem: "#ffb878" },
  2: { fill: "url(#m-silver)",   rim: "#5a6470", accent: "#ffffff", gem: "#7fbfff" },
  3: { fill: "url(#m-gold)",     rim: "#8a5e10", accent: "#fff6c2", gem: "#e94c5f" },
  4: { fill: "url(#m-platinum)", rim: "#3f5266", accent: "#ffffff", gem: "#3a8fff" },
  5: { fill: "url(#m-diamond)",  rim: "#2a4f7a", accent: "#ffffff", gem: "#ffd55a" },
  6: { fill: "url(#m-cosmic)",   rim: "#3a1c7a", accent: "#ffffff", gem: "#ffe97a" },
};

// Tier silhouettes for Modern (return JSX of <path/polygon/etc>)
function ModernSilhouette({ tier, fill, stroke }) {
  switch (tier) {
    case 1: // Bronze disc
      return <circle cx="32" cy="32" r="22" fill={fill} stroke={stroke} strokeWidth="1.5" />;
    case 2: // Silver hexagon
      return <polygon points="32,10 51,21 51,43 32,54 13,43 13,21" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />;
    case 3: // Gold shield
      return <path d="M16 13 Q16 11 18 11 L46 11 Q48 11 48 13 L48 33 Q48 47 32 56 Q16 47 16 33 Z" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />;
    case 4: // Platinum shield + side flares (laurel hints)
      return (
        <>
          <path d="M9 28 Q4 24 7 19 Q10 22 13 24 Z" fill={fill} stroke={stroke} strokeWidth="1" strokeLinejoin="round"/>
          <path d="M55 28 Q60 24 57 19 Q54 22 51 24 Z" fill={fill} stroke={stroke} strokeWidth="1" strokeLinejoin="round"/>
          <path d="M16 14 Q16 12 18 12 L46 12 Q48 12 48 14 L48 33 Q48 47 32 56 Q16 47 16 33 Z" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </>
      );
    case 5: // Diamond shield with crown
      return (
        <>
          {/* crown */}
          <path d="M19 14 L24 9 L28 13 L32 8 L36 13 L40 9 L45 14 L43 18 L21 18 Z" fill={fill} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round"/>
          {/* shield */}
          <path d="M17 19 L47 19 L47 35 Q47 48 32 56 Q17 48 17 35 Z" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </>
      );
    case 6: // Cosmic 8-point burst
      return (
        <>
          {/* outer rays */}
          <path d="M32 4 L34 24 L54 22 L36 32 L54 42 L34 40 L32 60 L30 40 L10 42 L28 32 L10 22 L30 24 Z" fill={fill} stroke={stroke} strokeWidth="0.8" strokeLinejoin="round" opacity="0.95"/>
          <circle cx="32" cy="32" r="11" fill={fill} stroke={stroke} strokeWidth="1"/>
        </>
      );
  }
}

function ModernBadge({ level, size = 32 }) {
  const t = tierOf(level), s = subOf(level);
  const p = M_PALETTES[t];

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "block", overflow: "visible" }}>
      {/* Sub-level 5: outer glow halo */}
      {s >= 5 && (
        <circle cx="32" cy="32" r="30" fill="none" stroke={p.gem} strokeWidth="1.2" opacity="0.45"/>
      )}
      {s >= 5 && (
        <circle cx="32" cy="32" r="27" fill="none" stroke={p.accent} strokeWidth="0.8" opacity="0.6"/>
      )}

      {/* Base silhouette */}
      <ModernSilhouette tier={t} fill={p.fill} stroke={p.rim} />

      {/* Sub-level 2: inner border line */}
      {s >= 2 && t <= 2 && (
        t === 1
          ? <circle cx="32" cy="32" r="17" fill="none" stroke={p.accent} strokeWidth="1" opacity="0.55"/>
          : <polygon points="32,15 47,23 47,41 32,49 17,41 17,23" fill="none" stroke={p.accent} strokeWidth="1" opacity="0.55"/>
      )}
      {s >= 2 && t >= 3 && t <= 5 && (
        <path d={t === 5
          ? "M21 23 L43 23 L43 34 Q43 45 32 52 Q21 45 21 34 Z"
          : "M20 17 L44 17 L44 33 Q44 45 32 53 Q20 45 20 33 Z"}
          fill="none" stroke={p.accent} strokeWidth="1" opacity="0.55"/>
      )}
      {s >= 2 && t === 6 && (
        <circle cx="32" cy="32" r="14.5" fill="none" stroke={p.accent} strokeWidth="0.8" opacity="0.7"/>
      )}

      {/* Sub-level 3: small ornament (star / pip / ribbon) */}
      {s >= 3 && t === 1 && (
        <circle cx="32" cy="32" r="3" fill={p.accent} opacity="0.85"/>
      )}
      {s >= 3 && t === 2 && (
        <path d="M28 41 L32 37 L36 41 L36 47 L32 45 L28 47 Z" fill={p.accent} opacity="0.9"/>
      )}
      {s >= 3 && (t === 3 || t === 4) && (
        <path d="M32 43 L33.5 46 L37 46 L34 48 L35 51 L32 49 L29 51 L30 48 L27 46 L30.5 46 Z" fill={p.accent} opacity="0.95"/>
      )}
      {s >= 3 && t === 5 && (
        // facet lines
        <g stroke={p.accent} strokeWidth="0.7" opacity="0.55" fill="none">
          <path d="M32 19 L25 30 L32 44 L39 30 Z"/>
          <path d="M25 30 L39 30"/>
        </g>
      )}
      {s >= 3 && t === 6 && (
        <>
          <circle cx="50" cy="14" r="1.5" fill={p.accent}/>
          <circle cx="14" cy="50" r="1.5" fill={p.accent}/>
          <circle cx="50" cy="50" r="1.5" fill={p.accent}/>
          <circle cx="14" cy="14" r="1.5" fill={p.accent}/>
        </>
      )}

      {/* Sub-level 4: main center gem/symbol */}
      {s >= 4 && t === 1 && (
        <circle cx="32" cy="32" r="5" fill={p.gem} stroke={p.rim} strokeWidth="0.7"/>
      )}
      {s >= 4 && t === 2 && (
        <polygon points="32,26 37,32 32,38 27,32" fill={p.gem} stroke={p.rim} strokeWidth="0.7"/>
      )}
      {s >= 4 && t === 3 && (
        <circle cx="32" cy="30" r="5" fill={p.gem} stroke="#7a0016" strokeWidth="0.8"/>
      )}
      {s >= 4 && t === 4 && (
        <polygon points="32,23 38,30 32,38 26,30" fill={p.gem} stroke="#08254a" strokeWidth="0.8"/>
      )}
      {s >= 4 && t === 5 && (
        <polygon points="32,25 38,32 32,42 26,32" fill={p.gem} stroke="#7a4d0a" strokeWidth="0.8"/>
      )}
      {s >= 4 && t === 6 && (
        <circle cx="32" cy="32" r="6" fill="url(#m-cosmic-r)"/>
      )}
    </svg>
  );
}

// ============================================================
// DIRECTION B — RPG Classic
// Illustrated, deeper gradients, ribbons + gems + heavier ornament.
// ============================================================

const C_PALETTES = {
  1: { fill: "url(#c-bronze)",   rim: "#3a1f0c", inner: "#8c5530", accent: "#ffd7a8" },
  2: { fill: "url(#c-silver)",   rim: "#2f3742", inner: "#7c8898", accent: "#ffffff" },
  3: { fill: "url(#c-gold)",     rim: "#5a3608", inner: "#c08820", accent: "#fff5b8" },
  4: { fill: "url(#c-platinum)", rim: "#27384a", inner: "#8e9eb3", accent: "#ffffff" },
  5: { fill: "url(#c-diamond)",  rim: "#152c5a", inner: "#6da5d4", accent: "#ffffff" },
  6: { fill: "url(#c-cosmic)",   rim: "#1a0838", inner: "#7a3dc7", accent: "#ffe6ff" },
};

function ClassicSilhouette({ tier, fill, rim }) {
  switch (tier) {
    case 1: // Bronze disc w/ rivets
      return (
        <>
          <circle cx="32" cy="32" r="23" fill={fill} stroke={rim} strokeWidth="2"/>
          <circle cx="32" cy="32" r="19" fill="none" stroke={rim} strokeWidth="0.8" opacity="0.5"/>
        </>
      );
    case 2: // Silver octagon w/ deep border
      return (
        <>
          <polygon points="22,10 42,10 54,22 54,42 42,54 22,54 10,42 10,22" fill={fill} stroke={rim} strokeWidth="2" strokeLinejoin="round"/>
          <polygon points="24,15 40,15 49,24 49,40 40,49 24,49 15,40 15,24" fill="none" stroke={rim} strokeWidth="0.8" opacity="0.5"/>
        </>
      );
    case 3: // Gold heater shield
      return (
        <>
          <path d="M14 13 Q14 10 17 10 L47 10 Q50 10 50 13 L50 33 Q50 49 32 58 Q14 49 14 33 Z" fill={fill} stroke={rim} strokeWidth="2" strokeLinejoin="round"/>
          <path d="M17 14 L47 14 L47 33 Q47 47 32 55 Q17 47 17 33 Z" fill="none" stroke={rim} strokeWidth="0.8" opacity="0.5"/>
        </>
      );
    case 4: // Platinum shield w/ laurel wings
      return (
        <>
          {/* laurel wings */}
          <g fill={fill} stroke={rim} strokeWidth="1" strokeLinejoin="round">
            <ellipse cx="9" cy="22" rx="3" ry="5" transform="rotate(-30 9 22)"/>
            <ellipse cx="6" cy="30" rx="3" ry="5" transform="rotate(-15 6 30)"/>
            <ellipse cx="55" cy="22" rx="3" ry="5" transform="rotate(30 55 22)"/>
            <ellipse cx="58" cy="30" rx="3" ry="5" transform="rotate(15 58 30)"/>
          </g>
          <path d="M14 13 Q14 10 17 10 L47 10 Q50 10 50 13 L50 33 Q50 49 32 58 Q14 49 14 33 Z" fill={fill} stroke={rim} strokeWidth="2" strokeLinejoin="round"/>
        </>
      );
    case 5: // Diamond shield w/ ornate crown
      return (
        <>
          {/* crown band */}
          <rect x="18" y="14" width="28" height="5" fill={fill} stroke={rim} strokeWidth="1" rx="1"/>
          {/* crown spikes w/ gem tips */}
          <path d="M19 14 L21 7 L25 13 L28 5 L32 13 L36 5 L39 13 L43 7 L45 14 Z" fill={fill} stroke={rim} strokeWidth="1.2" strokeLinejoin="round"/>
          <circle cx="21" cy="7" r="1.2" fill="#e94c5f" stroke={rim} strokeWidth="0.5"/>
          <circle cx="32" cy="5" r="1.4" fill="#ffd55a" stroke={rim} strokeWidth="0.5"/>
          <circle cx="43" cy="7" r="1.2" fill="#3a8fff" stroke={rim} strokeWidth="0.5"/>
          {/* shield body */}
          <path d="M17 19 L47 19 L47 34 Q47 49 32 57 Q17 49 17 34 Z" fill={fill} stroke={rim} strokeWidth="2" strokeLinejoin="round"/>
        </>
      );
    case 6: // Cosmic — radiant burst with orb
      return (
        <>
          {/* aura ring */}
          <circle cx="32" cy="32" r="28" fill="none" stroke="#a06cff" strokeWidth="0.8" opacity="0.5"/>
          {/* outer rays */}
          <path d="M32 2 L35 24 L60 22 L38 32 L60 42 L35 40 L32 62 L29 40 L4 42 L26 32 L4 22 L29 24 Z" fill={fill} stroke={rim} strokeWidth="1" strokeLinejoin="round"/>
          {/* orb */}
          <circle cx="32" cy="32" r="12" fill="url(#c-cosmic)" stroke={rim} strokeWidth="1.2"/>
          <circle cx="29" cy="29" r="3" fill="#ffe6ff" opacity="0.7"/>
        </>
      );
  }
}

function ClassicBadge({ level, size = 32 }) {
  const t = tierOf(level), s = subOf(level);
  const p = C_PALETTES[t];

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "block", overflow: "visible" }}>
      {/* Sub-level 5: full glow + radiance */}
      {s >= 5 && (
        <>
          <circle cx="32" cy="32" r="31" fill="none" stroke={p.accent} strokeWidth="0.6" opacity="0.5"/>
          <circle cx="32" cy="32" r="29" fill="none" stroke={p.inner} strokeWidth="0.8" opacity="0.45"/>
          <g stroke={p.accent} strokeWidth="0.8" opacity="0.55">
            <line x1="32" y1="0" x2="32" y2="4"/>
            <line x1="32" y1="60" x2="32" y2="64"/>
            <line x1="0" y1="32" x2="4" y2="32"/>
            <line x1="60" y1="32" x2="64" y2="32"/>
            <line x1="6" y1="6" x2="9" y2="9"/>
            <line x1="58" y1="6" x2="55" y2="9"/>
            <line x1="6" y1="58" x2="9" y2="55"/>
            <line x1="58" y1="58" x2="55" y2="55"/>
          </g>
        </>
      )}

      {/* Base silhouette */}
      <ClassicSilhouette tier={t} fill={p.fill} rim={p.rim} />

      {/* Sub-level 2: engraved pattern on edge */}
      {s >= 2 && t === 1 && (
        <g fill={p.rim} opacity="0.55">
          {[0,60,120,180,240,300].map(a => (
            <circle key={a} cx={32 + 18*Math.cos(a*Math.PI/180)} cy={32 + 18*Math.sin(a*Math.PI/180)} r="0.9"/>
          ))}
        </g>
      )}
      {s >= 2 && t === 2 && (
        <g stroke={p.rim} strokeWidth="0.7" opacity="0.55" fill="none">
          <line x1="22" y1="13" x2="42" y2="13"/>
          <line x1="22" y1="51" x2="42" y2="51"/>
          <line x1="13" y1="22" x2="13" y2="42"/>
          <line x1="51" y1="22" x2="51" y2="42"/>
        </g>
      )}
      {s >= 2 && t === 3 && (
        <path d="M17 14 L47 14 L47 33 Q47 47 32 55 Q17 47 17 33 Z" fill="none" stroke={p.rim} strokeWidth="0.7" opacity="0.6" strokeDasharray="1.5 1.5"/>
      )}
      {s >= 2 && t === 4 && (
        <path d="M17 14 L47 14 L47 33 Q47 47 32 55 Q17 47 17 33 Z" fill="none" stroke={p.accent} strokeWidth="0.7" opacity="0.7" strokeDasharray="2 1.5"/>
      )}
      {s >= 2 && t === 5 && (
        <g stroke={p.accent} strokeWidth="0.6" opacity="0.7" fill="none">
          <path d="M32 19 L25 32 L32 50"/>
          <path d="M32 19 L39 32 L32 50"/>
          <path d="M25 32 L39 32"/>
        </g>
      )}
      {s >= 2 && t === 6 && (
        <circle cx="32" cy="32" r="15.5" fill="none" stroke={p.accent} strokeWidth="0.6" strokeDasharray="1 2" opacity="0.7"/>
      )}

      {/* Sub-level 3: ribbon at bottom OR star */}
      {s >= 3 && t <= 5 && (
        <g>
          <path d="M22 47 L32 51 L42 47 L40 56 L32 53 L24 56 Z" fill={p.fill} stroke={p.rim} strokeWidth="0.8" strokeLinejoin="round"/>
          <path d="M32 51 L32 54" stroke={p.rim} strokeWidth="0.5" opacity="0.6"/>
        </g>
      )}
      {s >= 3 && t === 6 && (
        <g fill={p.accent}>
          <circle cx="52" cy="18" r="1.5"/>
          <circle cx="12" cy="46" r="1.5"/>
          <circle cx="48" cy="48" r="1.2"/>
          <circle cx="16" cy="18" r="1.2"/>
          <circle cx="54" cy="36" r="0.9"/>
          <circle cx="10" cy="30" r="0.9"/>
        </g>
      )}

      {/* Sub-level 4: main center gem */}
      {s >= 4 && t === 1 && (
        <g>
          <circle cx="32" cy="29" r="5.5" fill="url(#c-ruby)" stroke={p.rim} strokeWidth="0.8"/>
          <circle cx="30" cy="27" r="1.3" fill="#ffd9d9" opacity="0.8"/>
        </g>
      )}
      {s >= 4 && t === 2 && (
        <g>
          <polygon points="32,22 39,30 32,40 25,30" fill="url(#c-sapphire)" stroke={p.rim} strokeWidth="0.8"/>
          <polygon points="32,22 35,28 32,32 29,28" fill="#cfe1ff" opacity="0.7"/>
        </g>
      )}
      {s >= 4 && t === 3 && (
        <g>
          <circle cx="32" cy="28" r="6" fill="url(#c-ruby)" stroke={p.rim} strokeWidth="0.9"/>
          <circle cx="29.5" cy="25.5" r="1.5" fill="#ffe4e4" opacity="0.85"/>
        </g>
      )}
      {s >= 4 && t === 4 && (
        <g>
          <polygon points="32,21 39,29 32,40 25,29" fill="url(#c-sapphire)" stroke={p.rim} strokeWidth="0.9"/>
          <polygon points="32,21 35,27 32,31 29,27" fill="#d0e2ff" opacity="0.8"/>
        </g>
      )}
      {s >= 4 && t === 5 && (
        <g>
          <polygon points="32,24 40,32 32,46 24,32" fill="url(#c-diamondGem)" stroke={p.rim} strokeWidth="0.9"/>
          <polygon points="32,24 36,30 32,33 28,30" fill="#ffffff" opacity="0.9"/>
          <line x1="24" y1="32" x2="40" y2="32" stroke={p.rim} strokeWidth="0.5" opacity="0.5"/>
        </g>
      )}
      {s >= 4 && t === 6 && (
        <>
          <circle cx="32" cy="32" r="7" fill="url(#c-cosmic)" stroke={p.accent} strokeWidth="0.8"/>
          <circle cx="29" cy="29" r="2" fill="#ffffff" opacity="0.85"/>
        </>
      )}
    </svg>
  );
}

// ============================================================
// DIRECTION C — Minimal Geometric
// Flat single-color shapes; sub-level shown as count of accent pips.
// ============================================================

const X_PALETTES = {
  1: { fill: "#9b6f4d", pip: "#3a2410" },   // earth brown
  2: { fill: "#8a96a4", pip: "#2a323e" },   // cool gray
  3: { fill: "#e6a635", pip: "#5a3a0c" },   // gold
  4: { fill: "#d05545", pip: "#3a0e08" },   // ember
  5: { fill: "#5687c4", pip: "#0d2848" },   // cobalt
  6: { fill: "#7e5cd6", pip: "#220a4a" },   // ultraviolet
};

function MinimalSilhouette({ tier, fill }) {
  switch (tier) {
    case 1: return <circle cx="32" cy="32" r="20" fill={fill}/>;
    case 2: return <rect x="12" y="12" width="40" height="40" rx="9" fill={fill}/>;
    case 3: return <polygon points="32,8 52,20 52,44 32,56 12,44 12,20" fill={fill}/>;
    case 4: return <polygon points="32,8 54,22 46,50 18,50 10,22" fill={fill}/>;
    case 5: return <path d="M14 12 L50 12 L54 32 L32 56 L10 32 Z" fill={fill}/>;
    case 6: return (
      <path d="M32 6 L38 22 L56 22 L42 32 L48 50 L32 40 L16 50 L22 32 L8 22 L26 22 Z" fill={fill}/>
    );
  }
}

function MinimalBadge({ level, size = 32 }) {
  const t = tierOf(level), s = subOf(level);
  const p = X_PALETTES[t];

  // pip positions inside shape based on tier center
  const centers = {
    1: { cx: 32, cy: 36, dx: 5 },
    2: { cx: 32, cy: 36, dx: 5 },
    3: { cx: 32, cy: 38, dx: 5 },
    4: { cx: 32, cy: 36, dx: 5 },
    5: { cx: 32, cy: 30, dx: 5 },
    6: { cx: 32, cy: 32, dx: 5 },
  };
  const c = centers[t];
  // pip layout for sub-level: 1=nothing, 2=•, 3=••, 4=•••, 5=★(or filled bar)
  const pips = [];
  const pipCount = Math.max(0, s - 1); // 0..4
  if (pipCount > 0 && pipCount < 4) {
    const total = pipCount;
    const start = c.cx - (total - 1) * c.dx / 2;
    for (let i = 0; i < total; i++) {
      pips.push(<circle key={i} cx={start + i * c.dx} cy={c.cy} r="1.6" fill={p.pip}/>);
    }
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "block", overflow: "visible" }}>
      {/* sub 5: outer ring (the “evolved” mark within tier) */}
      {s >= 5 && (
        <MinimalSilhouette tier={t} fill={"none"} />
      )}
      {s >= 5 && (
        <g>
          <MinimalRing tier={t} stroke={p.fill} />
        </g>
      )}
      <MinimalSilhouette tier={t} fill={p.fill}/>
      {pipCount === 4 && (
        // star mark at sub-level 5 (instead of 4 pips)
        <g>
          <path d={`M ${c.cx} ${c.cy - 4} L ${c.cx + 1.5} ${c.cy - 1} L ${c.cx + 4.5} ${c.cy - 1} L ${c.cx + 2} ${c.cy + 1} L ${c.cx + 3} ${c.cy + 4} L ${c.cx} ${c.cy + 2.2} L ${c.cx - 3} ${c.cy + 4} L ${c.cx - 2} ${c.cy + 1} L ${c.cx - 4.5} ${c.cy - 1} L ${c.cx - 1.5} ${c.cy - 1} Z`}
                fill={p.pip}/>
        </g>
      )}
      {pips}
    </svg>
  );
}

function MinimalRing({ tier, stroke }) {
  // Outline-only echo of the silhouette, slightly larger.
  switch (tier) {
    case 1: return <circle cx="32" cy="32" r="25" fill="none" stroke={stroke} strokeWidth="1.4" opacity="0.45"/>;
    case 2: return <rect x="7" y="7" width="50" height="50" rx="12" fill="none" stroke={stroke} strokeWidth="1.4" opacity="0.45"/>;
    case 3: return <polygon points="32,3 56,17 56,47 32,61 8,47 8,17" fill="none" stroke={stroke} strokeWidth="1.4" opacity="0.45"/>;
    case 4: return <polygon points="32,3 59,19 50,55 14,55 5,19" fill="none" stroke={stroke} strokeWidth="1.4" opacity="0.45"/>;
    case 5: return <path d="M11 7 L53 7 L58 32 L32 61 L6 32 Z" fill="none" stroke={stroke} strokeWidth="1.4" opacity="0.45"/>;
    case 6: return <path d="M32 1 L39 19 L58 19 L43 31 L49 51 L32 40 L15 51 L21 31 L6 19 L25 19 Z" fill="none" stroke={stroke} strokeWidth="1.4" opacity="0.45"/>;
  }
}

Object.assign(window, {
  BadgeDefs,
  ModernBadge, ClassicBadge, MinimalBadge,
  TIER_META, tierOf, subOf,
});
