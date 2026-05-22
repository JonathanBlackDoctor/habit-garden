/**
 * PlantSVG 내부에서 사용하는 재사용 <defs> 컴포넌트.
 * useId() 기반 prefix를 받아 인스턴스마다 유니크한 그라데이션 ID를 생성.
 *
 * 노출 ID:
 *  - {prefix}-leaf:        잎 표면 → 그늘 2단 선형 그라데이션
 *  - {prefix}-stem-shadow: 줄기 그림자 라인용 그라데이션
 *  - {prefix}-pot:         화분/흙 라디얼 그라데이션
 *  - {prefix}-flower:      꽃 중심 광택 (radial)
 */

export interface PlantDefsProps {
  idPrefix: string;
  col: string;
  accent: string;
  withered?: boolean;
}

export function PlantDefs({ idPrefix, col, accent, withered }: PlantDefsProps) {
  const leafTop = withered ? '#D1C4A8' : col;
  const leafBottom = withered ? '#A89878' : darken(col, 0.22);
  const flowerCore = withered ? '#D1C4A8' : lighten(accent, 0.25);
  const flowerEdge = withered ? '#C7B68A' : accent;

  return (
    <defs>
      <linearGradient id={`${idPrefix}-leaf`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor={leafTop}    stopOpacity="1" />
        <stop offset="100%" stopColor={leafBottom} stopOpacity="1" />
      </linearGradient>
      <linearGradient id={`${idPrefix}-stem-shadow`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor={leafBottom} stopOpacity="0" />
        <stop offset="50%"  stopColor={leafBottom} stopOpacity="0.45" />
        <stop offset="100%" stopColor={leafBottom} stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${idPrefix}-pot`} cx="50%" cy="35%" r="65%">
        <stop offset="0%"   stopColor={withered ? '#D1C4A8' : '#B59B7A'} />
        <stop offset="100%" stopColor={withered ? '#A89878' : '#7A5A3A'} />
      </radialGradient>
      <radialGradient id={`${idPrefix}-flower`} cx="50%" cy="40%" r="60%">
        <stop offset="0%"   stopColor={flowerCore} stopOpacity="0.95" />
        <stop offset="100%" stopColor={flowerEdge} stopOpacity="0.95" />
      </radialGradient>
    </defs>
  );
}

// ── 색상 변환 유틸 ─────────────────────────────────────────
function clamp(n: number) { return Math.max(0, Math.min(255, n)); }
function toHex(n: number) { return clamp(Math.round(n)).toString(16).padStart(2, '0'); }

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return null;
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

export function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb.map((c) => c * (1 - amount));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb.map((c) => c + (255 - c) * amount);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
