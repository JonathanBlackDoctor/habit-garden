/**
 * PlantSVG — 종 × stage별 벡터 식물 렌더러
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
 *  - 연약 전설(crystal_rose/starlight_lily/aurora_orchid/golden_peony/dawn_lily):
 *      그라데이션·다층 꽃잎·애니메이션으로 화려하게
 *  - 희귀 이상은 stage>=3 부터 글로우 효과 (전설은 12px 골드 글로우 + 별 반짝)
 */
import { cn } from '@/lib/utils';

type Rarity = 'basic' | 'common' | 'rare' | 'epic' | 'legendary';

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
  const showGlow = !withered && (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') && s >= 2;
  const glowRadius = rarity === 'legendary' ? 12 : rarity === 'epic' ? 8 : 5;
  // legendary 는 무지개 글로우 (단색 대신 골드 톤)
  const glowColor = rarity === 'legendary' ? '#FFD44A' : accent;

  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className={cn('transition-all duration-500', className)}
      aria-label={`${speciesId} stage ${stage}`}
      style={showGlow ? { filter: `drop-shadow(0 0 ${glowRadius}px ${glowColor})` } : undefined}
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

      {/* 에픽/전설 만개 시 별 반짝 — 전설은 더 화려하게 */}
      {!withered && (rarity === 'epic' || rarity === 'legendary') && s >= 3 && (
        <g opacity={rarity === 'legendary' ? 1 : 0.9}>
          <text x="14" y="22" fontSize="10" fill="#FFD44A">✦</text>
          <text x="60" y="18" fontSize="8"  fill="#FFB8E8">✦</text>
          <text x="58" y="50" fontSize="7"  fill="#FFD44A">✧</text>
          {rarity === 'legendary' && (
            <>
              <text x="10" y="50" fontSize="9" fill="#FFB8E8">✦</text>
              <text x="68" y="35" fontSize="9" fill="#FFD44A">✧</text>
              <text x="40" y="10" fontSize="7" fill="#FFFFFF">✺</text>
            </>
          )}
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

  // 생명나무: 굵은 줄기 + 큰 둥근 잎 덩어리 (위로 갈수록 커짐)
  if (speciesId === 'tree_of_life') {
    return (
      <>
        <rect x="36" y={stage >= 2 ? 32 : 50} width="8" height={stage >= 2 ? 36 : 18} rx="2"
              fill="#7C4A1E" opacity="0.95" />
        {stage >= 2 && (
          <>
            <circle cx="40" cy="30" r="14" fill={col} opacity="0.85" />
            <circle cx="28" cy="38" r="9"  fill={col} opacity="0.78" />
            <circle cx="52" cy="38" r="9"  fill={col} opacity="0.78" />
            <circle cx="40" cy="20" r="8"  fill={col} opacity="0.88" />
          </>
        )}
      </>
    );
  }

  // 소나무·고사리: 가는 잎이 깃털처럼
  if (speciesId === 'pine' || speciesId === 'fern') {
    return (
      <>
        <line x1="40" y1="68" x2="40" y2={stage >= 2 ? 28 : 50}
              stroke={col} strokeWidth="3" strokeLinecap="round" />
        {[58, 50, 42, 34].slice(0, stage + 1).map((y, i) => (
          <g key={i}>
            <line x1="40" y1={y} x2={40 - 12} y2={y - 3} stroke={col} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1={y} x2={40 + 12} y2={y - 3} stroke={col} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ))}
      </>
    );
  }

  // 이끼: 낮고 옆으로 퍼지는 덩어리
  if (speciesId === 'moss') {
    return (
      <>
        <ellipse cx="40" cy="66" rx="18" ry="5" fill={col} opacity="0.9" />
        {stage >= 1 && <ellipse cx="32" cy="62" rx="8" ry="4" fill={col} opacity="0.85" />}
        {stage >= 1 && <ellipse cx="50" cy="62" rx="8" ry="4" fill={col} opacity="0.85" />}
      </>
    );
  }

  // 기본 (sprout/sunflower/herb/maple/lotus/clover/rose/orchid/cosmos/등)
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

  // 민들레: 흰 솜털 (씨앗 머리)
  if (speciesId === 'dandelion') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="40" cy="24" r="10" fill="#FFFFFF" opacity="0.9" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line key={deg} x1="40" y1="24" x2={40 + 9 * Math.cos((deg * Math.PI) / 180)}
                y2={24 + 9 * Math.sin((deg * Math.PI) / 180)} stroke="#FFFFFF" strokeWidth="1.5" />
        ))}
        <circle cx="40" cy="24" r="3" fill={c} opacity="0.8" />
      </g>
    );
  }

  // 튤립: 잔 모양
  if (speciesId === 'tulip') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <path d="M30 28 Q30 16 40 14 Q50 16 50 28 Z" fill={c} opacity="0.92" />
        <path d="M40 14 Q40 22 35 28 M40 14 Q40 22 45 28" stroke={withered ? '#C7B68A' : '#FFFFFF'} strokeWidth="0.8" opacity="0.4" fill="none" />
      </g>
    );
  }

  // 데이지: 흰 꽃잎 5장 + 노란 중심
  if (speciesId === 'daisy') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="2.5" strokeLinecap="round" />
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse key={deg} cx="40" cy="18" rx="3" ry="7" fill={c} opacity="0.92"
                   transform={`rotate(${deg} 40 26)`} />
        ))}
        <circle cx="40" cy="26" r="3" fill="#FFD44A" />
      </g>
    );
  }

  // 민트: 작은 잎 다발 (꽃 없이)
  if (speciesId === 'mint') {
    return (
      <g>
        <ellipse cx="32" cy="30" rx="6" ry="3" fill={c} opacity="0.88" transform="rotate(-25 32 30)" />
        <ellipse cx="48" cy="28" rx="6" ry="3" fill={c} opacity="0.88" transform="rotate(25 48 28)" />
        <ellipse cx="40" cy="22" rx="5" ry="3" fill={c} opacity="0.9" />
      </g>
    );
  }

  // 카네이션: 주름진 꽃잎
  if (speciesId === 'carnation') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <circle cx="36" cy="24" r="6" fill={c} opacity="0.85" />
        <circle cx="44" cy="24" r="6" fill={c} opacity="0.85" />
        <circle cx="40" cy="20" r="6" fill={c} opacity="0.9" />
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
          <circle key={i} cx={cx} cy={cy} r="3.5" fill={c} opacity="0.85" />
        ))}
      </g>
    );
  }

  // 반딧불꽃: 빛 점이 박힌 꽃 (작은 점들)
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

  // 무지개붓꽃: 위아래로 흐르는 꽃잎, 그라데이션 느낌
  if (speciesId === 'rainbow_iris') {
    return (
      <g>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="34" cy="24" rx="5" ry="10" fill={withered ? '#C7B68A' : '#FF80A0'} opacity="0.85" transform="rotate(-20 34 24)" />
        <ellipse cx="46" cy="24" rx="5" ry="10" fill={withered ? '#C7B68A' : '#FFD44A'} opacity="0.85" transform="rotate(20 46 24)" />
        <ellipse cx="40" cy="18" rx="5" ry="11" fill={withered ? '#C7B68A' : '#80E0FF'} opacity="0.88" />
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

  // 생명나무: 큰 빛 구체 (이미 stemAndLeaves 에서 큰 잎. 여기서 빛만)
  if (speciesId === 'tree_of_life') {
    return (
      <g>
        <circle cx="40" cy="24" r="6" fill={withered ? '#D1C4A8' : '#FFE066'} opacity="0.95">
          <animate attributeName="r" values="6;7;6" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="40" cy="24" r="3" fill="#FFFFFF" opacity="0.7" />
      </g>
    );
  }

  // ── 연약 전설 5종 (화려하지만 게을러지면 죽는) ──────────────

  // 수정장미: 각진 수정 꽃잎 + 중앙 보석 (핑크→흰빛 그라데이션)
  if (speciesId === 'crystal_rose') {
    return (
      <g>
        <defs>
          <radialGradient id="grad-crystal-rose" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#FF9AD0" />
            <stop offset="100%" stopColor="#C0418F" />
          </radialGradient>
        </defs>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <polygon key={deg} points="40,8 36,22 40,26 44,22"
                   fill={withered ? c : 'url(#grad-crystal-rose)'} opacity="0.9"
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

  // 별빛백합: 6장 백합 꽃잎 + 빛나는 별 코어 + 반짝이는 별 입자 (남보라→흰빛)
  if (speciesId === 'starlight_lily') {
    return (
      <g>
        <defs>
          <radialGradient id="grad-starlight-lily" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#A9C0FF" />
            <stop offset="100%" stopColor="#4A4F9E" />
          </radialGradient>
        </defs>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={deg} cx="40" cy="14" rx="3.5" ry="11"
                   fill={withered ? c : 'url(#grad-starlight-lily)'} opacity="0.92"
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

  // 오로라난초: 흐르는 난초 꽃잎 (핑크→보라→시안 오로라 그라데이션)
  if (speciesId === 'aurora_orchid') {
    return (
      <g>
        <defs>
          <linearGradient id="grad-aurora-orchid" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF8AD0" />
            <stop offset="50%" stopColor="#9A7BFF" />
            <stop offset="100%" stopColor="#6FE6E0" />
          </linearGradient>
        </defs>
        <line x1="40" y1="38" x2="40" y2="28" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="30" cy="22" rx="7" ry="11" fill={withered ? c : 'url(#grad-aurora-orchid)'} opacity="0.9" transform="rotate(-30 30 22)" />
        <ellipse cx="50" cy="22" rx="7" ry="11" fill={withered ? c : 'url(#grad-aurora-orchid)'} opacity="0.9" transform="rotate(30 50 22)" />
        <ellipse cx="40" cy="16" rx="6" ry="11" fill={withered ? c : 'url(#grad-aurora-orchid)'} opacity="0.92" />
        <ellipse cx="34" cy="28" rx="5" ry="8" fill={withered ? c : 'url(#grad-aurora-orchid)'} opacity="0.85" transform="rotate(-15 34 28)" />
        <ellipse cx="46" cy="28" rx="5" ry="8" fill={withered ? c : 'url(#grad-aurora-orchid)'} opacity="0.85" transform="rotate(15 46 28)" />
        <circle cx="40" cy="24" r="3" fill={withered ? '#D1C4A8' : '#FFFFFF'} opacity="0.9">
          {!withered && <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.5s" repeatCount="indefinite" />}
        </circle>
      </g>
    );
  }

  // 황금모란: 겹겹 황금 꽃잎 (안팎 2겹) + 밝은 중심
  if (speciesId === 'golden_peony') {
    return (
      <g>
        <defs>
          <radialGradient id="grad-golden-peony" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#FFF3C0" />
            <stop offset="55%" stopColor="#FFD24A" />
            <stop offset="100%" stopColor="#E0902A" />
          </radialGradient>
        </defs>
        <line x1="40" y1="38" x2="40" y2="30" stroke={stem} strokeWidth="3" strokeLinecap="round" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <ellipse key={`o${deg}`} cx="40" cy="14" rx="5" ry="9"
                   fill={withered ? c : 'url(#grad-golden-peony)'} opacity="0.85"
                   transform={`rotate(${deg} 40 24)`} />
        ))}
        {[22, 67, 112, 157, 202, 247, 292, 337].map((deg) => (
          <ellipse key={`i${deg}`} cx="40" cy="18" rx="3.5" ry="6"
                   fill={withered ? c : 'url(#grad-golden-peony)'} opacity="0.95"
                   transform={`rotate(${deg} 40 24)`} />
        ))}
        <circle cx="40" cy="24" r="3.5" fill={withered ? '#D1C4A8' : '#FFF8D8'} opacity="0.95" />
      </g>
    );
  }

  // 여명백합: 빛줄기 + 6장 꽃잎 + 맥동하는 빛 코어 (흰→복숭아→장미빛)
  if (speciesId === 'dawn_lily') {
    return (
      <g>
        <defs>
          <radialGradient id="grad-dawn-lily" cx="50%" cy="45%" r="65%">
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
                   fill={withered ? c : 'url(#grad-dawn-lily)'} opacity="0.92"
                   transform={`rotate(${deg} 40 24)`} />
        ))}
        <circle cx="40" cy="24" r="5" fill={withered ? '#D1C4A8' : '#FFFBEA'} opacity="0.95">
          {!withered && <animate attributeName="r" values="5;6;5" dur="2.8s" repeatCount="indefinite" />}
        </circle>
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
  // 만개해도 추가 꽃송이 없는 종: 선인장, 이끼, 민트, 소나무, 고사리, 생명나무, 대나무
  const NO_BLOOM_OVERLAY = new Set([
    'cactus', 'moss', 'mint', 'pine', 'fern', 'tree_of_life', 'bamboo',
    // 연약 전설: 자체 디자인이 화려하므로 일반 보조 꽃송이 미적용
    'crystal_rose', 'starlight_lily', 'aurora_orchid', 'golden_peony', 'dawn_lily',
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
    // 기존 11종
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
    // 신규 14종
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
    // 연약 전설 5종 (줄기·잎)
    crystal_rose:   '#5A8C3E',
    starlight_lily: '#4A5E8C',
    aurora_orchid:  '#5A7A8C',
    golden_peony:   '#5A8C3E',
    dawn_lily:      '#6A8C4E',
  };
  return map[speciesId] ?? '#4F7A37';
}

function getAccent(speciesId: string): string {
  const map: Record<string, string> = {
    // 기존 11종
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
    // 신규 14종
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
    // 연약 전설 5종 (보조 꽃송이·상단 액센트 색)
    crystal_rose:   '#FF8AD0',
    starlight_lily: '#A9C0FF',
    aurora_orchid:  '#9A7BFF',
    golden_peony:   '#FFD24A',
    dawn_lily:      '#FF9E7A',
  };
  return map[speciesId] ?? '#A8D08D';
}
