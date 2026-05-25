/**
 * PlantCodex — 식물 도감 (Plant Codex)
 *
 * 발견(unlock 또는 첫 심기)한 종은 컬러 + 누적 수확 횟수 + ★ (5/15/30회)
 * 미발견은 실루엣 + "?" 라벨
 *
 * 25/25 완성 시 codex_complete 배지 + 5000P + 황금 트로피 데코 (서버 자동 부여).
 */
import { motion } from 'framer-motion';
import { PLANT_SPECIES, type PlantSpecies } from 'shared/types/firestore';
import type { ProgressDoc } from 'shared/types/firestore';
import PlantSVG from './PlantSVG';
import { cn } from '@/lib/utils';

const RARITY_ORDER: Record<PlantSpecies['rarity'], number> = {
  basic: 0, common: 1, rare: 2, epic: 3, legendary: 4, transcendent: 5,
};

const RARITY_CHIP: Record<PlantSpecies['rarity'], string> = {
  basic:        'bg-[var(--leaf-soft)] text-[var(--fg-muted)]',
  common:       'bg-[#DCEEDB] text-[#3A6E2D]',
  rare:         'bg-[#E5DCF2] text-[#6B4A8C]',
  epic:         'bg-gradient-to-r from-[#FFE4B0] to-[#FFB8E8] text-[#7A4FA0]',
  legendary:    'bg-gradient-to-r from-[#FFD44A] via-[#FFB8E8] to-[#80E0FF] text-[#5A3E1E] font-bold',
  transcendent: 'transcend-chip text-white font-bold',
};

const RARITY_LABEL: Record<PlantSpecies['rarity'], string> = {
  basic: '기본', common: '일반', rare: '희귀', epic: '에픽', legendary: '전설', transcendent: '초월',
};

function starsFor(count: number): string {
  if (count >= 30) return '★★★';
  if (count >= 15) return '★★';
  if (count >= 5)  return '★';
  return '';
}

export default function PlantCodex({ progress }: { progress: ProgressDoc }) {
  const codex = progress.gardenStats?.codexEntries ?? [];
  const harvests = progress.gardenStats?.harvestsBySpecies ?? {};
  const unlocked = new Set(progress.gardenState?.unlockedSpecies ?? []);
  const discovered = new Set(codex);

  const sorted = [...PLANT_SPECIES].sort(
    (a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.unlockCost - b.unlockCost,
  );
  // 초월(transcendent)은 별도 프레스티지 티어 — 도감 완성 집계에서 제외하고 따로 보여준다.
  const normalSpecies = sorted.filter((sp) => sp.rarity !== 'transcendent');
  const transcendentSpecies = sorted.filter((sp) => sp.rarity === 'transcendent');

  const discoveredCount = normalSpecies.filter((sp) => discovered.has(sp.id)).length;
  const totalCount = normalSpecies.length;
  const percent = Math.round((discoveredCount / totalCount) * 100);

  return (
    <div className="card p-4 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--fg-primary)]">식물 도감</h3>
        <span className="text-xs text-[var(--fg-muted)] tabular-nums">
          {discoveredCount} / {totalCount} ({percent}%)
        </span>
      </div>

      {/* 진척바 */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--leaf-soft)]">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            percent === 100
              ? 'bg-gradient-to-r from-[#FFD44A] via-[#FFB8E8] to-[#80E0FF]'
              : 'bg-[var(--leaf)]',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* 완성 시 메시지 */}
      {percent === 100 && (
        <p className="text-center text-xs font-medium text-[var(--bloom)]">
          🏆 모든 식물을 발견했어요! 생명의 정원 배지 획득!
        </p>
      )}

      {/* 5×5 그리드 */}
      <div className="grid grid-cols-5 gap-2">
        {normalSpecies.map((sp) => {
          const isDiscovered = discovered.has(sp.id);
          const isUnlocked = unlocked.has(sp.id);
          const count = harvests[sp.id] ?? 0;
          const stars = starsFor(count);
          return (
            <motion.div
              key={sp.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-all',
                isDiscovered
                  ? 'border-[var(--leaf-soft)] bg-white/80'
                  : 'border-dashed border-[var(--fg-faint)] bg-[var(--leaf-soft)]/30 opacity-60',
              )}
              title={isDiscovered ? sp.name : '미발견'}
            >
              {/* 식물 SVG (미발견은 어둡게) */}
              <div className={cn('relative', !isDiscovered && 'grayscale opacity-30')}>
                <PlantSVG
                  speciesId={sp.id}
                  stage={isDiscovered ? Math.max(3, sp.stages - 1) : 2}
                  rarity={sp.rarity}
                  size={42}
                  decorative={false}
                />
                {!isDiscovered && (
                  <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[var(--fg-faint)]">
                    ?
                  </div>
                )}
              </div>

              {/* 이름 (미발견은 ???) */}
              <p className="text-[10px] font-medium leading-tight text-[var(--fg-primary)] line-clamp-1">
                {isDiscovered ? sp.name : '???'}
              </p>

              {/* 등급 칩 */}
              <span className={cn('rounded-full px-1 text-[8px]', RARITY_CHIP[sp.rarity])}>
                {RARITY_LABEL[sp.rarity]}
              </span>

              {/* ★ 마일스톤 + 수확 카운트 */}
              {isDiscovered && count > 0 && (
                <div className="absolute right-1 top-1 flex flex-col items-end">
                  {stars && (
                    <span className="text-[9px] leading-none text-[#FFD44A]">{stars}</span>
                  )}
                  <span className="text-[8px] leading-none text-[var(--fg-faint)] tabular-nums">×{count}</span>
                </div>
              )}

              {/* 미해금 잠금 표시 */}
              {isDiscovered && !isUnlocked && (
                <div className="absolute left-1 top-1 text-[9px]">🔒</div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 초월 (프레스티지) — 도감 완성과 무관한 별도 티어 */}
      {transcendentSpecies.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold transcend-text">✦ 초월 — 보유·유지 자체가 의미인 식물</p>
          <div className="grid grid-cols-3 gap-2">
            {transcendentSpecies.map((sp) => {
              const isUnlocked = unlocked.has(sp.id);
              return (
                <motion.div
                  key={sp.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    'relative flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-all',
                    isUnlocked
                      ? 'border-[#C9A0FF] bg-white/80'
                      : 'border-dashed border-[var(--fg-faint)] bg-[var(--leaf-soft)]/30 opacity-60',
                  )}
                  title={isUnlocked ? sp.name : '미해금'}
                >
                  <div className={cn('relative', !isUnlocked && 'grayscale opacity-30')}>
                    <PlantSVG
                      speciesId={sp.id}
                      stage={isUnlocked ? Math.max(3, sp.stages - 1) : 2}
                      rarity={sp.rarity}
                      size={48}
                      decorative={false}
                    />
                    {!isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[var(--fg-faint)]">
                        ?
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-medium leading-tight text-[var(--fg-primary)] line-clamp-1">
                    {isUnlocked ? sp.name : '???'}
                  </p>
                  <span className={cn('rounded-full px-1 text-[8px]', RARITY_CHIP[sp.rarity])}>
                    {RARITY_LABEL[sp.rarity]}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* 마일스톤 가이드 */}
      <div className="rounded-md bg-[var(--leaf-soft)]/40 p-2 text-[10px] leading-relaxed text-[var(--fg-muted)]">
        <p>★ 마일스톤: 같은 종 5회 = ★1, 15회 = ★2, 30회 = ★3 (수확량 영구 +10%)</p>
        <p>💡 미발견 식물은 상점에서 해금하거나 희귀 드롭으로 발견 가능</p>
      </div>
    </div>
  );
}
