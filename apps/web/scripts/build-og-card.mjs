/**
 * build-og-card.mjs — "습관 정원" OG 카드(1200×630) 시안 생성기
 *
 * 글자 없이, 앱 정원 화면(Garden.tsx)의 레이아웃을 그대로 재현한다:
 *  - 페이지 배경(--bg-base) 위에 둥근 정원 패널(하늘 그라데이션 sky-top→sky-bottom→leaf-soft)
 *  - 우상단 햇살(--garden-sun) · 원경 언덕 2겹(--garden-hill) · 하단 흙 띠 · 떠다니는 빛 입자 · 비네트
 *  - 계단식 화단: 한 화단 8그루 = 2줄 × 4 (PLANTS_PER_ROW=4). 뒤 줄은 축소·반투명·겹침(원근).
 *  - 식물 모티프는 PlantSVG.tsx 와 동일 종(초월: 천상수·은하백합·영겁화 / 전설: 생명나무·황금모란·수정장미·별빛백합·오로라난초)
 *
 * 정적 PNG 렌더러(resvg/sharp) 호환을 위해 color-mix 대신 hex 를 미리 계산한다.
 *
 *   node apps/web/scripts/build-og-card.mjs            # apps/web/public/og-card.svg 생성
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/og-card.svg');

// ── 색 유틸 (color-mix 대체) ──────────────────────────────
const hex = (h) => {
  const n = h.replace('#', '');
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
};
const toHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, p) => {
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b);
  const t = p / 100;
  return toHex([ar * t + br * (1 - t), ag * t + bg * (1 - t), ab * t + bb * (1 - t)]);
};
const lighten = (c, p) => mix(c, '#ffffff', 100 - p);
const darken = (c, p) => mix(c, '#000000', 100 - p);

// ── 디자인 토큰 (index.css) ───────────────────────────────
const T = {
  bgBase: '#F4F6EE', leaf: '#4F7A37', leafSoft: '#E7F0DD', soil: '#8A6E4B',
  skyTop: '#CDEBF6', skyBottom: '#EAF6DA', sun: '#FFF1C2', hill: '#BFE0A0',
  soilTop: '#A98559', soilBottom: '#7C5C38',
};

const W = 1200, H = 630;
let defs = '';
let uid = 0;
const nid = (n) => `og-${n}-${uid++}`;

// ── 프리미티브 ────────────────────────────────────────────
const stem = (x1, y1, x2, y2, w, color, bend = 0) => {
  const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2;
  return `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
};
const leaf = (cx, cy, len, wid, angle, fill) => {
  const tipY = cy - len, midY = cy - len / 2, half = wid / 2;
  const d = `M${cx} ${cy} Q${cx - half} ${midY} ${cx} ${tipY} Q${cx + half} ${midY} ${cx} ${cy} Z`;
  return `<g transform="rotate(${angle} ${cx} ${cy})"><path d="${d}" fill="${fill}"/></g>`;
};
const petalRing = (count, cx, cyTop, rx, ry, pivotY, fill, opacity = 0.9) =>
  Array.from({ length: count }, (_, i) =>
    `<ellipse cx="${cx}" cy="${cyTop}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${opacity}" transform="rotate(${(360 / count) * i} ${cx} ${pivotY})"/>`).join('');
const STAR4 = 'M0,-3.4 L0.9,-0.9 L3.4,0 L0.9,0.9 L0,3.4 L-0.9,0.9 L-3.4,0 L-0.9,-0.9 Z';

// ── 등급 후광 (PlantSVG RARITY_FX 재현) ────────────────────
const legendaryAura = (cx, cy, color = '#FFD44A', scale = 1) => {
  const g = nid('laura');
  defs += `<radialGradient id="${g}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${color}" stop-opacity="0.5"/>
    <stop offset="55%" stop-color="${color}" stop-opacity="0.2"/>
    <stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
  const r1 = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((d) => `<line x1="${cx}" y1="${cy - 58 * scale}" x2="${cx}" y2="${cy - 78 * scale}" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  return `<circle cx="${cx}" cy="${cy}" r="${72 * scale}" fill="url(#${g})"/>
    <g stroke="${color}" stroke-width="${2.2 * scale}" opacity="0.45" stroke-linecap="round">${r1}</g>
    <circle cx="${cx}" cy="${cy}" r="${46 * scale}" fill="none" stroke="${color}" stroke-width="${1.4 * scale}" opacity="0.4"/>`;
};
const transcendentAura = (cx, cy, color = '#E6CBFF', scale = 1) => {
  const g = nid('taura');
  defs += `<radialGradient id="${g}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${color}" stop-opacity="0.55"/>
    <stop offset="50%" stop-color="${color}" stop-opacity="0.24"/>
    <stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
  const long = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
    .map((d) => `<line x1="${cx}" y1="${cy - 80 * scale}" x2="${cx}" y2="${cy - 104 * scale}" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const mid = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345]
    .map((d) => `<line x1="${cx}" y1="${cy - 64 * scale}" x2="${cx}" y2="${cy - 80 * scale}" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  return `<circle cx="${cx}" cy="${cy}" r="${96 * scale}" fill="url(#${g})"/>
    <g stroke="#FFFFFF" stroke-width="${2.4 * scale}" opacity="0.55" stroke-linecap="round">${long}</g>
    <g stroke="${color}" stroke-width="${1.8 * scale}" opacity="0.45" stroke-linecap="round">${mid}</g>
    <circle cx="${cx}" cy="${cy}" r="${66 * scale}" fill="none" stroke="#FFFFFF" stroke-width="${1.4 * scale}" opacity="0.45"/>
    <circle cx="${cx}" cy="${cy}" r="${52 * scale}" fill="none" stroke="${color}" stroke-width="${1.8 * scale}" opacity="0.5"/>`;
};
const sparkles = (cx, cy, positions, color = '#FFF3C0', scale = 1) =>
  positions.map(([dx, dy, s]) =>
    `<path d="${STAR4}" fill="${color}" transform="translate(${cx + dx * scale} ${cy + dy * scale}) scale(${(s ?? 1) * scale})"/>`).join('');

// ── 식물들 (앱 종과 동일 모티프) ───────────────────────────
// 천상수(celestial_tree) — 초월: 짧은 줄기 위 8각 빛별 (PlantSVG 와 동일)
function celestialTree(cx, baseY, scale = 1) {
  const core = nid('ct-core'), halo = nid('ct-halo');
  defs += `<radialGradient id="${core}" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="45%" stop-color="#FFF1A8"/><stop offset="100%" stop-color="#F2B33A"/></radialGradient>
    <radialGradient id="${halo}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFE89A" stop-opacity="0.7"/><stop offset="100%" stop-color="#FFE89A" stop-opacity="0"/></radialGradient>`;
  const cy = baseY - 78 * scale;
  const rayL = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((d) => `<line x1="${cx}" y1="${cy - 56 * scale}" x2="${cx}" y2="${cy - 84 * scale}" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const rayS = [22, 67, 112, 157, 202, 247, 292, 337]
    .map((d) => `<line x1="${cx}" y1="${cy - 44 * scale}" x2="${cx}" y2="${cy - 62 * scale}" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const gems = [[-40, -50], [40, -50], [0, 42], [-52, 10], [52, 10]]
    .map(([dx, dy]) => `<circle cx="${cx + dx * scale}" cy="${cy + dy * scale}" r="${2.6 * scale}" fill="#FFF1A8"/>`).join('');
  return `<g>
    ${transcendentAura(cx, cy, '#FFE6B8', scale)}
    ${stem(cx, baseY, cx, cy + 18 * scale, 5 * scale, darken(T.soil, 60))}
    ${leaf(cx - 3 * scale, baseY - 26 * scale, 24 * scale, 14 * scale, -46, '#7A6A3A')}
    ${leaf(cx + 3 * scale, baseY - 22 * scale, 22 * scale, 13 * scale, 46, '#7A6A3A')}
    <circle cx="${cx}" cy="${cy}" r="${62 * scale}" fill="url(#${halo})"/>
    <g stroke="#FFF6CF" stroke-width="${2.2 * scale}" opacity="0.85" stroke-linecap="round">${rayL}</g>
    <g stroke="#FFD66A" stroke-width="${1.7 * scale}" opacity="0.7" stroke-linecap="round">${rayS}</g>
    <path d="${STAR4}" fill="url(#${core})" transform="translate(${cx} ${cy}) scale(${9 * scale})"/>
    <path d="${STAR4}" fill="url(#${core})" opacity="0.85" transform="translate(${cx} ${cy}) rotate(45) scale(${7.2 * scale})"/>
    <path d="${STAR4}" fill="#FFFFFF" transform="translate(${cx} ${cy}) scale(${3.9 * scale})"/>
    ${gems}
  </g>`;
}
// 은하백합(galaxy_lily) — 초월
function galaxyLily(cx, baseY, scale = 1) {
  const petalG = nid('gl-petal'), coreG = nid('gl-core');
  defs += `<linearGradient id="${petalG}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C9A0FF"/><stop offset="55%" stop-color="#80B0FF"/><stop offset="100%" stop-color="#3E3E7A"/></linearGradient>
    <radialGradient id="${coreG}" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#EAF0FF"/><stop offset="45%" stop-color="#6A78D8"/><stop offset="100%" stop-color="#23234E"/></radialGradient>`;
  const cy = baseY - 84 * scale;
  const out = [0, 60, 120, 180, 240, 300]
    .map((d) => `<ellipse cx="${cx}" cy="${cy - 26 * scale}" rx="${6.6 * scale}" ry="${20 * scale}" fill="url(#${petalG})" opacity="0.92" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const inr = [30, 90, 150, 210, 270, 330]
    .map((d) => `<ellipse cx="${cx}" cy="${cy - 18 * scale}" rx="${4.4 * scale}" ry="${14 * scale}" fill="url(#${petalG})" opacity="0.7" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const dust = [[-9, -9], [9, -9], [0, -16], [-11, 7], [11, 7], [0, 13]]
    .map(([dx, dy]) => `<circle cx="${cx + dx * scale}" cy="${cy + dy * scale}" r="${1.5 * scale}" fill="#FFFFFF"/>`).join('');
  return `<g>
    ${transcendentAura(cx, cy, '#C9B8FF', scale)}
    ${stem(cx, baseY, cx, cy + 16 * scale, 4.6 * scale, mix('#3E3E7A', '#000000', 70))}
    ${leaf(cx - 4 * scale, baseY - 28 * scale, 28 * scale, 15 * scale, -42, '#4A5E8C')}
    ${leaf(cx + 4 * scale, baseY - 24 * scale, 26 * scale, 14 * scale, 42, '#4A5E8C')}
    ${out}${inr}
    <circle cx="${cx}" cy="${cy}" r="${16 * scale}" fill="url(#${coreG})" opacity="0.95"/>
    ${dust}
    <circle cx="${cx}" cy="${cy}" r="${4.6 * scale}" fill="#FFFFFF" opacity="0.95"/>
  </g>`;
}
// 영겁화(eternal_bloom) — 초월: 오로라빛 3겹 꽃잎 + 맥동 코어
function eternalBloom(cx, baseY, scale = 1) {
  const pg = nid('eb-petal'), cg = nid('eb-core');
  defs += `<linearGradient id="${pg}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFB8E8"/><stop offset="50%" stop-color="#C9A0FF"/><stop offset="100%" stop-color="#80E0FF"/></linearGradient>
    <radialGradient id="${cg}" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="50%" stop-color="#FF9AD8"/><stop offset="100%" stop-color="#9A6BFF"/></radialGradient>`;
  const cy = baseY - 70 * scale;
  return `<g>
    ${transcendentAura(cx, cy, '#E6CBFF', scale)}
    ${stem(cx, baseY, cx, cy + 16 * scale, 4.4 * scale, darken('#6A4F8C', 60))}
    ${leaf(cx - 3 * scale, baseY - 24 * scale, 24 * scale, 14 * scale, -46, '#5A4F8A')}
    ${leaf(cx + 3 * scale, baseY - 20 * scale, 22 * scale, 13 * scale, 46, '#5A4F8A')}
    ${petalRing(12, cx, cy - 22 * scale, 6 * scale, 14 * scale, cy, `url(#${pg})`, 0.85)}
    ${petalRing(10, cx, cy - 28 * scale, 5 * scale, 11 * scale, cy, '#FFE3F4', 0.8)}
    ${petalRing(8, cx, cy - 34 * scale, 4 * scale, 9 * scale, cy, `url(#${cg})`, 0.9)}
    <circle cx="${cx}" cy="${cy}" r="${12 * scale}" fill="url(#${cg})"/>
    <circle cx="${cx}" cy="${cy}" r="${6 * scale}" fill="#FFFFFF"/>
  </g>`;
}
// 생명나무(tree_of_life) — 전설
function treeOfLife(cx, baseY, scale = 1) {
  const lg = nid('tol');
  defs += `<linearGradient id="${lg}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lighten('#5A8C3E', 30)}"/><stop offset="100%" stop-color="${darken('#5A8C3E', 18)}"/></linearGradient>`;
  const cy = baseY - 72 * scale;
  return `<g>
    ${legendaryAura(cx, cy, '#FFD44A', scale)}
    <rect x="${cx - 9 * scale}" y="${baseY - 76 * scale}" width="${18 * scale}" height="${76 * scale}" rx="${4 * scale}" fill="#7C4A1E"/>
    <circle cx="${cx}" cy="${cy}" r="${32 * scale}" fill="url(#${lg})"/>
    <circle cx="${cx - 26 * scale}" cy="${cy + 16 * scale}" r="${21 * scale}" fill="url(#${lg})" opacity="0.92"/>
    <circle cx="${cx + 26 * scale}" cy="${cy + 16 * scale}" r="${21 * scale}" fill="url(#${lg})" opacity="0.92"/>
    <circle cx="${cx}" cy="${cy - 24 * scale}" r="${18 * scale}" fill="url(#${lg})"/>
    <circle cx="${cx}" cy="${cy}" r="${11 * scale}" fill="#FFE066"/>
    <circle cx="${cx}" cy="${cy}" r="${5.5 * scale}" fill="#FFFFFF" opacity="0.8"/>
    ${sparkles(cx, cy, [[-38, -28, 1.2], [40, -20, 1], [0, -52, 1.3], [-48, 24, 0.9]], '#FFF3C0', scale)}
  </g>`;
}
// 황금모란(golden_peony) — 전설
function goldenPeony(cx, baseY, scale = 1) {
  const g = nid('gp');
  defs += `<radialGradient id="${g}" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#FFF3C0"/><stop offset="55%" stop-color="#FFD24A"/><stop offset="100%" stop-color="#E0902A"/></radialGradient>`;
  const cy = baseY - 72 * scale;
  const outer = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((d) => `<ellipse cx="${cx}" cy="${cy - 18 * scale}" rx="${9 * scale}" ry="${16 * scale}" fill="url(#${g})" opacity="0.85" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const inner = [22, 67, 112, 157, 202, 247, 292, 337]
    .map((d) => `<ellipse cx="${cx}" cy="${cy - 11 * scale}" rx="${6.4 * scale}" ry="${11 * scale}" fill="url(#${g})" opacity="0.95" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  return `<g>
    ${legendaryAura(cx, cy, '#FFE08A', scale)}
    ${stem(cx, baseY, cx, cy + 16 * scale, 4.6 * scale, darken('#5A8C3E', 70))}
    ${leaf(cx - 3 * scale, baseY - 24 * scale, 24 * scale, 14 * scale, -46, '#5A8C3E')}
    ${leaf(cx + 3 * scale, baseY - 20 * scale, 22 * scale, 13 * scale, 46, '#5A8C3E')}
    ${outer}${inner}
    <circle cx="${cx}" cy="${cy}" r="${6.4 * scale}" fill="#FFF8D8"/>
    ${sparkles(cx, cy, [[-28, -22, 1], [32, -16, 1.1], [0, -38, 1.2]], '#FFF3C0', scale)}
  </g>`;
}
// 수정장미(crystal_rose) — 전설
function crystalRose(cx, baseY, scale = 1) {
  const g = nid('cr');
  defs += `<radialGradient id="${g}" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="50%" stop-color="#FF9AD0"/><stop offset="100%" stop-color="#C0418F"/></radialGradient>`;
  const cy = baseY - 66 * scale;
  const facets = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((d) => `<polygon points="${cx},${cy - 36 * scale} ${cx - 9 * scale},${cy - 5 * scale} ${cx},${cy + 4 * scale} ${cx + 9 * scale},${cy - 5 * scale}" fill="url(#${g})" opacity="0.9" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  return `<g>
    ${legendaryAura(cx, cy, '#FFB8E8', scale)}
    ${stem(cx, baseY, cx, cy + 14 * scale, 4.2 * scale, darken('#5A8C3E', 70))}
    ${leaf(cx - 3 * scale, baseY - 22 * scale, 22 * scale, 13 * scale, -48, '#5A8C3E')}
    ${leaf(cx + 3 * scale, baseY - 18 * scale, 20 * scale, 12 * scale, 48, '#5A8C3E')}
    ${facets}
    <polygon points="${cx},${cy - 14 * scale} ${cx - 13 * scale},${cy} ${cx},${cy + 18 * scale} ${cx + 13 * scale},${cy}" fill="#FFFFFF" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="${4.6 * scale}" fill="#FFFFFF"/>
    ${sparkles(cx, cy, [[-24, -18, 1], [28, -12, 1.1], [0, -32, 1.2]], '#FFFFFF', scale)}
  </g>`;
}
// 별빛백합(starlight_lily) — 전설
function starlightLily(cx, baseY, scale = 1) {
  const g = nid('sl');
  defs += `<radialGradient id="${g}" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="45%" stop-color="#A9C0FF"/><stop offset="100%" stop-color="#4A4F9E"/></radialGradient>`;
  const cy = baseY - 70 * scale;
  const petals = [0, 60, 120, 180, 240, 300]
    .map((d) => `<ellipse cx="${cx}" cy="${cy - 20 * scale}" rx="${6.4 * scale}" ry="${20 * scale}" fill="url(#${g})" opacity="0.92" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  return `<g>
    ${legendaryAura(cx, cy, '#BFD0FF', scale)}
    ${stem(cx, baseY, cx, cy + 14 * scale, 4.2 * scale, darken('#4A5E8C', 70))}
    ${leaf(cx - 3 * scale, baseY - 22 * scale, 22 * scale, 13 * scale, -48, '#4A5E8C')}
    ${leaf(cx + 3 * scale, baseY - 18 * scale, 20 * scale, 12 * scale, 48, '#4A5E8C')}
    ${petals}
    <circle cx="${cx}" cy="${cy}" r="${7.4 * scale}" fill="#FFE89A"/>
    <circle cx="${cx}" cy="${cy}" r="${3 * scale}" fill="#FFFFFF"/>
    ${sparkles(cx, cy, [[-26, -16, 1], [30, -10, 1.1], [0, -36, 1.3]], '#FFFFFF', scale)}
  </g>`;
}
// 오로라난초(aurora_orchid) — 전설
function auroraOrchid(cx, baseY, scale = 1) {
  const g = nid('ao');
  defs += `<linearGradient id="${g}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF8AD0"/><stop offset="50%" stop-color="#9A7BFF"/><stop offset="100%" stop-color="#6FE6E0"/></linearGradient>`;
  const cy = baseY - 66 * scale;
  return `<g>
    ${legendaryAura(cx, cy, '#B79AFF', scale)}
    ${stem(cx, baseY, cx, cy + 16 * scale, 4.2 * scale, darken('#5A7A8C', 70))}
    ${leaf(cx - 3 * scale, baseY - 22 * scale, 22 * scale, 13 * scale, -48, '#5A7A8C')}
    ${leaf(cx + 3 * scale, baseY - 18 * scale, 20 * scale, 12 * scale, 48, '#5A7A8C')}
    <ellipse cx="${cx - 18 * scale}" cy="${cy - 4 * scale}" rx="${12 * scale}" ry="${19 * scale}" fill="url(#${g})" opacity="0.9" transform="rotate(-30 ${cx - 18 * scale} ${cy - 4 * scale})"/>
    <ellipse cx="${cx + 18 * scale}" cy="${cy - 4 * scale}" rx="${12 * scale}" ry="${19 * scale}" fill="url(#${g})" opacity="0.9" transform="rotate(30 ${cx + 18 * scale} ${cy - 4 * scale})"/>
    <ellipse cx="${cx}" cy="${cy - 14 * scale}" rx="${10 * scale}" ry="${19 * scale}" fill="url(#${g})" opacity="0.92"/>
    <ellipse cx="${cx - 9 * scale}" cy="${cy + 6 * scale}" rx="${8 * scale}" ry="${13 * scale}" fill="url(#${g})" opacity="0.85" transform="rotate(-15 ${cx - 9 * scale} ${cy + 6 * scale})"/>
    <ellipse cx="${cx + 9 * scale}" cy="${cy + 6 * scale}" rx="${8 * scale}" ry="${13 * scale}" fill="url(#${g})" opacity="0.85" transform="rotate(15 ${cx + 9 * scale} ${cy + 6 * scale})"/>
    <circle cx="${cx}" cy="${cy}" r="${5 * scale}" fill="#FFFFFF" opacity="0.9"/>
    ${sparkles(cx, cy, [[-24, -16, 1], [28, -10, 1.1], [0, -34, 1.2]], '#FFFFFF', scale)}
  </g>`;
}

// ── 정원 패널 좌표 (Garden.tsx 비율 재현) ───────────────────
const PAD = 28;                       // 페이지 여백
const PX = PAD, PY = PAD;             // 패널 좌상단
const PW = W - PAD * 2, PH = H - PAD * 2;
const PR = 24;                        // 패널 라운드
const panelRight = PX + PW, panelBottom = PY + PH;

const clip = nid('panel-clip');
defs += `<clipPath id="${clip}"><rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="${PR}"/></clipPath>`;

// 배경 그라데이션·해무리·흙
defs += `<linearGradient id="og-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${T.skyTop}"/>
    <stop offset="62%" stop-color="${T.skyBottom}"/>
    <stop offset="100%" stop-color="${T.leafSoft}"/></linearGradient>
  <radialGradient id="og-sun" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${T.sun}" stop-opacity="0.95"/>
    <stop offset="60%" stop-color="${T.sun}" stop-opacity="0.4"/>
    <stop offset="100%" stop-color="${T.sun}" stop-opacity="0"/></radialGradient>
  <linearGradient id="og-soil" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${T.soilTop}" stop-opacity="0"/>
    <stop offset="45%" stop-color="${T.soilTop}" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="${T.soilBottom}" stop-opacity="0.5"/></linearGradient>`;

// 원경 언덕 (앱과 동일 path, 패널 폭/하단 밴드에 매핑)
const hillBandH = PH * 0.27, hillBandBottom = panelBottom - PH * 0.11;
const hillBandTop = hillBandBottom - hillBandH;
const hx = (t) => PX + (t / 100) * PW;
const hy = (t) => hillBandTop + (t / 24) * hillBandH;
const hills = `<path d="M${hx(0)} ${hy(18)} Q${hx(22)} ${hy(6)} ${hx(46)} ${hy(14)} Q${hx(72)} ${hy(22)} ${hx(100)} ${hy(10)} L${hx(100)} ${hy(24)} L${hx(0)} ${hy(24)} Z" fill="${T.hill}" opacity="0.45"/>
  <path d="M${hx(0)} ${hy(22)} Q${hx(30)} ${hy(12)} ${hx(58)} ${hy(18)} Q${hx(80)} ${hy(22)} ${hx(100)} ${hy(16)} L${hx(100)} ${hy(24)} L${hx(0)} ${hy(24)} Z" fill="${T.hill}" opacity="0.6"/>`;

// 흙 띠 (하단)
const soilH = PH * 0.24, soilTopY = panelBottom - soilH;
const soil = `<rect x="${PX}" y="${soilTopY}" width="${PW}" height="${soilH}" fill="url(#og-soil)"/>`;

// 떠다니는 빛 입자 (앱 5점 위치를 패널에 매핑)
const motes = [
  { l: 0.14, b: 0.22, s: 6 }, { l: 0.32, b: 0.34, s: 5 }, { l: 0.54, b: 0.18, s: 7 },
  { l: 0.72, b: 0.40, s: 5 }, { l: 0.86, b: 0.26, s: 6 },
].map((m) => {
  const g = nid('mote');
  defs += `<radialGradient id="${g}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#FFF7C8" stop-opacity="0.9"/><stop offset="70%" stop-color="#FFF7C8" stop-opacity="0"/></radialGradient>`;
  const cx = PX + m.l * PW, cy = panelBottom - m.b * PH;
  return `<circle cx="${cx}" cy="${cy}" r="${m.s * 2.2}" fill="url(#${g})"/>`;
}).join('');
// 흩뿌린 미세 별가루
const stardust = Array.from({ length: 30 }, () => {
  const x = (PX + Math.random() * PW).toFixed(0);
  const y = (PY + Math.random() * PH * 0.62).toFixed(0);
  const r = (0.6 + Math.random() * 1.6).toFixed(1);
  const o = (0.2 + Math.random() * 0.4).toFixed(2);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF" opacity="${o}"/>`;
}).join('');

// ── 계단식 화단: 8그루 = 2줄 × 4 (PLANTS_PER_ROW=4) ─────────
// 뒤 줄(깊은)일수록 축소·반투명·위쪽으로 겹쳐 원근을 만든다(Garden.tsx scale=1-depth*0.15).
const colGap = PW * 0.165;
const cols4 = [-1.5, -0.5, 0.5, 1.5].map((k) => PX + PW / 2 + k * colGap); // 4열 중앙 정렬
const rowShadow = (baseY, scale, opacity) => {
  const w = PW * 0.66 * scale;
  return `<ellipse cx="${PX + PW / 2}" cy="${baseY + 6}" rx="${w / 2}" ry="${9 * scale}" fill="${T.soil}" opacity="${0.2 * opacity}"/>`;
};

const frontScale = 1.35;
const backScale = frontScale * 0.85;   // depth=1 → scale 0.85
const backOp = 0.85;                   // depth=1 → opacity 0.85
const frontBaseY = soilTopY + soilH * 0.62;
const backBaseY = frontBaseY - 104 * frontScale; // 위쪽으로 올려 뒤 줄 꽃이 앞 줄 위로 보이게

// 뒤 줄 (depth=1)
const backPlants = [
  (x) => starlightLily(x, backBaseY, backScale),
  (x) => eternalBloom(x, backBaseY, backScale),   // 초월
  (x) => auroraOrchid(x, backBaseY, backScale),
  (x) => crystalRose(x, backBaseY, backScale),
];
const backRow = `<g opacity="${backOp}">${rowShadow(backBaseY, backScale, backOp)}${cols4.map((x, i) => backPlants[i](x)).join('')}</g>`;

// 앞 줄 (depth=0)
const frontPlants = [
  (x) => treeOfLife(x, frontBaseY, frontScale),
  (x) => celestialTree(x, frontBaseY, frontScale + 0.1), // 초월 중심
  (x) => galaxyLily(x, frontBaseY, frontScale),          // 초월
  (x) => goldenPeony(x, frontBaseY, frontScale),
];
const frontRow = `<g>${rowShadow(frontBaseY, frontScale, 1)}${cols4.map((x, i) => frontPlants[i](x)).join('')}</g>`;

// ── 합성 ──────────────────────────────────────────────────
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${defs}</defs>
  <rect width="${W}" height="${H}" fill="${T.bgBase}"/>
  <g clip-path="url(#${clip})">
    <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" fill="url(#og-sky)"/>
    <circle cx="${panelRight - 40}" cy="${PY + 18}" r="${PH * 0.30}" fill="url(#og-sun)"/>
    ${stardust}
    ${hills}
    ${soil}
    ${motes}
    ${backRow}
    ${frontRow}
    <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="${PR}" fill="none" stroke="#2A2E27" stroke-opacity="0.10" stroke-width="38"/>
  </g>
</svg>`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg, 'utf8');
console.log('✓ OG 카드 생성:', OUT, `(${(svg.length / 1024).toFixed(1)} KB)`);
