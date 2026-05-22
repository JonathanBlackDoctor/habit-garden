import { useState } from 'react';
import { motion } from 'framer-motion';
import { useProgress, useGardenActions } from '@/features/garden/useGarden';
import PlantSVG from '@/features/garden/PlantSVG';
import { PLANT_SPECIES, POINT_PRICES } from 'shared/types/firestore';
import type { PlantInstance, PlantSpecies } from 'shared/types/firestore';
import { Button } from '@/components/ui/button';
import { Leaf, Droplets, Lock, Sprout, Snowflake, Wheat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFreezeTokens } from '@/features/freeze/useFreezeTokens';

// 상점 정렬 순서
const RARITY_ORDER: Record<PlantSpecies['rarity'], number> = { basic: 0, common: 1, rare: 2, epic: 3 };

const RARITY_META: Record<PlantSpecies['rarity'], { label: string; chip: string }> = {
  basic:  { label: '기본', chip: 'bg-[var(--leaf-soft)] text-[var(--fg-muted)]' },
  common: { label: '일반', chip: 'bg-[#DCEEDB] text-[#3A6E2D]' },
  rare:   { label: '희귀', chip: 'bg-[#E5DCF2] text-[#6B4A8C]' },
  epic:   { label: '에픽', chip: 'bg-gradient-to-r from-[#FFE4B0] to-[#FFB8E8] text-[#7A4FA0] font-semibold' },
};

function healthVibe(h: number): { label: string; bar: string; chip: string } {
  if (h <= 30) return { label: '정원이 시들고 있어요', bar: 'bg-[#D9544A]', chip: 'text-[#A83A30]' };
  if (h <= 70) return { label: '생기를 회복하세요',     bar: 'bg-[#E8B544]', chip: 'text-[#A07A1E]' };
  return       { label: '활기찬 정원',                  bar: 'bg-[var(--leaf)]', chip: 'text-[var(--leaf-strong,var(--leaf))]' };
}

export default function Garden() {
  const progress = useProgress();
  const { plantSeed, waterPlant, unlockSpecies, harvestPlant } = useGardenActions();
  const freeze = useFreezeTokens();
  const [selected, setSelected] = useState<PlantInstance | null>(null);
  const [showShop, setShowShop] = useState(false);

  if (!progress) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-[var(--fg-faint)]">정원을 불러오는 중…</div>
      </div>
    );
  }

  const { gardenState, spendablePoints } = progress;
  const plants = gardenState.plants;
  const vibe = healthVibe(gardenState.health ?? 100);

  return (
    <div className="min-h-screen p-4 space-y-4 pb-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--fg-primary)]">나의 정원</h2>
          <p className="text-xs text-[var(--fg-muted)] tabular-nums">
            생기 {gardenState.health}/100 · ✦{spendablePoints}P
          </p>
        </div>
        <button
          onClick={() => setShowShop(!showShop)}
          className="flex items-center gap-1.5 rounded-full bg-[var(--bloom-soft)] px-3 py-1.5 text-xs font-medium text-[var(--bloom)]"
        >
          <Leaf size={13} />
          상점
        </button>
      </div>

      {/* 정원 생기 바 */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className={cn('font-medium', vibe.chip)}>{vibe.label}</span>
          <span className="text-[var(--fg-muted)] tabular-nums">{gardenState.health}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--leaf-soft)]">
          <div
            className={cn('h-full rounded-full transition-all', vibe.bar)}
            style={{ width: `${gardenState.health}%` }}
          />
        </div>
      </div>

      {/* 정원 뷰 */}
      <div
        className="relative rounded-[var(--radius-lg)] bg-gradient-to-b from-[#E8F5D8] to-[var(--leaf-soft)] p-4 min-h-[240px] flex flex-wrap items-end gap-3 justify-center"
        style={{ boxShadow: 'inset 0 -4px 8px rgba(79,122,55,0.08)' }}
      >
        {/* 흙 배경 */}
        <div className="absolute bottom-0 left-0 right-0 h-8 rounded-b-[var(--radius-lg)] bg-[var(--soil)] opacity-20" />

        {plants.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-[var(--fg-faint)] py-8 w-full">
            <Sprout size={32} className="text-[var(--leaf-soft)]" opacity={0.6} />
            <p className="text-sm">씨앗을 심어 정원을 시작하세요!</p>
          </div>
        )}

        {plants.map((plant) => {
          const isSelected = selected?.id === plant.id;
          const sp = PLANT_SPECIES.find((s) => s.id === plant.speciesId);
          return (
            <motion.button
              key={plant.id}
              whileTap={{ scale: 0.95 }}
              animate={{ scale: isSelected ? 1.08 : 1 }}
              onClick={() => setSelected(isSelected ? null : plant)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg p-1 transition-all',
                isSelected && 'ring-2 ring-[var(--leaf)] ring-offset-1'
              )}
            >
              <PlantSVG
                speciesId={plant.speciesId}
                stage={plant.stage}
                withered={!!plant.witheredSince}
                rarity={sp?.rarity}
                size={68}
              />
              <span className="text-[10px] text-[var(--fg-muted)] tabular-nums">Lv{plant.stage}</span>
            </motion.button>
          );
        })}
      </div>

      {/* 선택된 식물 액션 */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4 space-y-3"
        >
          {(() => {
            const sp = PLANT_SPECIES.find((s) => s.id === selected.speciesId);
            const maxStage = (sp?.stages ?? 4) - 1;
            const isFull = selected.stage >= maxStage;
            const baseYield = sp?.harvestYield ?? 10;
            const rarityBonus = (sp?.rarity === 'rare' || sp?.rarity === 'epic') ? POINT_PRICES.HARVEST_BONUS_RARE : 0;
            const streakBonus = (sp?.trait?.kind === 'streakSync' && (progress.prayerStreak ?? 0) > 0)
              ? Math.round(baseYield * 0.5) : 0;
            const totalYield = baseYield + rarityBonus + streakBonus;
            return (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[var(--fg-primary)]">{sp?.name ?? selected.speciesId}</p>
                      {sp && (
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px]', RARITY_META[sp.rarity].chip)}>
                          {RARITY_META[sp.rarity].label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--fg-muted)] tabular-nums">
                      {selected.stage}/{maxStage} 단계
                      {selected.witheredSince && ' · 🍂 시듦'}
                    </p>
                    {sp?.description && (
                      <p className="mt-1 text-[11px] text-[var(--fg-faint)]">{sp.description}</p>
                    )}
                  </div>
                  <PlantSVG speciesId={selected.speciesId} stage={selected.stage} withered={!!selected.witheredSince} rarity={sp?.rarity} size={52} />
                </div>
                {isFull ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={async () => { await harvestPlant(selected.id); setSelected(null); }}
                    className="w-full gap-2 bg-[var(--bloom)] hover:opacity-90"
                  >
                    <Wheat size={15} />
                    수확하기 (+{totalYield}P{streakBonus ? ' ✨' : ''})
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => waterPlant(selected.id)}
                    className="w-full gap-2"
                  >
                    <Droplets size={15} />
                    물주기 (20P)
                  </Button>
                )}
              </>
            );
          })()}
        </motion.div>
      )}

      {/* Freeze 토큰 카드 (Phase 4-3) */}
      <div className="card p-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E5F0F8] text-[#3A6EA5]">
          <Snowflake size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--fg-primary)]">스트릭 보호 토큰</p>
          <p className="text-xs text-[var(--fg-muted)] tabular-nums">보유 {freeze.count}개 · 1개={freeze.price}P</p>
        </div>
        <Button size="sm" variant="secondary" onClick={freeze.buyOne}>구매</Button>
      </div>

      {/* 상점 */}
      {showShop && (
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">씨앗 심기 / 식물 해금</h3>
          <p className="text-[11px] text-[var(--fg-faint)]">
            희귀 이상은 수확 시 +{POINT_PRICES.HARVEST_BONUS_RARE}P 보너스. 심을 때 10% 확률로 한 등급 위 씨앗 발견.
          </p>
          <div className="space-y-2">
            {[...PLANT_SPECIES].sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.unlockCost - b.unlockCost).map((sp) => {
              const unlocked = gardenState.unlockedSpecies.includes(sp.id);
              const meta = RARITY_META[sp.rarity];
              return (
                <div key={sp.id} className="flex items-center gap-3 rounded-lg border border-[var(--leaf-soft)] bg-white/60 p-2">
                  <PlantSVG speciesId={sp.id} stage={3} size={44} rarity={sp.rarity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-[var(--fg-primary)]">{sp.name}</p>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', meta.chip)}>
                        {meta.label}
                      </span>
                    </div>
                    {sp.description && (
                      <p className="text-[11px] text-[var(--fg-muted)] truncate">{sp.description}</p>
                    )}
                    {sp.harvestYield !== undefined && (
                      <p className="text-[10px] text-[var(--fg-faint)] tabular-nums">
                        수확 +{sp.harvestYield}P · 만개 {sp.stages - 1}단계
                      </p>
                    )}
                  </div>
                  {unlocked ? (
                    <Button size="sm" variant="secondary" onClick={() => plantSeed(sp.id)}>
                      심기 (50P)
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => unlockSpecies(sp.id)} className="gap-1">
                      <Lock size={12} />
                      {sp.unlockCost}P
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
