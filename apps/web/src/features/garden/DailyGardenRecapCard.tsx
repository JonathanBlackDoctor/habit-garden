import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, X, Coins, Sparkles, Heart, Sprout, ChevronDown, ChevronUp } from 'lucide-react';
import { PLANT_SPECIES } from 'shared/types/firestore';
import type { DailyGardenRecap, DailyGardenRecapPlant } from 'shared/types/firestore';
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

function primaryEvent(p: DailyGardenRecapPlant) {
  for (const e of EVENT_PRIORITY) if (p.events.includes(e)) return e;
  return null;
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
 * 어젯밤 정원 소식 — 매일 04:00 정산(processDailyGarden)에서 일어난 변화를
 * 정원 탭 상단에서 한눈에·자세히 보여 준다. 토스트로만 스쳐 가던 정보를 여기서 차분히 확인한다.
 * X 로 닫으면 그 게임일에는 다시 뜨지 않는다(localStorage).
 */
export default function DailyGardenRecapCard({
  recap,
  uid,
}: {
  recap: DailyGardenRecap | undefined;
  uid: string;
}) {
  const today = getGameDayKST();
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

  const net = recap.pointsEarned - recap.upkeepPaid;
  const healthDelta = recap.healthAfter - recap.healthBefore;

  // 식물별 상세: 사건 있는 식물 먼저(우선순위 순), 그다음 수익만 낸 식물.
  const sortedPlants = [...recap.plants].sort((a, b) => {
    const ea = primaryEvent(a), eb = primaryEvent(b);
    const ra = ea ? EVENT_PRIORITY.indexOf(ea) : 99;
    const rb = eb ? EVENT_PRIORITY.indexOf(eb) : 99;
    if (ra !== rb) return ra - rb;
    return (b.yield ?? 0) - (a.yield ?? 0);
  });
  const shown = expanded ? sortedPlants : sortedPlants.slice(0, MAX_PLANT_ROWS);
  const moreCount = sortedPlants.length - shown.length;

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

      {/* 요약 통계 칩 */}
      <div className="flex flex-wrap gap-1.5">
        {net !== 0 && (
          <StatChip
            icon={<Coins size={11} />}
            tone={net > 0 ? 'bg-[#FFF3CC] text-[#8A6A1E]' : 'bg-[var(--wither)]/15 text-[var(--wither)]'}
            label={`${net > 0 ? '+' : ''}${net}P`}
          />
        )}
        {recap.upkeepPaid > 0 && recap.pointsEarned > 0 && (
          <StatChip
            tone="bg-[var(--leaf-soft)]/50 text-[var(--fg-muted)]"
            label={`수익 +${recap.pointsEarned}P · 유지비 −${recap.upkeepPaid}P`}
          />
        )}
        {recap.xpGained > 0 && (
          <StatChip icon={<Sparkles size={11} />} tone="bg-[var(--bloom-soft)] text-[var(--bloom)]" label={`+${recap.xpGained} XP`} />
        )}
        {healthDelta !== 0 && (
          <StatChip
            icon={<Heart size={11} />}
            tone={healthDelta > 0 ? 'bg-[var(--leaf-soft)] text-[var(--leaf-strong,var(--leaf))]' : 'bg-[var(--wither)]/15 text-[var(--wither)]'}
            label={`생기 ${recap.healthBefore}→${recap.healthAfter} (${healthDelta > 0 ? '+' : ''}${healthDelta})`}
          />
        )}
      </div>

      {/* 변화 요약 한 줄 */}
      {(recap.grown > 0 || recap.bloomed > 0 || recap.withered > 0 || recap.regressed > 0 || recap.lost > 0 || recap.streakSeed) && (
        <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-[var(--fg-muted)] tabular-nums">
          {recap.grown > 0 && <span>🌱 자람 {recap.grown}</span>}
          {recap.bloomed > 0 && <span className="text-[var(--bloom)]">🌸 만개 {recap.bloomed}</span>}
          {recap.withered > 0 && <span className="text-[var(--wither)]">🍂 시듦 {recap.withered}</span>}
          {recap.regressed > 0 && <span className="text-[var(--wither)]">🥀 한 단계 시듦 {recap.regressed}</span>}
          {recap.lost > 0 && <span className="text-[#A83A30]">💀 떠나보냄 {recap.lost}</span>}
          {recap.streakSeed && <span className="text-[var(--leaf-strong,var(--leaf))]">🎁 스트릭 보너스 씨앗</span>}
        </p>
      )}

      {/* 식물별 상세 */}
      {sortedPlants.length > 0 && (
        <div className="space-y-1 border-t border-[var(--leaf-soft)] pt-2">
          {shown.map((p) => {
            const sp = speciesOf(p.speciesId);
            const ev = primaryEvent(p);
            // 만개했거나 수익을 낸(=다 자란) 식물은 만개 모습으로, 그 외엔 새싹 크기로.
            const mature = ev === 'bloomed' || (p.yield ?? 0) > 0;
            return (
              <div key={p.plantId} className="flex items-center gap-2 text-xs">
                <PlantSVG
                  speciesId={p.speciesId}
                  stage={mature ? (sp?.stages ?? 4) - 1 : 1}
                  withered={ev === 'withered' || ev === 'regressed' || ev === 'died'}
                  rarity={sp?.rarity}
                  size={24}
                />
                <span className="shrink-0 font-medium text-[var(--fg-primary)]">{sp?.name ?? p.speciesId}</span>
                {ev && (
                  <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px]', EVENT_META[ev].chip)}>
                    {EVENT_META[ev].label}
                  </span>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-2 tabular-nums text-[11px]">
                  {p.yield ? <span className="text-[#8A6A1E]">+{p.yield}P</span> : null}
                  {p.xp ? <span className="text-[var(--bloom)]">+{p.xp}XP</span> : null}
                  {p.vitality ? <span className="text-[var(--leaf-strong,var(--leaf))]">생기 +{p.vitality}</span> : null}
                  {p.upkeep ? <span className="text-[var(--wither)]">−{p.upkeep}P</span> : null}
                </span>
              </div>
            );
          })}
          {(moreCount > 0 || expanded) && sortedPlants.length > MAX_PLANT_ROWS && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 pt-0.5 text-[11px] text-[var(--leaf-strong,var(--leaf))]"
            >
              {expanded ? <><ChevronUp size={12} /> 접기</> : <><ChevronDown size={12} /> {moreCount}그루 더 보기</>}
            </button>
          )}
        </div>
      )}

      {/* 빈 상세 — 식물 단위 변화 없이 생기/수익만 바뀐 날 */}
      {sortedPlants.length === 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--fg-faint)]">
          <Sprout size={12} /> 오늘은 정원 생기만 조용히 달라졌어요.
        </p>
      )}

      {recap.partial && (
        <p className="text-[10px] text-[var(--fg-faint)]">
          ※ 수익 정보만 먼저 표시됐어요. 정산이 동기화되면 성장·시듦까지 채워집니다.
        </p>
      )}
    </motion.section>
  );
}
