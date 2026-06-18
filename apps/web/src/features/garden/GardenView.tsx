import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlantSVG from '@/features/garden/PlantSVG';
import TranscendAtmosphere from '@/features/garden/TranscendAtmosphere';
import { PLANT_SPECIES, PLANTS_PER_BED, PLANTS_PER_ROW } from 'shared/types/firestore';
import type { GardenState, PlantInstance, PlantSpecies } from 'shared/types/firestore';
import { Leaf, Sprout, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Garden.tsx 와 동일한 표시 메타 (읽기 전용 뷰용 최소 복제) ──
const RARITY_META: Record<PlantSpecies['rarity'], { label: string; chip: string }> = {
  basic:        { label: '기본', chip: 'bg-[var(--leaf-soft)] text-[var(--fg-muted)]' },
  common:       { label: '일반', chip: 'bg-[#DCEEDB] text-[#3A6E2D]' },
  rare:         { label: '희귀', chip: 'bg-[#E5DCF2] text-[#6B4A8C]' },
  epic:         { label: '에픽', chip: 'bg-gradient-to-r from-[#FFE4B0] to-[#FFB8E8] text-[#7A4FA0] font-semibold' },
  legendary:    { label: '전설', chip: 'bg-gradient-to-r from-[#FFD44A] via-[#FFB8E8] to-[#80E0FF] text-[#5A3E1E] font-bold' },
  sacred:       { label: '신성', chip: 'transcend-chip text-white font-bold' },
};

const SACRED_IDS = new Set(
  PLANT_SPECIES.filter((s) => s.rarity === 'sacred').map((s) => s.id),
);

const speciesOf = (id: string) => PLANT_SPECIES.find((s) => s.id === id);
const maxStageOf = (id: string) => (speciesOf(id)?.stages ?? 4) - 1;
const plantedMillis = (p: PlantInstance) => {
  const t = p.plantedAt as { toMillis?: () => number; seconds?: number } | undefined;
  return t?.toMillis?.() ?? (t?.seconds ?? 0) * 1000;
};

interface GardenViewProps {
  gardenState: GardenState;
}

/** 다른 사용자의 정원을 보여주는 읽기 전용 뷰. 물주기/수확/파내기 등 액션 없음. */
export default function GardenView({ gardenState }: GardenViewProps) {
  const [selected, setSelected] = useState<PlantInstance | null>(null);
  const [bedPage, setBedPage] = useState(0);

  const allPlants = gardenState.plants ?? [];
  const arranged = useMemo(
    () => [...allPlants].sort((a, b) => plantedMillis(b) - plantedMillis(a)),
    [allPlants],
  );

  const bedCount = Math.max(1, Math.ceil(arranged.length / PLANTS_PER_BED));
  const safePage = Math.min(bedPage, bedCount - 1);
  const pagePlants = arranged.slice(safePage * PLANTS_PER_BED, safePage * PLANTS_PER_BED + PLANTS_PER_BED);

  const activeTranscend = new Set(
    pagePlants
      .filter((p) => !p.witheredSince && p.stage >= 3 && SACRED_IDS.has(p.speciesId))
      .map((p) => p.speciesId),
  );
  const hasCelestial = activeTranscend.has('celestial_tree');
  const hasEternal = activeTranscend.has('eternal_bloom');
  const hasGalaxy = activeTranscend.has('galaxy_lily');
  const activeTranscendCount = activeTranscend.size;
  const darkAtmosphere = activeTranscendCount >= 2 || (activeTranscendCount === 1 && hasGalaxy);

  const goPage = (n: number) => { setBedPage(Math.max(0, Math.min(bedCount - 1, n))); setSelected(null); };

  const renderPlant = (plant: PlantInstance) => {
    const isSelected = selected?.id === plant.id;
    const sp = speciesOf(plant.speciesId);
    return (
      <motion.button
        key={plant.id}
        whileTap={{ scale: 0.95 }}
        animate={{ scale: isSelected ? 1.08 : 1 }}
        onClick={() => setSelected(isSelected ? null : plant)}
        className={cn(
          'flex flex-col items-center gap-1 rounded-lg p-1 transition-all relative',
          isSelected && 'ring-2 ring-[var(--leaf)] ring-offset-1',
          darkAtmosphere && '[filter:drop-shadow(0_0_4px_rgba(255,255,255,0.35))]',
        )}
      >
        <PlantSVG
          speciesId={plant.speciesId}
          stage={plant.stage}
          withered={!!plant.witheredSince}
          rarity={sp?.rarity}
          size={68}
        />
        <span className={cn(
          'text-[10px] tabular-nums',
          darkAtmosphere
            ? 'text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]'
            : 'text-[var(--fg-muted)]',
        )}>Lv{plant.stage}</span>
      </motion.button>
    );
  };

  return (
    <div className="space-y-4">
      {/* 계단식 화단 페이저 (읽기 전용) */}
      <motion.div
        className="relative overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-b from-[var(--garden-sky-top)] via-[var(--garden-sky-bottom)] to-[var(--leaf-soft)] p-4 min-h-[240px]"
        style={{ boxShadow: 'inset 0 -4px 8px rgba(79,122,55,0.08)' }}
        drag={bedCount > 1 ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60 || info.velocity.x < -300) goPage(safePage + 1);
          else if (info.offset.x > 60 || info.velocity.x > 300) goPage(safePage - 1);
        }}
      >
        {/* 햇살 */}
        <div
          className="pointer-events-none absolute -top-8 right-1 z-0 h-28 w-28 rounded-full"
          style={{ background: 'radial-gradient(circle, var(--garden-sun) 0%, transparent 70%)', opacity: 0.7 }}
        />
        <TranscendAtmosphere
          hasCelestial={hasCelestial}
          hasEternal={hasEternal}
          hasGalaxy={hasGalaxy}
          activeCount={activeTranscendCount}
        />
        {/* 원경 언덕 */}
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-7 z-0 h-16 w-full"
          viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden
        >
          <path d="M0 18 Q22 6 46 14 Q72 22 100 10 L100 24 L0 24 Z" fill="var(--garden-hill)" opacity="0.45" />
          <path d="M0 22 Q30 12 58 18 Q80 22 100 16 L100 24 L0 24 Z" fill="var(--garden-hill)" opacity="0.6" />
        </svg>
        {/* 흙 띠 */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 h-14 rounded-b-[var(--radius-lg)]"
          style={{ background: 'linear-gradient(to top, var(--garden-soil-bottom) 0%, var(--garden-soil-top) 55%, transparent 100%)', opacity: 0.5 }}
        />
        {/* 비네트 */}
        <div
          className="pointer-events-none absolute inset-0 z-0 rounded-[var(--radius-lg)]"
          style={{ boxShadow: 'inset 0 0 38px rgba(42,46,39,0.10)' }}
        />

        {arranged.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center gap-2 text-[var(--fg-faint)] py-8 w-full">
            <Sprout size={32} className="text-[var(--leaf-soft)]" opacity={0.6} />
            <p className="text-sm">아직 식물이 없어요</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={safePage}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.22 }}
              className="relative z-10 flex flex-col items-center gap-1"
            >
              {Array.from({ length: Math.ceil(pagePlants.length / PLANTS_PER_ROW) }).map((_, row, rows) => {
                const rowPlants = pagePlants.slice(row * PLANTS_PER_ROW, row * PLANTS_PER_ROW + PLANTS_PER_ROW);
                const depth = rows.length - 1 - row;
                const scale = 1 - depth * 0.15;
                const opacity = 1 - depth * 0.15;
                return (
                  <div
                    key={row}
                    className="relative flex items-end justify-center gap-3"
                    style={{
                      transform: `scale(${scale})`,
                      opacity,
                      zIndex: row + 1,
                      marginTop: row === 0 ? 0 : -10,
                    }}
                  >
                    <div className="pointer-events-none absolute bottom-0 left-2 right-2 h-2 rounded-full bg-[var(--soil)] opacity-25" />
                    {rowPlants.map(renderPlant)}
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>

      {/* 페이지 인디케이터 */}
      {bedCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => goPage(safePage - 1)}
            disabled={safePage === 0}
            className="text-[var(--fg-muted)] disabled:opacity-30"
            aria-label="이전 화단"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: bedCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => goPage(i)}
                aria-label={`${i + 1}번 화단`}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === safePage ? 'w-5 bg-[var(--leaf)]' : 'w-2 bg-[var(--leaf-soft)]',
                )}
              />
            ))}
          </div>
          <button
            onClick={() => goPage(safePage + 1)}
            disabled={safePage === bedCount - 1}
            className="text-[var(--fg-muted)] disabled:opacity-30"
            aria-label="다음 화단"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* 선택된 식물 정보 (읽기 전용, 액션 없음) */}
      {selected && (() => {
        const sp = speciesOf(selected.speciesId);
        const maxStage = maxStageOf(selected.speciesId);
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-4">
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
          </motion.div>
        );
      })()}

      <p className="flex items-center justify-center gap-1 text-[11px] text-[var(--fg-faint)] tabular-nums">
        <Leaf size={12} /> {arranged.length}그루 · 생기 {gardenState.health ?? 0}/100
      </p>
    </div>
  );
}
