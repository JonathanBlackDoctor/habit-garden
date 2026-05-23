import { useState } from 'react';
import { motion } from 'framer-motion';
import { useProgress, useGardenActions } from '@/features/garden/useGarden';
import PlantSVG from '@/features/garden/PlantSVG';
import PlantCodex from '@/features/garden/PlantCodex';
import GardenThemeToggle from '@/features/garden/theme/GardenThemeToggle';
import { useGardenTheme } from '@/features/garden/theme/useGardenTheme';
import HarvestBurst, { type HarvestBurstSpec } from '@/features/garden/HarvestBurst';
import { PLANT_SPECIES, POINT_PRICES, DAILY_YIELD_BY_RARITY } from 'shared/types/firestore';
import type { PlantInstance, PlantSpecies } from 'shared/types/firestore';
import { Button } from '@/components/ui/button';
import { Leaf, Droplets, Lock, Sprout, Snowflake, Wheat, BookOpen, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFreezeTokens } from '@/features/freeze/useFreezeTokens';

// 상점 정렬 순서 (5등급)
const RARITY_ORDER: Record<PlantSpecies['rarity'], number> = {
  basic: 0, common: 1, rare: 2, epic: 3, legendary: 4,
};

const RARITY_META: Record<PlantSpecies['rarity'], { label: string; chip: string }> = {
  basic:     { label: '기본', chip: 'bg-[var(--leaf-soft)] text-[var(--fg-muted)]' },
  common:    { label: '일반', chip: 'bg-[#DCEEDB] text-[#3A6E2D]' },
  rare:      { label: '희귀', chip: 'bg-[#E5DCF2] text-[#6B4A8C]' },
  epic:      { label: '에픽', chip: 'bg-gradient-to-r from-[#FFE4B0] to-[#FFB8E8] text-[#7A4FA0] font-semibold' },
  legendary: { label: '전설', chip: 'bg-gradient-to-r from-[#FFD44A] via-[#FFB8E8] to-[#80E0FF] text-[#5A3E1E] font-bold' },
};

function healthVibe(h: number): { label: string; bar: string; chip: string } {
  if (h <= 30) return { label: '정원이 시들고 있어요', bar: 'bg-[#D9544A]', chip: 'text-[#A83A30]' };
  if (h <= 70) return { label: '생기를 회복하세요',     bar: 'bg-[#E8B544]', chip: 'text-[#A07A1E]' };
  return       { label: '활기찬 정원',                  bar: 'bg-[var(--leaf)]', chip: 'text-[var(--leaf-strong,var(--leaf))]' };
}

function harvestBonusOf(rarity: PlantSpecies['rarity']): number {
  if (rarity === 'rare')      return POINT_PRICES.HARVEST_BONUS_RARE;
  if (rarity === 'epic')      return POINT_PRICES.HARVEST_BONUS_RARE + POINT_PRICES.HARVEST_BONUS_EPIC;
  if (rarity === 'legendary') return POINT_PRICES.HARVEST_BONUS_RARE + POINT_PRICES.HARVEST_BONUS_EPIC + POINT_PRICES.HARVEST_BONUS_LEGENDARY;
  return 0;
}

function traitLabel(t?: PlantSpecies['trait']): string | null {
  if (!t) return null;
  switch (t.kind) {
    case 'lucky':      return '🍀 행운 (드롭↑·1/5 시작)';
    case 'beauty':     return `✿ 매일 +${t.xp} XP`;
    case 'hardy':      return '🛡️ 시들기 면역';
    case 'fast':       return '⚡ 생기>80 시 매일 자동 성장';
    case 'healer':     return `🪷 만개 시 생기 +${t.heal}`;
    case 'streakSync': return '✨ 기도 연속 시 수확 +50%';
    case 'bloomer':    return '🌳 매일 자동 성장 (확실)';
  }
}

type Tab = 'garden' | 'shop' | 'codex';

export default function Garden() {
  const progress = useProgress();
  const { plantSeed, waterPlant, unlockSpecies, harvestPlant } = useGardenActions();
  const freeze = useFreezeTokens();
  const [selected, setSelected] = useState<PlantInstance | null>(null);
  const [tab, setTab] = useState<Tab>('garden');
  const [burst, setBurst] = useState<HarvestBurstSpec | null>(null);
  const gardenTheme = useGardenTheme((s) => s.theme);

  if (!progress) {
    return (
      <div className="garden-root flex min-h-screen items-center justify-center" data-garden-theme={gardenTheme}>
        <div className="text-[var(--fg-faint)]">정원을 불러오는 중…</div>
      </div>
    );
  }

  const { gardenState, spendablePoints } = progress;
  const plants = gardenState.plants;
  const vibe = healthVibe(gardenState.health ?? 100);
  const autogrowToday = progress.gardenStats?.autogrowToday ?? 0;
  const codexCount = progress.gardenStats?.codexEntries?.length ?? 0;

  return (
    <div className="garden-root min-h-screen p-4 space-y-4 pb-8" data-garden-theme={gardenTheme}>
      {/* 헤더 */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--fg-primary)]">나의 정원</h2>
          <p className="text-xs text-[var(--fg-muted)] tabular-nums">
            생기 {gardenState.health}/100 · ✦{spendablePoints}P · 도감 {codexCount}/25
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {/* 자동 성장 칩 */}
          <span className={cn(
            'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium',
            autogrowToday > 0
              ? 'bg-[var(--leaf-soft)] text-[var(--leaf-strong,var(--leaf))]'
              : 'bg-[var(--leaf-soft)]/40 text-[var(--fg-faint)]',
          )}>
            <Sparkles size={11} />
            오늘 자동 +{autogrowToday}
          </span>
          {/* 테마 토글: meadow ↔ sunset */}
          <GardenThemeToggle />
        </div>
      </div>

      {/* 정원 생기 바 */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <motion.span
            key={vibe.label}
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className={cn('font-medium', vibe.chip)}
          >
            {vibe.label}
          </motion.span>
          <span className="text-[var(--fg-muted)] tabular-nums">{gardenState.health}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--leaf-soft)]">
          <motion.div
            className={cn('h-full rounded-full', vibe.bar)}
            initial={false}
            animate={{ width: `${gardenState.health}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 26 }}
          />
        </div>
      </div>

      {/* 탭 바 */}
      <div className="flex gap-2 border-b border-[var(--leaf-soft)]">
        {([
          { id: 'garden', label: '정원',  icon: Leaf },
          { id: 'shop',   label: '상점',  icon: Sprout },
          { id: 'codex',  label: '도감',  icon: BookOpen },
        ] as { id: Tab; label: string; icon: typeof Leaf }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
              tab === id
                ? 'text-[var(--leaf-strong,var(--leaf))]'
                : 'text-[var(--fg-muted)] hover:text-[var(--fg-primary)]',
            )}
          >
            <Icon size={13} />
            {label}
            {tab === id && (
              <motion.span
                layoutId="garden-tab-active"
                className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[var(--leaf)]"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* 정원 탭 */}
      {tab === 'garden' && (
        <>
          <div
            className="relative overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-b from-[var(--field-grad-top)] to-[var(--field-grad-bottom)] p-4 min-h-[240px] flex flex-wrap items-end gap-3 justify-center"
            style={{ boxShadow: 'inset 0 -4px 8px rgba(79,122,55,0.08)' }}
          >
            {/* sky 그라데이션 상단 (아주 옅게) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-12 rounded-t-[var(--radius-lg)]"
              style={{ background: 'linear-gradient(to bottom, var(--sky-soft) 0%, transparent 100%)', opacity: 0.55 }}
            />
            {/* 흙 라인 (하단) */}
            <div className="absolute bottom-0 left-0 right-0 h-8 rounded-b-[var(--radius-lg)] bg-[var(--soil)] opacity-20" />

            {plants.length === 0 && (
              <div className="flex flex-col items-center gap-2 text-[var(--fg-faint)] py-8 w-full">
                <div className="garden-empty-icon">
                  <Sprout size={32} className="text-[var(--leaf-soft)]" opacity={0.6} />
                </div>
                <p className="text-sm">씨앗을 심어 정원을 시작하세요!</p>
              </div>
            )}

            {plants.map((plant, idx) => {
              const isSelected = selected?.id === plant.id;
              const sp = PLANT_SPECIES.find((s) => s.id === plant.speciesId);
              const maxStage = (sp?.stages ?? 4) - 1;
              const isFull = plant.stage >= maxStage;
              // 성능 가드: 동시 idle 호흡은 처음 6개까지만
              const allowIdle = idx < 6;
              return (
                <motion.button
                  key={plant.id}
                  whileTap={{ scale: 0.95 }}
                  animate={{ scale: isSelected ? 1.08 : 1 }}
                  onClick={() => setSelected(isSelected ? null : plant)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg p-1 transition-all relative',
                    isSelected && 'ring-2 ring-[var(--leaf)] ring-offset-1',
                  )}
                >
                  <PlantSVG
                    speciesId={plant.speciesId}
                    stage={plant.stage}
                    withered={!!plant.witheredSince}
                    rarity={sp?.rarity}
                    size={68}
                    idle={allowIdle && isFull && !plant.witheredSince}
                  />
                  <span className="text-[10px] text-[var(--fg-muted)] tabular-nums">Lv{plant.stage}</span>
                  {/* 만개 식물에는 일일 yield 표시 */}
                  {isFull && sp && !plant.witheredSince && (
                    <span className="absolute -top-1 -right-1 rounded-full bg-[#FFD44A] px-1.5 py-0.5 text-[8px] font-bold text-[#5A3E1E] tabular-nums shadow-sm">
                      +{sp.dailyYield ?? DAILY_YIELD_BY_RARITY[sp.rarity]}/일
                    </span>
                  )}
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
                const harvests = progress.gardenStats?.harvestsBySpecies?.[selected.speciesId] ?? 0;
                const star3 = harvests >= 30;
                const baseYield = Math.round((sp?.harvestYield ?? 10) * (star3 ? 1.10 : 1));
                const rarityBonus = sp ? harvestBonusOf(sp.rarity) : 0;
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
                          {star3 && (
                            <span className="rounded-full bg-[#FFD44A]/30 px-1.5 py-0.5 text-[10px] text-[#A07A1E] font-bold">★★★</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--fg-muted)] tabular-nums">
                          {selected.stage}/{maxStage} 단계 · 누적 수확 {harvests}회
                          {selected.witheredSince && ' · 🍂 시듦'}
                        </p>
                        {sp?.trait && (
                          <p className="mt-1 text-[11px] text-[var(--fg-faint)]">{traitLabel(sp.trait)}</p>
                        )}
                        {sp?.description && (
                          <p className="text-[11px] text-[var(--fg-faint)]">{sp.description}</p>
                        )}
                      </div>
                      <PlantSVG speciesId={selected.speciesId} stage={selected.stage} withered={!!selected.witheredSince} rarity={sp?.rarity} size={52} />
                    </div>
                    {isFull ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={async () => {
                          if (sp) {
                            setBurst({
                              rarity:      sp.rarity,
                              speciesId:   sp.id,
                              speciesName: sp.name,
                              totalYield,
                              stage:       selected.stage,
                            });
                          }
                          await harvestPlant(selected.id);
                          setSelected(null);
                        }}
                        className="w-full gap-2 bg-[var(--bloom)] hover:opacity-90"
                      >
                        <Wheat size={15} />
                        수확하기 (+{totalYield}P{streakBonus ? ' ✨' : ''}{star3 ? ' ★3' : ''})
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => waterPlant(selected.id)}
                        className="w-full gap-2"
                      >
                        <Droplets size={15} />
                        물주기 ({POINT_PRICES.WATER}P)
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
        </>
      )}

      {/* 상점 탭 */}
      {tab === 'shop' && (
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">씨앗 심기 / 식물 해금</h3>
          <p className="text-[11px] text-[var(--fg-faint)] leading-relaxed">
            물주기 비용 {POINT_PRICES.WATER}P · 희귀+{POINT_PRICES.HARVEST_BONUS_RARE} · 에픽+{POINT_PRICES.HARVEST_BONUS_RARE + POINT_PRICES.HARVEST_BONUS_EPIC} · 전설+{POINT_PRICES.HARVEST_BONUS_RARE + POINT_PRICES.HARVEST_BONUS_EPIC + POINT_PRICES.HARVEST_BONUS_LEGENDARY} 수확 보너스.<br />
            만개 식물은 매일 자동 P 생성. 심을 때 10% 확률로 한 등급 위 씨앗 발견 (lucky 종은 15%).
          </p>
          <div className="space-y-2">
            {[...PLANT_SPECIES]
              .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.unlockCost - b.unlockCost)
              .map((sp) => {
                const unlocked = gardenState.unlockedSpecies.includes(sp.id);
                const meta = RARITY_META[sp.rarity];
                const seedCost = sp.seedCost ?? POINT_PRICES.SEED;
                const dy = sp.dailyYield ?? DAILY_YIELD_BY_RARITY[sp.rarity];
                return (
                  <div key={sp.id} className="flex items-center gap-3 rounded-lg border border-[var(--leaf-soft)] bg-white/60 p-2">
                    <PlantSVG speciesId={sp.id} stage={Math.max(3, sp.stages - 1)} size={44} rarity={sp.rarity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-[var(--fg-primary)]">{sp.name}</p>
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', meta.chip)}>
                          {meta.label}
                        </span>
                      </div>
                      {sp.description && (
                        <p className="text-[11px] text-[var(--fg-muted)]">{sp.description}</p>
                      )}
                      <p className="text-[10px] text-[var(--fg-faint)] tabular-nums">
                        수확 +{sp.harvestYield ?? 0}P · 일일 +{dy}P · 만개 {sp.stages - 1}단계 · 씨앗 {seedCost}P
                      </p>
                    </div>
                    {unlocked ? (
                      <Button size="sm" variant="secondary" onClick={() => plantSeed(sp.id)}>
                        심기 ({seedCost}P)
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

      {/* 도감 탭 */}
      {tab === 'codex' && <PlantCodex progress={progress} />}

      {/* 수확 모먼트 — 희귀도별 차등 셀러브레이션 */}
      <HarvestBurst burst={burst} onDone={() => setBurst(null)} />
    </div>
  );
}
