import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgress, useGardenActions, isWateredToday } from '@/features/garden/useGarden';
import PlantSVG from '@/features/garden/PlantSVG';
import PlantCodex from '@/features/garden/PlantCodex';
import GardenBrowse from '@/features/garden/GardenBrowse';
import DailyGardenRecapCard from '@/features/garden/DailyGardenRecapCard';
import ForecastCard from '@/features/garden/ForecastCard';
import TranscendAtmosphere from '@/features/garden/TranscendAtmosphere';
import { useAppStore } from '@/lib/store';
import { useNickname } from '@/lib/features';
import { PLANT_SPECIES, POINT_PRICES, SPRINGWATER_COST, SPRINGWATER_CAP, DAILY_YIELD_BY_RARITY, PLANTS_PER_BED, PLANTS_PER_ROW, CODEX_SPECIES_COUNT, MAX_BEDS } from 'shared/types/firestore';
import { computePassiveYield } from 'shared/lib/gardenYield';
import type { PlantInstance, PlantSpecies } from 'shared/types/firestore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Leaf, Droplets, Lock, Sprout, Snowflake, Wheat, BookOpen, Sparkles, ChevronLeft, ChevronRight, Shovel, Flower2, Users, RefreshCw } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { isOwner } from '@/lib/auth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFreezeTokens } from '@/features/freeze/useFreezeTokens';
import { useTabBloomKey } from '@/lib/tabActive';

// 상점 정렬 순서 (6등급)
const RARITY_ORDER: Record<PlantSpecies['rarity'], number> = {
  basic: 0, common: 1, rare: 2, epic: 3, legendary: 4, transcendent: 5,
};

const RARITY_META: Record<PlantSpecies['rarity'], { label: string; chip: string }> = {
  basic:        { label: '기본', chip: 'bg-[var(--leaf-soft)] text-[var(--fg-muted)]' },
  common:       { label: '일반', chip: 'bg-[#DCEEDB] text-[#3A6E2D]' },
  rare:         { label: '희귀', chip: 'bg-[#E5DCF2] text-[#6B4A8C]' },
  epic:         { label: '에픽', chip: 'bg-gradient-to-r from-[#FFE4B0] to-[#FFB8E8] text-[#7A4FA0] font-semibold' },
  legendary:    { label: '전설', chip: 'bg-gradient-to-r from-[#FFD44A] via-[#FFB8E8] to-[#80E0FF] text-[#5A3E1E] font-bold' },
  transcendent: { label: '초월', chip: 'transcend-chip text-white font-bold' },
};

const TRANSCENDENT_IDS = new Set(
  PLANT_SPECIES.filter((s) => s.rarity === 'transcendent').map((s) => s.id),
);

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
    case 'fast':       return '⚡ 물주기 1회에 2단계씩 자람';
    case 'healer':     return `🪷 만개 시 생기 +${t.heal}`;
    case 'streakSync': return '✨ 기도 연속 시 수확 +50%';
    case 'bloomer':    return '🌳 물주기 1회에 2단계씩 자람';
    case 'brittle':    return '💎 거른 날 즉시 사라짐 (물 회복 불가)';
    case 'fragile':    return '✨ 거르면 시들고, 이어 거르면 죽음';
    case 'waning':     return `🌌 ${t.graceDays}일 연속 거르면 죽음`;
    case 'regress':    return '🏵️ 거른 날마다 한 단계 시듦';
    case 'radiant':    return '🌅 만개 후 거르면 즉시 죽음';
    case 'transcendent': {
      const eff = t.effect === 'vitality' ? ` · 정원 생기 +${t.amount}`
        : t.effect === 'guardian' ? ' · 다른 식물 죽음 매일 1회 방지'
        : '';
      return `🌌 매일 +${t.dailyXp} XP${eff} · 매일 자람 · 유지비 ${t.upkeep}P/일 · 하루 거르면 즉사`;
    }
  }
}

type Tab = 'garden' | 'codex';
type SubTab = 'mine' | 'browse';

type SortKey = 'planted_desc' | 'planted_asc' | 'rarity' | 'stage' | 'species' | 'name';
type FilterKey = 'all' | 'bloom' | 'withered';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'planted_desc', label: '최신순' },
  { key: 'planted_asc',  label: '오래된순' },
  { key: 'rarity',       label: '등급순' },
  { key: 'stage',        label: '성장순' },
  { key: 'species',      label: '종류별' },
  { key: 'name',         label: '이름순' },
];

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: '전체' },
  { key: 'bloom',    label: '만개' },
  { key: 'withered', label: '시듦' },
];

const speciesOf = (id: string) => PLANT_SPECIES.find((s) => s.id === id);
const maxStageOf = (id: string) => (speciesOf(id)?.stages ?? 4) - 1;
const plantedMillis = (p: PlantInstance) => {
  const t = p.plantedAt as { toMillis?: () => number; seconds?: number } | undefined;
  return t?.toMillis?.() ?? (t?.seconds ?? 0) * 1000;
};

export default function Garden() {
  const progress = useProgress();
  const { plantSeed, waterPlant, unlockSpecies, harvestPlant, digUpPlant } = useGardenActions();
  const freeze = useFreezeTokens();
  const bloomKey = useTabBloomKey('/garden');
  const [selected, setSelected] = useState<PlantInstance | null>(null);
  const [tab, setTab] = useState<Tab>('garden');
  // 내 정원 ↔ 둘러보기 — URL ?view=browse 로 딥링크·탭 더블탭 연동 (신앙 탭과 동일 패턴)
  const [searchParams, setSearchParams] = useSearchParams();
  const subTab: SubTab = searchParams.get('view') === 'browse' ? 'browse' : 'mine';
  const setSubTab = (v: SubTab) =>
    setSearchParams(v === 'browse' ? { view: 'browse' } : {}, { replace: true });
  const uid = useAppStore((s) => s.uid);
  const realUid = useAppStore((s) => s.realUid);
  const sandbox = useAppStore((s) => s.sandbox);
  const user = useAppStore((s) => s.user);
  const nickname = useNickname();
  const [settling, setSettling] = useState(false);

  // '지금 정산 실행' (owner 전용) — 04:00 스케줄 정산이 누락됐을 때 오늘 정산을 즉시 돌려
  // 어젯밤 정원 소식 요약(성장·시듦·경험치·생기 포함)을 바로 만든다. 멱등이라 중복 적용 없음.
  const runSettlement = async () => {
    setSettling(true);
    try {
      const fn = httpsCallable(functions, 'runGardenSettlementNow');
      const res = (await fn()).data as { ran?: boolean; hasRecap?: boolean };
      if (uid) { try { localStorage.removeItem(`hg:gardenRecap:${uid}`); } catch { /* private mode */ } }
      if (res?.hasRecap) {
        toast.success('정원 정산 완료 — 위 어젯밤 정원 소식을 확인하세요.');
      } else if (res?.ran === false) {
        toast('오늘은 이미 정산됐어요. 표시할 새 변화가 없습니다.');
      } else {
        toast('오늘은 정산할 변화가 없었어요 (조용한 하루).');
      }
    } catch (e) {
      toast.error('정산 실행 실패: ' + ((e as Error)?.message ?? ''));
    } finally {
      setSettling(false);
    }
  };
  const [waterFx, setWaterFx] = useState<{ id: string; key: number } | null>(null);
  const [bedPage, setBedPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('planted_desc');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'harvest' | 'digup' | 'freeze';
    plantId?: string;
    label: string;
    desc: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const allPlants = progress?.gardenState.plants ?? [];

  // 정렬 → 필터 (원본 불변)
  const arranged = useMemo(() => {
    const filtered = allPlants.filter((p) => {
      if (filter === 'bloom') return p.stage >= maxStageOf(p.speciesId);
      if (filter === 'withered') return !!p.witheredSince;
      return true;
    });
    const sorted = [...filtered];
    switch (sortKey) {
      case 'planted_desc': sorted.sort((a, b) => plantedMillis(b) - plantedMillis(a)); break;
      case 'planted_asc':  sorted.sort((a, b) => plantedMillis(a) - plantedMillis(b)); break;
      case 'rarity': sorted.sort((a, b) =>
        (RARITY_ORDER[speciesOf(b.speciesId)?.rarity ?? 'basic'] - RARITY_ORDER[speciesOf(a.speciesId)?.rarity ?? 'basic'])
        || (b.stage - a.stage)); break;
      case 'stage': sorted.sort((a, b) => b.stage - a.stage); break;
      case 'name': sorted.sort((a, b) =>
        (speciesOf(a.speciesId)?.name ?? a.speciesId).localeCompare(speciesOf(b.speciesId)?.name ?? b.speciesId, 'ko')); break;
      case 'species': sorted.sort((a, b) => {
        const sa = speciesOf(a.speciesId), sb = speciesOf(b.speciesId);
        return (RARITY_ORDER[sa?.rarity ?? 'basic'] - RARITY_ORDER[sb?.rarity ?? 'basic'])
          || (sa?.name ?? a.speciesId).localeCompare(sb?.name ?? b.speciesId, 'ko')
          || (b.stage - a.stage);
      }); break;
    }
    return sorted;
  }, [allPlants, sortKey, filter]);

  const bedCount = Math.max(1, Math.ceil(arranged.length / PLANTS_PER_BED));
  const safePage = Math.min(bedPage, bedCount - 1);
  const pagePlants = arranged.slice(safePage * PLANTS_PER_BED, safePage * PLANTS_PER_BED + PLANTS_PER_BED);

  // 현재 화단(페이지)에 있는 활성 초월 식물만 대기 효과에 기여
  // (비시듦 + stage>=3 — 성장/만개 시에만)
  const activeTranscend = new Set(
    pagePlants
      .filter((p) => !p.witheredSince && p.stage >= 3 && TRANSCENDENT_IDS.has(p.speciesId))
      .map((p) => p.speciesId),
  );
  const hasCelestial = activeTranscend.has('celestial_tree');
  const hasEternal = activeTranscend.has('eternal_bloom');
  const hasGalaxy = activeTranscend.has('galaxy_lily');
  const activeTranscendCount = activeTranscend.size;
  // 어두운 하늘 테마(밤하늘/우주)일 때 라벨·식물을 밝게 보정
  const darkAtmosphere = activeTranscendCount >= 2 || (activeTranscendCount === 1 && hasGalaxy);

  // 페이지 범위 보정
  useEffect(() => { if (bedPage > bedCount - 1) setBedPage(bedCount - 1); }, [bedCount, bedPage]);

  // 정렬/필터/페이지 변경 시 선택 해제
  const changeSort = (k: SortKey) => { setSortKey(k); setSelected(null); setBedPage(0); };
  const changeFilter = (k: FilterKey) => { setFilter(k); setSelected(null); setBedPage(0); };
  const goPage = (n: number) => { setBedPage(Math.max(0, Math.min(bedCount - 1, n))); setSelected(null); };

  const renderPlant = (plant: PlantInstance) => {
    const isSelected = selected?.id === plant.id;
    const sp = speciesOf(plant.speciesId);
    const isFull = plant.stage >= maxStageOf(plant.speciesId);
    const isWatering = waterFx?.id === plant.id;
    return (
      <motion.button
        key={plant.id}
        whileTap={{ scale: 0.95 }}
        animate={isWatering
          ? { scale: [isSelected ? 1.08 : 1, 1.18, isSelected ? 1.08 : 1] }
          : { scale: isSelected ? 1.08 : 1 }}
        transition={isWatering ? { duration: 0.5 } : undefined}
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
        {isFull && sp && !plant.witheredSince && (
          <span className="absolute -top-1 -right-1 rounded-full bg-[#FFD44A] px-1.5 py-0.5 text-[8px] font-bold text-[#5A3E1E] tabular-nums">
            +{sp.dailyYield ?? DAILY_YIELD_BY_RARITY[sp.rarity]}/일
          </span>
        )}
        <AnimatePresence>
          {isWatering && (
            <motion.span
              key={waterFx!.key}
              initial={{ opacity: 0, y: 0, scale: 0.8 }}
              animate={{ opacity: 1, y: -28, scale: 1 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
              onAnimationComplete={() => setWaterFx(null)}
              className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[#E5F0F8] px-2 py-0.5 text-[10px] font-semibold text-[#3A6EA5] shadow-sm whitespace-nowrap"
              aria-hidden
            >
              💧 +1Lv
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  };

  if (!progress) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-[var(--fg-faint)]">정원을 불러오는 중…</div>
      </div>
    );
  }

  const { gardenState, spendablePoints } = progress;
  const springWater = progress.springWater ?? 0;
  const plants = gardenState.plants;
  const vibe = healthVibe(gardenState.health ?? 100);
  const pendingGrowthCount = plants.filter((p) => p.pendingGrowth).length;  // 다음 정산에 자랄 식물 수
  const codexCount = progress.gardenStats?.codexEntries?.length ?? 0;
  const dailyIncome = computePassiveYield(plants);  // 현재 만개 식물들의 하루 자동 수익(P)
  const wellFull = springWater >= SPRINGWATER_CAP;

  return (
    <div className="min-h-screen p-4 space-y-4 pb-8">
      {/* 상위 탭: 내 정원 / 둘러보기 */}
      <div className="flex gap-1 rounded-full bg-[var(--leaf-soft)]/60 p-0.5 mt-2">
        {([
          { id: 'mine', label: '내 정원', icon: Flower2 },
          { id: 'browse', label: '둘러보기', icon: Users },
        ] as { id: SubTab; label: string; icon: typeof Flower2 }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              subTab === id
                ? 'bg-white text-[var(--leaf-strong,var(--leaf))] shadow-sm'
                : 'text-[var(--fg-muted)]',
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {subTab === 'browse' ? (
        <GardenBrowse
          selfUid={uid ?? ''}
          sandbox={sandbox}
          isAnonymous={!!user?.isAnonymous}
          level={progress.level ?? 1}
          gardenState={gardenState}
          currentNickname={nickname}
        />
      ) : (
      <>
      {/* 헤더 */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--fg-primary)]">나의 정원</h2>
          <p className="text-xs text-[var(--fg-muted)] tabular-nums">
            생기 {gardenState.health}/100 · ✦{spendablePoints}P · 도감 {codexCount}/{CODEX_SPECIES_COUNT}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {/* 만개 수익 칩 — 현재 만개 식물들이 매일 벌어다 주는 포인트 */}
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium tabular-nums',
              dailyIncome > 0
                ? 'bg-[#FFF3CC] text-[#8A6A1E]'
                : 'bg-[var(--leaf-soft)]/40 text-[var(--fg-faint)]',
            )}
            title="만개한 식물이 매일 04:00에 벌어다 주는 포인트"
          >
            <Wheat size={11} />
            만개 +{dailyIncome}P/일
          </span>
          {/* 샘물 칩 — 매일 차오르는 성장 자원. 가득 차면 흘러넘쳐 소실. */}
          <span className={cn(
            'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium tabular-nums',
            wellFull
              ? 'bg-[#FFF3CC] text-[#8A6A1E]'
              : springWater > 0
                ? 'bg-[#DCEEFF] text-[#1E5A8A]'
                : 'bg-[var(--leaf-soft)]/40 text-[var(--fg-faint)]',
          )}>
            <Droplets size={11} />
            샘물 {springWater}/{SPRINGWATER_CAP}{wellFull ? ' 가득' : pendingGrowthCount > 0 ? ` · 내일 +${pendingGrowthCount}🌱` : ''}
          </span>
        </div>
      </div>

      {/* 정원 생기 바 */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className={cn('font-medium', vibe.chip)}>{vibe.label}</span>
          <span className="text-[var(--fg-muted)] tabular-nums">{gardenState.health}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--leaf-soft)]">
          <motion.div
            key={bloomKey}
            className={cn('h-full rounded-full', vibe.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${gardenState.health}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* 내일 정원 예보 — 오늘 행동이 내일 생기에 어떻게 반영될지 선제적으로 보여 줌 */}
      <ForecastCard />

      {/* 어젯밤 정원 소식 — 날짜가 바뀐 뒤 정산 요약(포인트·XP·생기·성장·시듦) */}
      {uid && <DailyGardenRecapCard gardenStats={progress.gardenStats} gardenState={gardenState} uid={uid} />}

      {/* 지금 정산 실행 (owner 전용 · 테스트/복구) — 04:00 스케줄 정산을 기다리지 않고 즉시 요약 생성.
          callable 은 실제 인증 uid 의 정원을 정산하므로 샌드박스 모드에서는 숨긴다. */}
      {isOwner(realUid) && !sandbox && (
        <button
          onClick={runSettlement}
          disabled={settling}
          className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius)] border border-dashed border-[var(--leaf)]/40 px-3 py-2 text-[11px] font-medium text-[var(--leaf-strong,var(--leaf))] disabled:opacity-50"
        >
          <RefreshCw size={12} className={settling ? 'animate-spin' : undefined} />
          {settling ? '정산 실행 중…' : '지금 정산 실행 (관리자 · 어젯밤 정원 소식 즉시 생성)'}
        </button>
      )}

      {/* 탭 바 */}
      <div className="flex gap-2 border-b border-[var(--leaf-soft)]">
        {([
          { id: 'garden', label: '정원',  icon: Leaf },
          { id: 'codex',  label: '도감',  icon: BookOpen },
        ] as { id: Tab; label: string; icon: typeof Leaf }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
              tab === id
                ? 'border-b-2 border-[var(--leaf)] text-[var(--leaf-strong,var(--leaf))]'
                : 'text-[var(--fg-muted)] hover:text-[var(--fg-primary)]',
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* 정원 탭 */}
      {tab === 'garden' && (
        <>
          {/* 정렬·필터 바 */}
          {plants.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-full bg-[var(--leaf-soft)]/60 p-0.5">
                {FILTER_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => changeFilter(key)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                      filter === key
                        ? 'bg-white text-[var(--leaf-strong,var(--leaf))] shadow-sm'
                        : 'text-[var(--fg-muted)]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                value={sortKey}
                onChange={(e) => changeSort(e.target.value as SortKey)}
                className="rounded-full border border-[var(--leaf-soft)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--fg-muted)]"
                aria-label="정렬 기준"
              >
                {SORT_OPTIONS.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <span className="ml-auto text-[11px] text-[var(--fg-faint)] tabular-nums">
                🌱 {plants.length}그루 · {bedCount}화단
              </span>
            </div>
          )}

          {/* 계단식 화단 페이저 */}
          <motion.div
            data-bed-pager={bedCount > 1 ? '' : undefined}
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
            {/* ── 일러스트 배경 레이어 (전부 pointer-events-none, z-0) ── */}
            {/* 햇살 */}
            <div
              className="pointer-events-none absolute -top-8 right-1 z-0 h-28 w-28 rounded-full"
              style={{ background: 'radial-gradient(circle, var(--garden-sun) 0%, transparent 70%)', opacity: 0.7 }}
            />
            {/* 초월 식물별 정원 대기 효과 (테마 하늘·광기둥·꽃잎비·별빛) */}
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
            {/* 흙 띠 (그라데이션) */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 h-14 rounded-b-[var(--radius-lg)]"
              style={{ background: 'linear-gradient(to top, var(--garden-soil-bottom) 0%, var(--garden-soil-top) 55%, transparent 100%)', opacity: 0.5 }}
            />
{/* 떠다니는 빛 입자 */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              {([
                { left: '14%', bottom: '22%', s: 5, dx: '10px', dy: '-30px', d: '0s', dur: '8s' },
                { left: '32%', bottom: '34%', s: 4, dx: '-8px', dy: '-26px', d: '1.4s', dur: '10s' },
                { left: '54%', bottom: '18%', s: 6, dx: '12px', dy: '-34px', d: '2.6s', dur: '9s' },
                { left: '72%', bottom: '40%', s: 4, dx: '-6px', dy: '-22px', d: '0.8s', dur: '11s' },
                { left: '86%', bottom: '26%', s: 5, dx: '8px', dy: '-28px', d: '3.2s', dur: '8.5s' },
              ] as const).map((m, i) => (
                <span
                  key={i}
                  className="mote absolute rounded-full"
                  style={{
                    left: m.left,
                    bottom: m.bottom,
                    width: m.s,
                    height: m.s,
                    background: 'radial-gradient(circle, rgba(255,247,200,0.9) 0%, rgba(255,247,200,0) 70%)',
                    animationDelay: m.d,
                    animationDuration: m.dur,
                    ['--mote-dx' as string]: m.dx,
                    ['--mote-dy' as string]: m.dy,
                  } as React.CSSProperties}
                />
              ))}
            </div>
            {/* 비네트 */}
            <div
              className="pointer-events-none absolute inset-0 z-0 rounded-[var(--radius-lg)]"
              style={{ boxShadow: 'inset 0 0 38px rgba(42,46,39,0.10)' }}
            />

            {plants.length === 0 ? (
              <div className="relative z-10 flex flex-col items-center gap-2 text-[var(--fg-faint)] py-8 w-full">
                <Sprout size={32} className="text-[var(--leaf-soft)]" opacity={0.6} />
                <p className="text-sm">씨앗을 심어 정원을 시작하세요!</p>
              </div>
            ) : pagePlants.length === 0 ? (
              <div className="relative z-10 flex flex-col items-center gap-2 text-[var(--fg-faint)] py-8 w-full">
                <Leaf size={28} className="text-[var(--leaf-soft)]" opacity={0.6} />
                <p className="text-sm">조건에 맞는 식물이 없어요</p>
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
                  {/* 계단식 줄: 뒤(원경) → 앞(근경) */}
                  {Array.from({ length: Math.ceil(pagePlants.length / PLANTS_PER_ROW) }).map((_, row, rows) => {
                    const rowPlants = pagePlants.slice(row * PLANTS_PER_ROW, row * PLANTS_PER_ROW + PLANTS_PER_ROW);
                    const depth = rows.length - 1 - row; // 위쪽 줄일수록 깊음
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
                        onClick={() => {
                          const sid = selected.id;
                          setConfirmDialog({
                            type: 'harvest',
                            plantId: sid,
                            label: '수확하기',
                            desc: `${sp?.name ?? '식물'}을(를) 수확하면 정원에서 사라집니다. 계속할까요?`,
                            confirmLabel: `수확 (+${totalYield}P)`,
                            onConfirm: async () => { await harvestPlant(sid); setSelected(null); },
                          });
                        }}
                        className="w-full gap-2 bg-[var(--bloom)] hover:opacity-90"
                      >
                        <Wheat size={15} />
                        수확하기 (+{totalYield}P{streakBonus ? ' ✨' : ''}{star3 ? ' ★3' : ''})
                      </Button>
                    ) : (
                      (() => {
                        const alreadyWatered = !!selected.wateredAt && isWateredToday(selected.wateredAt);
                        return (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={alreadyWatered}
                            onClick={async () => {
                              const id = selected.id;
                              const ok = await waterPlant(id);
                              if (ok) setWaterFx({ id, key: Date.now() });
                            }}
                            className="w-full gap-2"
                          >
                            <Droplets size={15} />
                            {alreadyWatered ? '물 줌 ✓ · 내일 자람' : `물주기 (💧${SPRINGWATER_COST.WATER})`}
                          </Button>
                        );
                      })()
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const sid = selected.id;
                        setConfirmDialog({
                          type: 'digup',
                          plantId: sid,
                          label: '파내기',
                          desc: `${sp?.name ?? '식물'}을(를) 파내면 영구적으로 제거됩니다. 계속할까요?`,
                          confirmLabel: '파내기',
                          onConfirm: async () => { await digUpPlant(sid); setSelected(null); },
                        });
                      }}
                      className="w-full gap-2 border-[#D9544A]/40 text-[#A83A30] hover:bg-[#FEF2F2] hover:border-[#D9544A]"
                    >
                      <Shovel size={15} />
                      파내기
                    </Button>
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
              <p className="text-xs text-[var(--fg-muted)] tabular-nums">사용 {freeze.price}P</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setConfirmDialog({
                  type: 'freeze',
                  label: '스트릭 보호 토큰 사용',
                  desc: `${freeze.price}P를 즉시 지불해 오늘의 스트릭을 보호합니다. 계속할까요?`,
                  confirmLabel: `사용 (-${freeze.price}P)`,
                  onConfirm: async () => { await freeze.useOne(); },
                });
              }}
            >사용</Button>
          </div>

          {/* 상점 · 씨앗 심기 (정원에서 아래로 스크롤하면 이어서 보임) */}
          <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--fg-primary)]">상점 · 씨앗 심기 / 식물 해금</h3>
            <div className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums',
              wellFull
                ? 'bg-[#FFF8E1] text-[#A07A1E]'
                : 'bg-[#DCEEFF] text-[#1E5A8A]',
            )}>
              <Droplets size={11} />
              샘물 {springWater}/{SPRINGWATER_CAP}{wellFull ? ' 가득' : ''}
            </div>
          </div>
          <p className="text-[11px] text-[var(--fg-faint)] leading-relaxed">
            물주기 💧{SPRINGWATER_COST.WATER} · 심기 💧{SPRINGWATER_COST.PLANT}+씨앗값 · 희귀+{POINT_PRICES.HARVEST_BONUS_RARE} · 에픽+{POINT_PRICES.HARVEST_BONUS_RARE + POINT_PRICES.HARVEST_BONUS_EPIC} · 전설+{POINT_PRICES.HARVEST_BONUS_RARE + POINT_PRICES.HARVEST_BONUS_EPIC + POINT_PRICES.HARVEST_BONUS_LEGENDARY} 수확 보너스.<br />
            💧샘물(용량 {SPRINGWATER_CAP})은 <b>매일 04:00에 자동으로 차오르고</b>(알찬 하루엔 조금 더), 가득 차면 흘러넘쳐 사라집니다. 심기 횟수 제한은 없고 샘물이 한도 역할을 합니다. 물을 준 식물은 <b>다음날 04:00에 한 단계</b> 자랍니다. 만개 식물은 매일 자동 P 생성.
          </p>
          {gardenState.plants.length >= MAX_BEDS * PLANTS_PER_BED && (
            <p className="text-[11px] text-amber-600 font-medium">
              화단이 가득 찼습니다. (최대 {MAX_BEDS}개 · {MAX_BEDS * PLANTS_PER_BED}칸) 식물을 수확하거나 캐내면 새로 심을 수 있어요.
            </p>
          )}
          <div className="space-y-2">
            {[...PLANT_SPECIES]
              .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.unlockCost - b.unlockCost)
              .map((sp) => {
                const unlocked = gardenState.unlockedSpecies.includes(sp.id);
                const isFull = gardenState.plants.length >= MAX_BEDS * PLANTS_PER_BED;
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
                      {sp.rarity === 'transcendent' && sp.trait?.kind === 'transcendent' ? (
                        <p className="text-[10px] text-[#8B5CF6] font-medium tabular-nums">
                          ✦ 매일 +{sp.trait.dailyXp} XP · 유지비 {sp.trait.upkeep}P/일 · 하루 거르면 즉사 · 만개 수확 +{sp.harvestYield ?? 0}P
                        </p>
                      ) : (
                        <p className="text-[10px] text-[var(--fg-faint)] tabular-nums">
                          수확 +{sp.harvestYield ?? 0}P · 일일 +{dy}P · 만개 {sp.stages - 1}단계 · 씨앗 {seedCost}P
                        </p>
                      )}
                    </div>
                    {unlocked ? (
                      <Button size="sm" variant="secondary" onClick={() => plantSeed(sp.id)} disabled={isFull || springWater < SPRINGWATER_COST.PLANT}>
                        {springWater < SPRINGWATER_COST.PLANT ? '샘물 부족' : `심기 (${seedCost}P·💧${SPRINGWATER_COST.PLANT})`}
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
        </>
      )}

      {/* 도감 탭 */}
      {tab === 'codex' && <PlantCodex progress={progress} />}
      </>
      )}

      {/* 확인 다이얼로그 */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent className="max-w-[320px]">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.label}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--fg-muted)] leading-relaxed">{confirmDialog?.desc}</p>
          <div className="flex gap-2 pt-2">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1">취소</Button>
            </DialogClose>
            <Button
              className={confirmDialog?.type === 'digup'
                ? 'flex-1 bg-[#D9544A] hover:bg-[#B83A30] text-white'
                : 'flex-1'}
              onClick={async () => {
                setConfirmDialog(null);
                await confirmDialog?.onConfirm();
              }}
            >
              {confirmDialog?.confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
