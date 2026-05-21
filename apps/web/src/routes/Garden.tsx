import { useState } from 'react';
import { motion } from 'framer-motion';
import { useProgress, useGardenActions } from '@/features/garden/useGarden';
import PlantSVG from '@/features/garden/PlantSVG';
import { PLANT_SPECIES } from 'shared/types/firestore';
import type { PlantInstance } from 'shared/types/firestore';
import { Button } from '@/components/ui/button';
import { Leaf, Droplets, Lock, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Garden() {
  const progress = useProgress();
  const { plantSeed, waterPlant, unlockSpecies } = useGardenActions();
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
        <div className="flex justify-between text-xs text-[var(--fg-muted)]">
          <span>정원 생기</span>
          <span className="tabular-nums">{gardenState.health}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--leaf-soft)]">
          <div
            className="h-full rounded-full bg-[var(--leaf)] transition-all"
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
            return (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[var(--fg-primary)]">{sp?.name ?? selected.speciesId}</p>
                    <p className="text-xs text-[var(--fg-muted)] tabular-nums">
                      {selected.stage}/{maxStage} 단계
                      {selected.witheredSince && ' · 🍂 시듦'}
                    </p>
                  </div>
                  <PlantSVG speciesId={selected.speciesId} stage={selected.stage} withered={!!selected.witheredSince} size={52} />
                </div>
                {isFull ? (
                  <p className="text-sm text-[var(--leaf)] font-medium">🌸 만개했습니다!</p>
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

      {/* 상점 */}
      {showShop && (
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">씨앗 심기 / 식물 해금</h3>
          <div className="space-y-2">
            {PLANT_SPECIES.map((sp) => {
              const unlocked = gardenState.unlockedSpecies.includes(sp.id);
              return (
                <div key={sp.id} className="flex items-center gap-3">
                  <PlantSVG speciesId={sp.id} stage={2} size={44} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--fg-primary)]">{sp.name}</p>
                    <p className="text-xs text-[var(--fg-muted)]">
                      {sp.rarity === 'basic' ? '기본' : sp.rarity === 'common' ? '일반' : '희귀'}
                    </p>
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
