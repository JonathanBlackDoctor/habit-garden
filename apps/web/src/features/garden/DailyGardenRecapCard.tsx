import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, X, Coins, Sparkles, Heart, Sprout, ChevronDown, ChevronUp } from 'lucide-react';
import { PLANT_SPECIES } from 'shared/types/firestore';
import type { DailyGardenRecap, DailyGardenRecapPlant, GardenStats, GardenState } from 'shared/types/firestore';
import { computeYieldBreakdown } from 'shared/lib/gardenYield';
import { formatKoreanDate } from '@/lib/dayBoundary';
import { cn } from '@/lib/utils';
import PlantSVG from '@/features/garden/PlantSVG';
import { getGameDayKST } from '@/features/garden/useGarden';

const DISMISS_KEY = (uid: string) => `hg:gardenRecap:${uid}`;
const MAX_PLANT_ROWS = 6;

const speciesOf = (id: string) => PLANT_SPECIES.find((s) => s.id === id);

// 식물 사건별 칩 표시 메타 (가장 중요한 사건 하나를 대표로 보여 줄 때 사용).
const EVENT_META: Record<
  DailyGardenRecapPlant['events'][number],
  { label: string; chip: string }
> = {
  bloomed:   { label: '🌸 만개', chip: 'bg-[var(--bloom-soft)] text-[var(--bloom)]' },
  grew:      { label: '🌱 자람', chip: 'bg-[var(--leaf-soft)] text-[var(--leaf-strong,var(--leaf))]' },
  withered:  { label: '🍂 시듦', chip: 'bg-[var(--wither)]/15 text-[var(--wither)]' },
  regressed: { label: '🥀 한 단계 시듦', chip: 'bg-[var(--wither)]/15 text-[var(--wither)]' },
  died:      { label: '💀 떠나보냄', chip: 'bg-[#D9544A]/15 text-[#A83A30]' },
};

// 한 식물에 여러 사건이 겹치면 이 우선순위로 대표 사건을 고른다.
const EVENT_PRIORITY: DailyGardenRecapPlant['events'][number][] =
  ['died', 'bloomed', 'regressed', 'withered', 'grew'];

// 같은 종을 한 줄로 묶은 표시 단위. 수익·XP·생기·유지비는 합산, 사건은 합집합.
interface PlantGroup {
  speciesId: string;
  count: number;       // 이 종의 그루 수 (×N 표시에 사용)
  yield: number;       // 합산 수익(P)
  yieldCount: number;  // 실제로 수익을 낸 그루 수 (개당 표시 분모)
  xp: number;
  vitality: number;
  upkeep: number;
  events: Set<DailyGardenRecapPlant['events'][number]>;
}

function groupPrimaryEvent(g: PlantGroup) {
  for (const e of EVENT_PRIORITY) if (g.events.has(e)) return e;
  return null;
}

/** 식물별 상세를 같은 종끼리 묶어 ×N 한 줄로 정리한다 (사건 우선순위 → 총수익 순). */
function groupBySpecies(plants: DailyGardenRecapPlant[]): PlantGroup[] {
  const map = new Map<string, PlantGroup>();
  for (const p of plants) {
    let g = map.get(p.speciesId);
    if (!g) {
      g = { speciesId: p.speciesId, count: 0, yield: 0, yieldCount: 0, xp: 0, vitality: 0, upkeep: 0, events: new Set() };
      map.set(p.speciesId, g);
    }
    g.count += 1;
    g.yield += p.yield ?? 0;
    if ((p.yield ?? 0) > 0) g.yieldCount += 1;
    g.xp += p.xp ?? 0;
    g.vitality += p.vitality ?? 0;
    g.upkeep += p.upkeep ?? 0;
    for (const e of p.events) g.events.add(e);
  }
  return [...map.values()].sort((a, b) => {
    const ea = groupPrimaryEvent(a), eb = groupPrimaryEvent(b);
    const ra = ea ? EVENT_PRIORITY.indexOf(ea) : 99;
    const rb = eb ? EVENT_PRIORITY.indexOf(eb) : 99;
    if (ra !== rb) return ra - rb;
    return b.yield - a.yield;
  });
}

/** 요약 상단의 통계 칩 하나. */
function StatChip({ icon, label, tone }: { icon?: React.ReactNode; label: string; tone: string }) {
  return (
    <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums', tone)}>
      {icon}
      {label}
    </span>
  );
}

/**
 * 오늘 게임일에 보여 줄 요약을 고른다.
 *  1) 서버/클라이언트가 남긴 상세 요약(lastDailyRecap)이 오늘 것이면 그대로 사용(성장·시듦까지 포함).
 *  2) 없으면 — 서버 정산이 상세 요약을 안 남겼더라도 — 오늘 적립된 passive yield 마커로
 *     최소 요약을 합성한다. 이렇게 하면 토스트가 뜨는 날엔 카드도 반드시 함께 뜬다.
 */
function deriveTodayRecap(
  today: string,
  gardenStats: GardenStats | undefined,
  gardenState: GardenState | undefined,
): DailyGardenRecap | undefined {
  const stored = gardenStats?.lastDailyRecap;
  if (stored && stored.gameDay === today) return stored;

  const yieldDate = gardenStats?.lastPassiveYieldDate;
  const amount = gardenStats?.lastPassiveYieldAmount ?? 0;
  if (yieldDate === today && amount > 0) {
    const health = gardenState?.health ?? 100;
    return {
      gameDay: today,
      yesterdaySuccess: false,
      protectedDay: false,
      pointsEarned: amount,
      upkeepPaid: 0,
      xpGained: 0,
      healthBefore: health,
      healthAfter: health,
      grown: 0, bloomed: 0, withered: 0, regressed: 0, lost: 0,
      streakSeed: false,
      plants: computeYieldBreakdown(gardenState?.plants ?? []).map((b) => ({
        plantId: b.plantId, speciesId: b.speciesId, events: [], yield: b.yield,
      })),
      partial: true,
    };
  }
  return undefined;
}

/**
 * 어젯밤 정원 소식 — 매일 04:00 정산(processDailyGarden)에서 일어난 변화를
 * 정원 탭 상단에서 한눈에·자세히 보여 준다. 토스트로만 스쳐 가던 정보를 여기서 차분히 확인한다.
 * X 로 닫으면 그 게임일에는 다시 뜨지 않는다(localStorage).
 */
export default function DailyGardenRecapCard({
  gardenStats,
  gardenState,
  uid,
}: {
  gardenStats: GardenStats | undefined;
  gardenState: GardenState | undefined;
  uid: string;
}) {
  const today = getGameDayKST();
  const recap = useMemo(
    () => deriveTodayRecap(today, gardenStats, gardenState),
    [today, gardenStats, gardenState],
  );
  const [dismissedDay, setDismissedDay] = useState<string | null>(() => {
    try { return localStorage.getItem(DISMISS_KEY(uid)); } catch { return null; }
  });
  const [expanded, setExpanded] = useState(false);

  // 다른 사용자/게임일로 바뀌면 닫힘 상태 다시 읽기.
  useEffect(() => {
    try { setDismissedDay(localStorage.getItem(DISMISS_KEY(uid))); } catch { /* private mode */ }
  }, [uid, recap?.gameDay]);

  // 오늘 게임일의 요약이고, 아직 닫지 않았을 때만 노출.
  if (!recap || recap.gameDay !== today || dismissedDay === today) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY(uid), today); } catch { /* private mode */ }
    setDismissedDay(today);
  };

  // 같은 종끼리 묶어 ×N 으로 정리.
  const groups = groupBySpecies(recap.plants);
  const shown = expanded ? groups : groups.slice(0, MAX_PLANT_ROWS);
  const moreCount = groups.length - shown.length;

  // 헤더 수익은 '식물별 합계'와 항상 일치하도록 분해 합으로 표기 (저장본의 pointsEarned 와
  // 분해가 어긋나도 카드가 모순돼 보이지 않게 — 서버 정산이 둘을 일치시키면 같은 값이 된다).
  const earnedFromPlants = groups.reduce((t, g) => t + g.yield, 0);
  const earned = earnedFromPlants > 0 ? earnedFromPlants : recap.pointsEarned;
  const net = earned - recap.upkeepPaid;
  const healthDelta = recap.healthAfter - recap.healthBefore;
  const hasSummary = recap.grown > 0 || recap.bloomed > 0 || recap.withered > 0
    || recap.regressed > 0 || recap.lost > 0 || recap.streakSeed;

  // 'partial(부분 요약)'은 플래그만 믿지 않고 실제 내용으로 판정한다.
  // 서버 전체 정산이 클라이언트 부분 요약 위에 merge 되면 stale 한 partial=true 가 남을 수 있어,
  // 경험치·성장·시듦·생기변화 등 풍부한 내용이 있으면 전체 정산으로 간주한다.
  const richContent = recap.xpGained > 0 || recap.upkeepPaid > 0 || hasSummary
    || recap.healthBefore !== recap.healthAfter;
  const isPartial = !!recap.partial && !richContent;

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative space-y-2.5 rounded-[var(--radius)] border border-[var(--leaf)]/25 bg-[var(--bg-surface)] p-3.5 shadow-[var(--shadow-sm)]"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--leaf-strong,var(--leaf))]">
          <Moon size={14} /> 어젯밤 정원 소식 · {formatKoreanDate(recap.gameDay)}
        </div>
        <button
          onClick={dismiss}
          aria-label="닫기"
          className="-mr-1 rounded-full p-1 text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"
        >
          <X size={14} />
        </button>
      </div>

      {/* 요약 통계 칩 — 포인트 · 경험치 · 생기(항상 표시) */}
      <div className="flex flex-wrap gap-1.5">
        {net !== 0 && (
          <StatChip
            icon={<Coins size={11} />}
            tone={net > 0 ? 'bg-[#FFF3CC] text-[#8A6A1E]' : 'bg-[var(--wither)]/15 text-[var(--wither)]'}
            label={`${net > 0 ? '+' : ''}${net}P`}
          />
        )}
        {recap.upkeepPaid > 0 && earned > 0 && (
          <StatChip
            tone="bg-[var(--leaf-soft)]/50 text-[var(--fg-muted)]"
            label={`수익 +${earned}P · 유지비 −${recap.upkeepPaid}P`}
          />
        )}
        {/* 경험치 — 전체 정산일 때만 의미 있는 값. 0이면 숨김. */}
        {recap.xpGained > 0 && (
          <StatChip icon={<Sparkles size={11} />} tone="bg-[var(--bloom-soft)] text-[var(--bloom)]" label={`+${recap.xpGained} XP`} />
        )}
        {/* 생기 — 항상 표시. 변화가 있으면 before→after(±Δ), 없으면 현재 수치만. */}
        <StatChip
          icon={<Heart size={11} />}
          tone={
            healthDelta > 0 ? 'bg-[var(--leaf-soft)] text-[var(--leaf-strong,var(--leaf))]'
              : healthDelta < 0 ? 'bg-[var(--wither)]/15 text-[var(--wither)]'
              : 'bg-[var(--leaf-soft)]/50 text-[var(--fg-muted)]'
          }
          label={
            healthDelta !== 0
              ? `생기 ${recap.healthBefore}→${recap.healthAfter} (${healthDelta > 0 ? '+' : ''}${healthDelta})`
              : `생기 ${recap.healthAfter}/100`
          }
        />
      </div>

      {/* 변화 요약 한 줄 — 전체 정산일 때만. (부분 요약은 성장·시듦을 알 수 없으므로 아래 안내로 대체) */}
      {!isPartial && (
        hasSummary ? (
          <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-[var(--fg-muted)] tabular-nums">
            {recap.grown > 0 && <span>🌱 자람 {recap.grown}</span>}
            {recap.bloomed > 0 && <span className="text-[var(--bloom)]">🌸 만개 {recap.bloomed}</span>}
            {recap.withered > 0 && <span className="text-[var(--wither)]">🍂 시듦 {recap.withered}</span>}
            {recap.regressed > 0 && <span className="text-[var(--wither)]">🥀 한 단계 시듦 {recap.regressed}</span>}
            {recap.lost > 0 && <span className="text-[#A83A30]">💀 떠나보냄 {recap.lost}</span>}
            {recap.streakSeed && <span className="text-[var(--leaf-strong,var(--leaf))]">🎁 스트릭 보너스 씨앗</span>}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
            <Sprout size={12} /> 자라거나 시든 식물 없이 잔잔한 하루였어요.
          </p>
        )
      )}

      {/* 식물별 상세 — 같은 종은 ×N 한 줄로 */}
      {groups.length > 0 && (
        <div className="space-y-1 border-t border-[var(--leaf-soft)] pt-2">
          {shown.map((g) => {
            const sp = speciesOf(g.speciesId);
            const ev = groupPrimaryEvent(g);
            // 만개했거나 수익을 낸(=다 자란) 식물은 만개 모습으로, 그 외엔 새싹 크기로.
            const mature = ev === 'bloomed' || g.yield > 0;
            // '개당'은 같은 종이 모두 수익을 낸 깔끔한 경우에만 표시 (그 외엔 합계만).
            const each = g.yieldCount > 1 && g.yieldCount === g.count ? Math.round(g.yield / g.yieldCount) : 0;
            return (
              <div key={g.speciesId} className="flex items-center gap-2 text-xs">
                <PlantSVG
                  speciesId={g.speciesId}
                  stage={mature ? (sp?.stages ?? 4) - 1 : 1}
                  withered={ev === 'withered' || ev === 'regressed' || ev === 'died'}
                  rarity={sp?.rarity}
                  size={24}
                />
                <span className="shrink-0 font-medium text-[var(--fg-primary)]">{sp?.name ?? g.speciesId}</span>
                {g.count > 1 && (
                  <span className="shrink-0 rounded-full bg-[var(--leaf-soft)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--leaf-strong,var(--leaf))]">
                    ×{g.count}
                  </span>
                )}
                {ev && (
                  <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px]', EVENT_META[ev].chip)}>
                    {EVENT_META[ev].label}
                  </span>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-2 tabular-nums text-[11px]">
                  {g.yield > 0 ? (
                    <span className="text-[#8A6A1E]">
                      +{g.yield}P
                      {each > 0 && <span className="text-[var(--fg-faint)]"> (개당 +{each}P)</span>}
                    </span>
                  ) : null}
                  {g.xp > 0 ? <span className="text-[var(--bloom)]">+{g.xp}XP</span> : null}
                  {g.vitality > 0 ? <span className="text-[var(--leaf-strong,var(--leaf))]">생기 +{g.vitality}</span> : null}
                  {g.upkeep > 0 ? <span className="text-[var(--wither)]">−{g.upkeep}P</span> : null}
                </span>
              </div>
            );
          })}
          {groups.length > MAX_PLANT_ROWS && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 pt-0.5 text-[11px] text-[var(--leaf-strong,var(--leaf))]"
            >
              {expanded ? <><ChevronUp size={12} /> 접기</> : <><ChevronDown size={12} /> {moreCount}종 더 보기</>}
            </button>
          )}
        </div>
      )}

      {/* 부분 요약 안내 — 전체 정산(성장·시듦·경험치)이 아직 반영되기 전 */}
      {isPartial && (
        <p className="flex items-start gap-1.5 rounded-md bg-[#FFF3CC] px-2.5 py-1.5 text-[11px] leading-snug text-[#8A6A1E]">
          <Sparkles size={12} className="mt-0.5 shrink-0" />
          지금은 <b>오늘 번 포인트</b>만 먼저 보여 줘요. 성장·시듦·경험치·생기 변화는 오늘 정산이
          마무리되면 자동으로 채워집니다.
        </p>
      )}
    </motion.section>
  );
}
