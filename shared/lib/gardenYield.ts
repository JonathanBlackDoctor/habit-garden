/**
 * gardenYield — 만개 식물의 일일 자동 수확(passive yield) 순수 계산.
 *
 * firebase-admin 등 런타임 의존성이 없어 단위 테스트가 가능하다.
 * 서버(functions/gardenAutogrow.processDailyGarden)가 매일 04:00 KST 정산 때
 * 이 로직으로 spendablePoints/totalPoints 를 가산한다.
 */
import {
  PLANT_SPECIES,
  DAILY_YIELD_BY_RARITY,
  type PlantSpecies,
} from '../types/firestore';

export function speciesOf(id: string): PlantSpecies | undefined {
  return PLANT_SPECIES.find((s) => s.id === id);
}

/** 한 종의 일일 자동 수확(P). 종별 dailyYield 가 있으면 우선, 없으면 등급 기본값. */
export function dailyYieldOf(sp: PlantSpecies): number {
  return sp.dailyYield ?? DAILY_YIELD_BY_RARITY[sp.rarity];
}

/** passive yield 판정에 필요한 식물 정보 (PlantInstance 의 부분집합). */
export interface YieldablePlant {
  speciesId: string;
  stage: number;
  witheredSince?: unknown;   // 시든 식물은 수확하지 않는다 (truthy 면 제외)
}

/**
 * 정원에서 '만개(최고 stage)이며 시들지 않은' 식물들의 일일 자동 수확 합계를 구한다.
 *  - 미성숙(stage < max) 식물: 제외
 *  - 시든 식물(witheredSince truthy): 제외
 *  - 알 수 없는 종: 무시
 *  - 초월(transcendent) 종: dailyYield 0 이라 자연히 0 가산
 */
export function computePassiveYield(plants: readonly YieldablePlant[]): number {
  let total = 0;
  for (const p of plants) {
    const sp = speciesOf(p.speciesId);
    if (!sp) continue;
    const max = (sp.stages ?? 4) - 1;
    if (p.stage >= max && !p.witheredSince) {
      total += dailyYieldOf(sp);
    }
  }
  return total;
}

/**
 * 오늘(gameDay) 지급할 passive yield 를 계산한다.
 *  - 이미 오늘 정산했으면(lastYieldDate === gameDay) 0 을 반환해 중복 지급을 막는다.
 * 서버 리셋(processDailyGarden)과 클라이언트 폴백(maybeRunPassiveYield)이 동일 규칙·동일 마커를
 * 공유하므로, 둘 중 먼저 도는 쪽이 하루치를 정산하고 다른 쪽은 0 이 된다.
 */
export function passiveYieldForDay(
  plants: readonly YieldablePlant[],
  lastYieldDate: string | undefined,
  gameDay: string,
): number {
  if (lastYieldDate === gameDay) return 0;
  return computePassiveYield(plants);
}
