/**
 * build-og-card.mjs — "습관 정원" OG 카드(1200×630) 시안 생성기
 *
 * 앱의 실제 비주얼 언어를 그대로 옮긴다:
 *  - 정원 하늘 그라데이션(--garden-sky-top → --garden-sky-bottom)·해무리·토양 둔덕
 *  - 등급 위계: 전설(legendary)=황금 후광·광선·sparkle, 초월(transcendent)=무지개 천상 광륜·회전 광선
 *  - 식물 모티프는 PlantSVG.tsx 와 동일 종(천상수·은하백합 / 생명나무·황금모란·수정장미·별빛백합)
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
// a 를 p%, 나머지는 b 로 섞기
const mix = (a, b, p) => {
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b);
  const t = p / 100;
  return toHex([ar * t + br * (1 - t), ag * t + bg * (1 - t), ab * t + bb * (1 - t)]);
};
const lighten = (c, p) => mix(c, '#ffffff', 100 - p);
const darken = (c, p) => mix(c, '#000000', 100 - p);

// ── 디자인 토큰 (index.css) ───────────────────────────────
const T = {
  bgBase: '#F4F6EE', fg: '#2A2E27', fgMuted: '#6B7164',
  leaf: '#4F7A37', leafSoft: '#E7F0DD', soil: '#8A6E4B', bloom: '#A85D0B',
  skyTop: '#CDEBF6', skyBottom: '#EAF6DA', sun: '#FFF1C2',
  soilTop: '#A98559', soilBottom: '#7C5C38',
};

const W = 1200, H = 630;
let defs = '';
let uid = 0;
const nid = (n) => `og-${n}-${uid++}`;

// ── 곡선 줄기 ─────────────────────────────────────────────
const stem = (x1, y1, x2, y2, w, color, bend = 0) => {
  const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2;
  return `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
};

// ── 잎 ───────────────────────────────────────────────────
const leaf = (cx, cy, len, wid, angle, fill) => {
  const tipY = cy - len, midY = cy - len / 2, half = wid / 2;
  const d = `M${cx} ${cy} Q${cx - half} ${midY} ${cx} ${tipY} Q${cx + half} ${midY} ${cx} ${cy} Z`;
  return `<g transform="rotate(${angle} ${cx} ${cy})"><path d="${d}" fill="${fill}"/></g>`;
};

// 꽃잎 링
const petalRing = (count, cx, cyTop, rx, ry, pivotY, fill, opacity = 0.9) =>
  Array.from({ length: count }, (_, i) => {
    const deg = (360 / count) * i;
    return `<ellipse cx="${cx}" cy="${cyTop}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${opacity}" transform="rotate(${deg} ${cx} ${pivotY})"/>`;
  }).join('');

const STAR4 = 'M0,-3.4 L0.9,-0.9 L3.4,0 L0.9,0.9 L0,3.4 L-0.9,0.9 L-3.4,0 L-0.9,-0.9 Z';

// ── 등급 후광 ─────────────────────────────────────────────
// legendary: 황금 후광 + 광선 버스트
const legendaryAura = (cx, cy, color = '#FFD44A') => {
  const g = nid('laura');
  defs += `<radialGradient id="${g}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${color}" stop-opacity="0.55"/>
    <stop offset="55%" stop-color="${color}" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((d) => `<line x1="${cx}" y1="${cy - 64}" x2="${cx}" y2="${cy - 84}" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const rays2 = [22, 67, 112, 157, 202, 247, 292, 337]
    .map((d) => `<line x1="${cx}" y1="${cy - 52}" x2="${cx}" y2="${cy - 66}" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  return `<circle cx="${cx}" cy="${cy}" r="78" fill="url(#${g})"/>
    <g stroke="${color}" stroke-width="2.4" opacity="0.5" stroke-linecap="round">${rays}</g>
    <g stroke="${color}" stroke-width="1.6" opacity="0.35" stroke-linecap="round">${rays2}</g>
    <circle cx="${cx}" cy="${cy}" r="50" fill="none" stroke="${color}" stroke-width="1.6" opacity="0.45"/>`;
};

// transcendent: 무지개 천상 광륜 (이중 광선 + 이중 광륜)
const transcendentAura = (cx, cy, color = '#E6CBFF') => {
  const g = nid('taura');
  defs += `<radialGradient id="${g}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${color}" stop-opacity="0.6"/>
    <stop offset="50%" stop-color="${color}" stop-opacity="0.26"/>
    <stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
  const long = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
    .map((d) => `<line x1="${cx}" y1="${cy - 86}" x2="${cx}" y2="${cy - 112}" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const mid = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345]
    .map((d) => `<line x1="${cx}" y1="${cy - 70}" x2="${cx}" y2="${cy - 88}" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  return `<circle cx="${cx}" cy="${cy}" r="104" fill="url(#${g})"/>
    <g stroke="#FFFFFF" stroke-width="2.6" opacity="0.6" stroke-linecap="round">${long}</g>
    <g stroke="${color}" stroke-width="2" opacity="0.5" stroke-linecap="round">${mid}</g>
    <circle cx="${cx}" cy="${cy}" r="72" fill="none" stroke="#FFFFFF" stroke-width="1.6" opacity="0.5"/>
    <circle cx="${cx}" cy="${cy}" r="56" fill="none" stroke="${color}" stroke-width="2" opacity="0.55"/>`;
};

const sparkles = (cx, cy, positions, color = '#FFF3C0', scale = 1) =>
  positions.map(([dx, dy, s]) =>
    `<path d="${STAR4}" fill="${color}" transform="translate(${cx + dx} ${cy + dy}) scale(${(s ?? 1) * scale})"/>`).join('');

// ── 식물들 (앱 종과 동일 모티프) ───────────────────────────

// 천상수(celestial_tree) — 초월: 8각 빛별 + 방사 광선 + 궤도 보석. 정원의 중심.
function celestialTree(cx, baseY, scale = 1) {
  const core = nid('ct-core'), halo = nid('ct-halo');
  defs += `<radialGradient id="${core}" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="45%" stop-color="#FFF1A8"/><stop offset="100%" stop-color="#F2B33A"/></radialGradient>
    <radialGradient id="${halo}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFE89A" stop-opacity="0.7"/><stop offset="100%" stop-color="#FFE89A" stop-opacity="0"/></radialGradient>`;
  const cy = baseY - 150 * scale; // 별 중심 높이
  const trunk = `<rect x="${cx - 7 * scale}" y="${baseY - 150 * scale}" width="${14 * scale}" height="${150 * scale}" rx="${5 * scale}" fill="${T.soil}"/>
    <rect x="${cx - 4 * scale}" y="${baseY - 150 * scale}" width="${5 * scale}" height="${150 * scale}" rx="${3 * scale}" fill="${lighten(T.soil, 22)}" opacity="0.5"/>`;
  const rayL = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((d) => `<line x1="${cx}" y1="${cy - 62 * scale}" x2="${cx}" y2="${cy - 92 * scale}" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const rayS = [22, 67, 112, 157, 202, 247, 292, 337]
    .map((d) => `<line x1="${cx}" y1="${cy - 50 * scale}" x2="${cx}" y2="${cy - 68 * scale}" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const gems = [[-44, -56], [44, -56], [0, 46], [-58, 14], [58, 14]]
    .map(([dx, dy]) => `<circle cx="${cx + dx * scale}" cy="${cy + dy * scale}" r="${3 * scale}" fill="#FFF1A8"/>`).join('');
  return `<g>
    ${transcendentAura(cx, cy, '#FFE6B8')}
    ${trunk}
    <circle cx="${cx}" cy="${cy}" r="${72 * scale}" fill="url(#${halo})"/>
    <g stroke="#FFF6CF" stroke-width="${2.4 * scale}" opacity="0.85" stroke-linecap="round">${rayL}</g>
    <g stroke="#FFD66A" stroke-width="${1.8 * scale}" opacity="0.7" stroke-linecap="round">${rayS}</g>
    <path d="${STAR4}" fill="url(#${core})" transform="translate(${cx} ${cy}) scale(${10 * scale})"/>
    <path d="${STAR4}" fill="url(#${core})" opacity="0.85" transform="translate(${cx} ${cy}) rotate(45) scale(${8 * scale})"/>
    <path d="${STAR4}" fill="#FFFFFF" transform="translate(${cx} ${cy}) scale(${4.4 * scale})"/>
    ${gems}
  </g>`;
}

// 은하백합(galaxy_lily) — 초월: 6장 백합 + 성운 코어 + 별가루
function galaxyLily(cx, baseY, scale = 1) {
  const petalG = nid('gl-petal'), coreG = nid('gl-core');
  defs += `<linearGradient id="${petalG}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C9A0FF"/><stop offset="55%" stop-color="#80B0FF"/><stop offset="100%" stop-color="#3E3E7A"/></linearGradient>
    <radialGradient id="${coreG}" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#EAF0FF"/><stop offset="45%" stop-color="#6A78D8"/><stop offset="100%" stop-color="#23234E"/></radialGradient>`;
  const cy = baseY - 92 * scale;
  const stemEl = stem(cx, baseY, cx, cy + 18 * scale, 5 * scale, mix('#3E3E7A', '#000000', 70));
  const lf = leaf(cx - 4 * scale, baseY - 30 * scale, 30 * scale, 16 * scale, -42, '#4A5E8C')
    + leaf(cx + 4 * scale, baseY - 26 * scale, 28 * scale, 15 * scale, 42, '#4A5E8C');
  const outer = [0, 60, 120, 180, 240, 300]
    .map((d) => `<ellipse cx="${cx}" cy="${cy - 28 * scale}" rx="${7.2 * scale}" ry="${22 * scale}" fill="url(#${petalG})" opacity="0.92" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const inner = [30, 90, 150, 210, 270, 330]
    .map((d) => `<ellipse cx="${cx}" cy="${cy - 20 * scale}" rx="${4.8 * scale}" ry="${15 * scale}" fill="url(#${petalG})" opacity="0.7" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const dust = [[-10, -10], [10, -10], [0, -18], [-12, 8], [12, 8], [0, 14]]
    .map(([dx, dy]) => `<circle cx="${cx + dx * scale}" cy="${cy + dy * scale}" r="${1.7 * scale}" fill="#FFFFFF"/>`).join('');
  return `<g>
    ${transcendentAura(cx, cy, '#C9B8FF')}
    ${stemEl}${lf}
    ${outer}${inner}
    <circle cx="${cx}" cy="${cy}" r="${18 * scale}" fill="url(#${coreG})" opacity="0.95"/>
    ${dust}
    <circle cx="${cx}" cy="${cy}" r="${5 * scale}" fill="#FFFFFF" opacity="0.95"/>
  </g>`;
}

// 생명나무(tree_of_life) — 전설: 둥근 잎 덩어리 + 빛 구체
function treeOfLife(cx, baseY, scale = 1) {
  const lg = nid('tol-leaf');
  defs += `<linearGradient id="${lg}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lighten('#5A8C3E', 30)}"/><stop offset="100%" stop-color="${darken('#5A8C3E', 18)}"/></linearGradient>`;
  const cy = baseY - 96 * scale;
  return `<g>
    ${legendaryAura(cx, cy, '#FFD44A')}
    <rect x="${cx - 9 * scale}" y="${baseY - 110 * scale}" width="${18 * scale}" height="${110 * scale}" rx="${4 * scale}" fill="#7C4A1E"/>
    <circle cx="${cx}" cy="${cy}" r="${34 * scale}" fill="url(#${lg})"/>
    <circle cx="${cx - 28 * scale}" cy="${cy + 18 * scale}" r="${22 * scale}" fill="url(#${lg})" opacity="0.92"/>
    <circle cx="${cx + 28 * scale}" cy="${cy + 18 * scale}" r="${22 * scale}" fill="url(#${lg})" opacity="0.92"/>
    <circle cx="${cx}" cy="${cy - 26 * scale}" r="${19 * scale}" fill="url(#${lg})"/>
    <circle cx="${cx}" cy="${cy}" r="${12 * scale}" fill="#FFE066"/>
    <circle cx="${cx}" cy="${cy}" r="${6 * scale}" fill="#FFFFFF" opacity="0.8"/>
    ${sparkles(cx, cy, [[-40, -30, 1.3], [42, -22, 1.1], [0, -56, 1.4], [-50, 26, 1], [52, 30, 1.2]], '#FFF3C0', scale)}
  </g>`;
}

// 황금모란(golden_peony) — 전설: 이중 꽃잎 황금 모란
function goldenPeony(cx, baseY, scale = 1) {
  const g = nid('gp');
  defs += `<radialGradient id="${g}" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#FFF3C0"/><stop offset="55%" stop-color="#FFD24A"/><stop offset="100%" stop-color="#E0902A"/></radialGradient>`;
  const cy = baseY - 78 * scale;
  const stemEl = stem(cx, baseY, cx, cy + 16 * scale, 5 * scale, darken('#5A8C3E', 70));
  const lf = leaf(cx - 3 * scale, baseY - 26 * scale, 26 * scale, 15 * scale, -46, '#5A8C3E')
    + leaf(cx + 3 * scale, baseY - 22 * scale, 24 * scale, 14 * scale, 46, '#5A8C3E');
  const outer = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((d) => `<ellipse cx="${cx}" cy="${cy - 20 * scale}" rx="${10 * scale}" ry="${18 * scale}" fill="url(#${g})" opacity="0.85" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  const inner = [22, 67, 112, 157, 202, 247, 292, 337]
    .map((d) => `<ellipse cx="${cx}" cy="${cy - 12 * scale}" rx="${7 * scale}" ry="${12 * scale}" fill="url(#${g})" opacity="0.95" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  return `<g>
    ${legendaryAura(cx, cy, '#FFE08A')}
    ${stemEl}${lf}
    ${outer}${inner}
    <circle cx="${cx}" cy="${cy}" r="${7 * scale}" fill="#FFF8D8"/>
    ${sparkles(cx, cy, [[-30, -24, 1], [34, -18, 1.1], [0, -40, 1.2]], '#FFF3C0', scale)}
  </g>`;
}

// 수정장미(crystal_rose) — 전설: 결정형 분홍 장미
function crystalRose(cx, baseY, scale = 1) {
  const g = nid('cr');
  defs += `<radialGradient id="${g}" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="50%" stop-color="#FF9AD0"/><stop offset="100%" stop-color="#C0418F"/></radialGradient>`;
  const cy = baseY - 72 * scale;
  const stemEl = stem(cx, baseY, cx, cy + 14 * scale, 4.5 * scale, darken('#5A8C3E', 70));
  const lf = leaf(cx - 3 * scale, baseY - 24 * scale, 24 * scale, 14 * scale, -48, '#5A8C3E')
    + leaf(cx + 3 * scale, baseY - 20 * scale, 22 * scale, 13 * scale, 48, '#5A8C3E');
  const facets = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((d) => `<polygon points="${cx},${cy - 40 * scale} ${cx - 10 * scale},${cy - 6 * scale} ${cx},${cy + 4 * scale} ${cx + 10 * scale},${cy - 6 * scale}" fill="url(#${g})" opacity="0.9" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  return `<g>
    ${legendaryAura(cx, cy, '#FFB8E8')}
    ${stemEl}${lf}
    ${facets}
    <polygon points="${cx},${cy - 16 * scale} ${cx - 15 * scale},${cy} ${cx},${cy + 20 * scale} ${cx + 15 * scale},${cy}" fill="#FFFFFF" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="${5 * scale}" fill="#FFFFFF"/>
    ${sparkles(cx, cy, [[-26, -20, 1], [30, -14, 1.1], [0, -34, 1.2]], '#FFFFFF', scale)}
  </g>`;
}

// 별빛백합(starlight_lily) — 전설: 6장 백합 + 별빛
function starlightLily(cx, baseY, scale = 1) {
  const g = nid('sl');
  defs += `<radialGradient id="${g}" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="45%" stop-color="#A9C0FF"/><stop offset="100%" stop-color="#4A4F9E"/></radialGradient>`;
  const cy = baseY - 76 * scale;
  const stemEl = stem(cx, baseY, cx, cy + 14 * scale, 4.5 * scale, darken('#4A5E8C', 70));
  const lf = leaf(cx - 3 * scale, baseY - 24 * scale, 24 * scale, 14 * scale, -48, '#4A5E8C')
    + leaf(cx + 3 * scale, baseY - 20 * scale, 22 * scale, 13 * scale, 48, '#4A5E8C');
  const petals = [0, 60, 120, 180, 240, 300]
    .map((d) => `<ellipse cx="${cx}" cy="${cy - 22 * scale}" rx="${7 * scale}" ry="${22 * scale}" fill="url(#${g})" opacity="0.92" transform="rotate(${d} ${cx} ${cy})"/>`).join('');
  return `<g>
    ${legendaryAura(cx, cy, '#BFD0FF')}
    ${stemEl}${lf}
    ${petals}
    <circle cx="${cx}" cy="${cy}" r="${8 * scale}" fill="#FFE89A"/>
    <circle cx="${cx}" cy="${cy}" r="${3.2 * scale}" fill="#FFFFFF"/>
    ${sparkles(cx, cy, [[-28, -18, 1], [32, -12, 1.1], [0, -38, 1.3]], '#FFFFFF', scale)}
  </g>`;
}

// 작은 일반 식물(전경 채움) — 새싹·해바라기 느낌
function sprout(cx, baseY, color, accent, scale = 1) {
  const cy = baseY - 40 * scale;
  return `<g>${stem(cx, baseY, cx, cy, 3 * scale, darken(color, 80))}
    ${leaf(cx, baseY - 14 * scale, 18 * scale, 12 * scale, -52, lighten(color, 8))}
    ${leaf(cx, baseY - 14 * scale, 18 * scale, 12 * scale, 52, darken(color, 12))}
    <circle cx="${cx}" cy="${cy}" r="${9 * scale}" fill="${accent}"/>
    <circle cx="${cx}" cy="${cy}" r="${4 * scale}" fill="#FFFFFF" opacity="0.55"/></g>`;
}

// ── 배경 정의 ─────────────────────────────────────────────
defs += `<linearGradient id="og-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${T.skyTop}"/>
    <stop offset="62%" stop-color="${T.skyBottom}"/>
    <stop offset="100%" stop-color="${T.leafSoft}"/></linearGradient>
  <radialGradient id="og-sun" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${T.sun}" stop-opacity="0.95"/>
    <stop offset="55%" stop-color="${T.sun}" stop-opacity="0.45"/>
    <stop offset="100%" stop-color="${T.sun}" stop-opacity="0"/></radialGradient>
  <linearGradient id="og-soil" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${T.soilTop}"/>
    <stop offset="100%" stop-color="${T.soilBottom}"/></linearGradient>
  <radialGradient id="og-soilshade" cx="50%" cy="0%" r="80%">
    <stop offset="0%" stop-color="${lighten(T.soilTop, 14)}" stop-opacity="0.9"/>
    <stop offset="100%" stop-color="${T.soilTop}" stop-opacity="0"/></radialGradient>
  <linearGradient id="og-panel" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.0"/>
    <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0"/></linearGradient>`;

// 하늘 떠다니는 입자
const skyMotes = Array.from({ length: 26 }, () => {
  const x = Math.round(Math.random() * W);
  const y = Math.round(40 + Math.random() * 360);
  const r = (0.8 + Math.random() * 2).toFixed(1);
  const o = (0.25 + Math.random() * 0.45).toFixed(2);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF" opacity="${o}"/>`;
}).join('');

// 멀리 보이는 언덕(부드러운 깊이감)
const hills = `<path d="M0 470 Q300 420 600 460 T1200 450 L1200 630 L0 630 Z" fill="${mix(T.leaf, T.skyBottom, 40)}" opacity="0.5"/>
  <path d="M0 510 Q360 470 720 505 T1200 500 L1200 630 L0 630 Z" fill="${mix(T.leaf, T.leafSoft, 55)}" opacity="0.6"/>`;

// 토양 둔덕
const SOIL_Y = 500;
const soil = `<path d="M0 ${SOIL_Y + 20} Q200 ${SOIL_Y - 28} 480 ${SOIL_Y - 6} Q760 ${SOIL_Y + 14} 1000 ${SOIL_Y - 18} Q1120 ${SOIL_Y - 30} 1200 ${SOIL_Y - 4} L1200 630 L0 630 Z" fill="url(#og-soil)"/>
  <path d="M0 ${SOIL_Y + 20} Q200 ${SOIL_Y - 28} 480 ${SOIL_Y - 6} Q760 ${SOIL_Y + 14} 1000 ${SOIL_Y - 18} Q1120 ${SOIL_Y - 30} 1200 ${SOIL_Y - 4} L1200 ${SOIL_Y + 60} L0 ${SOIL_Y + 60} Z" fill="url(#og-soilshade)"/>`;

// ── 식물 배치 (지면선 ~ baseY) ─────────────────────────────
// 뒤쪽 작은 식물(채움)
const back =
  sprout(120, 545, '#5D8F3E', '#A8D08D', 1.1) +
  sprout(1080, 535, '#6AAB3C', '#FFD44A', 1.15) +
  sprout(255, 560, '#3A8C3A', '#7FD17F', 0.95);

// 영웅 라인업: 좌→우, 중앙에 초월 천상수
const heroes =
  starlightLily(360, 555, 0.95) +
  crystalRose(470, 568, 0.92) +
  galaxyLily(870, 560, 1.0) +              // 초월
  goldenPeony(980, 565, 0.95) +
  treeOfLife(700, 540, 1.0) +              // 전설 (중앙 좌)
  celestialTree(600, 545, 1.12);           // 초월 — 정원의 중심 (마지막=최상단)

// ── 텍스트 ────────────────────────────────────────────────
// 가독성 보조: 좌상단 부드러운 패널
const text = `
  <g font-family="'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif">
    <g transform="translate(72 96)">
      <rect x="-14" y="-44" width="150" height="40" rx="20" fill="#FFFFFF" opacity="0.72"/>
      <circle cx="8" cy="-24" r="6" fill="${T.leaf}"/>
      <text x="24" y="-18" font-size="20" font-weight="700" fill="${T.leaf}" letter-spacing="0.5">HABIT GARDEN</text>
      <text x="0" y="56" font-size="92" font-weight="800" fill="${T.fg}" letter-spacing="-1">습관 정원</text>
      <text x="2" y="108" font-size="34" font-weight="700" fill="${darken(T.bloom, 92)}">전설과 초월이 자라는 정원</text>
      <text x="3" y="150" font-size="23" font-weight="500" fill="${T.fgMuted}">매일의 작은 습관이 모여 전설의 꽃을 피웁니다</text>
    </g>
  </g>`;

// 등급 범례 칩 (우상단)
const legend = `
  <g font-family="'Pretendard','Noto Sans KR',sans-serif" transform="translate(${W - 72} 84)" text-anchor="end">
    <g transform="translate(0 0)">
      <rect x="-150" y="-22" width="150" height="34" rx="17" fill="#FFFFFF" opacity="0.82"/>
      <path d="${STAR4}" fill="#E6CBFF" transform="translate(-130 -5) scale(2.6)"/>
      <text x="-16" y="0" font-size="18" font-weight="700" fill="#7A5AA8">초월</text>
    </g>
    <g transform="translate(0 46)">
      <rect x="-150" y="-22" width="150" height="34" rx="17" fill="#FFFFFF" opacity="0.82"/>
      <path d="${STAR4}" fill="#FFC83A" transform="translate(-130 -5) scale(2.6)"/>
      <text x="-16" y="0" font-size="18" font-weight="700" fill="#A07A1E">전설</text>
    </g>
  </g>`;

// ── 합성 ──────────────────────────────────────────────────
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${defs}</defs>
  <rect width="${W}" height="${H}" fill="url(#og-sky)"/>
  <circle cx="980" cy="150" r="260" fill="url(#og-sun)"/>
  ${skyMotes}
  ${hills}
  ${soil}
  ${back}
  ${heroes}
  ${text}
  ${legend}
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="20" fill="none" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="2"/>
</svg>`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg, 'utf8');
console.log('✓ OG 카드 생성:', OUT, `(${(svg.length / 1024).toFixed(1)} KB)`);
