import type { CSSProperties } from 'react';

export interface TranscendAtmosphereProps {
  hasCelestial: boolean;
  hasEternal: boolean;
  hasGalaxy: boolean;
  activeCount: number;
}

// 단일 종 테마 하늘 그라디언트 (activeCount === 1)
const SKY_THEME: Record<'celestial' | 'eternal' | 'galaxy', string> = {
  // 천상수 — 황금 석양
  celestial:
    'linear-gradient(to bottom, #F8D77A 0%, #F6B560 42%, #F0C98E 100%)',
  // 영겁화 — 벚꽃 드림 파스텔
  eternal:
    'linear-gradient(to bottom, #FBD3EC 0%, #E9C6F2 48%, #F3E0F5 100%)',
  // 은하백합 — 깊은 밤하늘
  galaxy:
    'linear-gradient(to bottom, #1B1A40 0%, #2E2A66 50%, #4A3A7A 100%)',
};

// 2종 이상 — 우주 공간
const COSMIC_SKY =
  'radial-gradient(140% 90% at 50% 0%, #3A2A6E 0%, #241F52 45%, #15123A 100%)';

const PILLARS = [
  { left: '12%', w: 26, delay: '0s', dur: '7s' },
  { left: '30%', w: 34, delay: '1.8s', dur: '9s' },
  { left: '52%', w: 22, delay: '0.9s', dur: '8s' },
  { left: '70%', w: 30, delay: '2.6s', dur: '7.5s' },
  { left: '86%', w: 24, delay: '1.2s', dur: '8.5s' },
];

const PETALS = [
  { left: '8%', delay: '0s', dur: '9s', c: '#FFB8E8' },
  { left: '20%', delay: '2.2s', dur: '11s', c: '#C9A0FF' },
  { left: '34%', delay: '4.5s', dur: '10s', c: '#FFCDEB' },
  { left: '48%', delay: '1.1s', dur: '12s', c: '#D7B6FF' },
  { left: '60%', delay: '3.4s', dur: '9.5s', c: '#FFB8E8' },
  { left: '74%', delay: '5.2s', dur: '11.5s', c: '#C9A0FF' },
  { left: '88%', delay: '0.6s', dur: '10.5s', c: '#FFCDEB' },
];

const STARS = [
  { left: '10%', top: '14%', s: 2, delay: '0s', dur: '3.2s' },
  { left: '22%', top: '30%', s: 1.5, delay: '1.4s', dur: '4s' },
  { left: '36%', top: '10%', s: 2.5, delay: '0.7s', dur: '3.6s' },
  { left: '48%', top: '24%', s: 1.5, delay: '2.1s', dur: '4.4s' },
  { left: '58%', top: '12%', s: 2, delay: '1.0s', dur: '3.4s' },
  { left: '68%', top: '32%', s: 1.5, delay: '2.8s', dur: '4.2s' },
  { left: '78%', top: '16%', s: 2.5, delay: '0.4s', dur: '3.8s' },
  { left: '88%', top: '28%', s: 1.5, delay: '1.7s', dur: '4.6s' },
  { left: '15%', top: '44%', s: 1.5, delay: '3.1s', dur: '4s' },
  { left: '44%', top: '40%', s: 2, delay: '0.9s', dur: '3.5s' },
  { left: '64%', top: '46%', s: 1.5, delay: '2.4s', dur: '4.3s' },
  { left: '82%', top: '42%', s: 2, delay: '1.3s', dur: '3.7s' },
];

const SHOOTS = [
  { left: '20%', top: '8%', delay: '2s', dur: '7s' },
  { left: '64%', top: '4%', delay: '5.5s', dur: '9s' },
];

export default function TranscendAtmosphere({
  hasCelestial,
  hasEternal,
  hasGalaxy,
  activeCount,
}: TranscendAtmosphereProps) {
  if (activeCount === 0) return null;

  const skyBg =
    activeCount >= 2
      ? COSMIC_SKY
      : hasGalaxy
        ? SKY_THEME.galaxy
        : hasEternal
          ? SKY_THEME.eternal
          : SKY_THEME.celestial;

  return (
    <>
      {/* 테마 하늘 — 기존 bed 배경 위로 크로스페이드 */}
      <div
        className="transcend-sky pointer-events-none absolute inset-0 z-0 rounded-[var(--radius-lg)]"
        style={{ background: skyBg, opacity: 0.82 }}
        aria-hidden
      />

      {/* 공통 오로라 앰비언트 */}
      <div
        className="transcend-ambient pointer-events-none absolute inset-0 z-0 rounded-[var(--radius-lg)]"
        aria-hidden
      />

      {/* 천상수 — 황금 광기둥 */}
      {hasCelestial && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[var(--radius-lg)]" aria-hidden>
          {PILLARS.map((p, i) => (
            <span
              key={i}
              className="transcend-pillar absolute top-0 h-full"
              style={
                {
                  left: p.left,
                  width: p.w,
                  background:
                    'linear-gradient(to bottom, rgba(255,238,170,0.55) 0%, rgba(255,224,130,0.18) 55%, transparent 100%)',
                  animationDelay: p.delay,
                  animationDuration: p.dur,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* 영겁화 — 꽃잎 비 */}
      {hasEternal && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[var(--radius-lg)]" aria-hidden>
          {PETALS.map((p, i) => (
            <span
              key={i}
              className="transcend-petal absolute -top-3"
              style={
                {
                  left: p.left,
                  background: p.c,
                  animationDelay: p.delay,
                  animationDuration: p.dur,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* 은하백합 — 별빛 필드 + 유성 */}
      {hasGalaxy && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[var(--radius-lg)]" aria-hidden>
          {STARS.map((p, i) => (
            <span
              key={i}
              className="transcend-star absolute rounded-full bg-white"
              style={
                {
                  left: p.left,
                  top: p.top,
                  width: p.s,
                  height: p.s,
                  animationDelay: p.delay,
                  animationDuration: p.dur,
                } as CSSProperties
              }
            />
          ))}
          {SHOOTS.map((p, i) => (
            <span
              key={`shoot-${i}`}
              className="transcend-shoot absolute"
              style={
                {
                  left: p.left,
                  top: p.top,
                  animationDelay: p.delay,
                  animationDuration: p.dur,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
