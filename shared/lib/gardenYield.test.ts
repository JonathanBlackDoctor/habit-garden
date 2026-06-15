import { describe, it, expect } from 'vitest';
import {
  speciesOf,
  dailyYieldOf,
  computePassiveYield,
  computeYieldBreakdown,
  type YieldablePlant,
  type IdentifiedPlant,
} from './gardenYield';
import { DAILY_YIELD_BY_RARITY } from '../types/firestore';

// 테스트에서 쓰는 종의 실제 정의(참조용):
//  sprout       basic     stages 4 (만개 stage 3)  dailyYield 없음 → basic 기본값 2
//  sunflower    common    stages 5 (만개 stage 4)  dailyYield 없음 → common 기본값 4
//  maple        rare      stages 6 (만개 stage 5)  dailyYield 없음 → rare 기본값 6
//  cosmos       epic      stages 5 (만개 stage 4)  dailyYield 없음 → epic 기본값 10
//  tree_of_life legendary stages 8 (만개 stage 7)  dailyYield 15
//  crystal_rose legendary stages 6 (만개 stage 5)  dailyYield 28 (등급 기본값과 다름)
//  celestial_tree transcendent stages 7 (만개 stage 6) dailyYield 0

function mature(speciesId: string): YieldablePlant {
  const sp = speciesOf(speciesId)!;
  return { speciesId, stage: sp.stages - 1 };
}

describe('dailyYieldOf', () => {
  it('종에 dailyYield 가 명시되어 있으면 그 값을 쓴다 (등급 기본값보다 우선)', () => {
    const crystalRose = speciesOf('crystal_rose')!;
    expect(crystalRose.dailyYield).toBe(28);
    expect(crystalRose.dailyYield).not.toBe(DAILY_YIELD_BY_RARITY.legendary);
    expect(dailyYieldOf(crystalRose)).toBe(28);
  });

  it('dailyYield 가 없으면 등급 기본값으로 폴백한다', () => {
    expect(dailyYieldOf(speciesOf('sprout')!)).toBe(DAILY_YIELD_BY_RARITY.basic);     // 2
    expect(dailyYieldOf(speciesOf('sunflower')!)).toBe(DAILY_YIELD_BY_RARITY.common); // 4
    expect(dailyYieldOf(speciesOf('maple')!)).toBe(DAILY_YIELD_BY_RARITY.rare);       // 6
    expect(dailyYieldOf(speciesOf('cosmos')!)).toBe(DAILY_YIELD_BY_RARITY.epic);      // 10
  });
});

describe('computePassiveYield', () => {
  it('빈 정원은 0', () => {
    expect(computePassiveYield([])).toBe(0);
  });

  it('만개한 식물은 일일 수확을 지급한다', () => {
    expect(computePassiveYield([mature('sprout')])).toBe(2);
    expect(computePassiveYield([mature('crystal_rose')])).toBe(28);
  });

  it('미성숙(stage < 만개) 식물은 지급하지 않는다', () => {
    expect(computePassiveYield([{ speciesId: 'sprout', stage: 0 }])).toBe(0);
    expect(computePassiveYield([{ speciesId: 'sprout', stage: 2 }])).toBe(0); // 만개는 stage 3
    // 만개 직전까지 0, 만개에서 지급
    expect(computePassiveYield([{ speciesId: 'sunflower', stage: 3 }])).toBe(0);
    expect(computePassiveYield([{ speciesId: 'sunflower', stage: 4 }])).toBe(4);
  });

  it('시든(witheredSince) 식물은 만개해도 지급하지 않는다', () => {
    const withered: YieldablePlant = { ...mature('crystal_rose'), witheredSince: { seconds: 1 } };
    expect(computePassiveYield([withered])).toBe(0);
  });

  it('초월(transcendent) 종은 만개해도 0 (보유·유지가 목적)', () => {
    expect(computePassiveYield([mature('celestial_tree')])).toBe(0);
  });

  it('알 수 없는 종은 무시한다', () => {
    expect(computePassiveYield([{ speciesId: 'does_not_exist', stage: 99 }])).toBe(0);
  });

  it('여러 식물의 수확을 합산한다 (만개분만)', () => {
    const plants: YieldablePlant[] = [
      mature('sprout'),        // +2
      mature('sunflower'),     // +4
      mature('crystal_rose'),  // +28
      mature('celestial_tree'),// +0 (초월)
      { speciesId: 'maple', stage: 1 },                          // 미성숙 → 0
      { ...mature('cosmos'), witheredSince: { seconds: 1 } },    // 시듦 → 0
    ];
    expect(computePassiveYield(plants)).toBe(2 + 4 + 28);
  });
});

describe('computeYieldBreakdown', () => {
  const id = (speciesId: string, n: string): IdentifiedPlant => {
    const sp = speciesOf(speciesId)!;
    return { id: n, speciesId, stage: sp.stages - 1 };
  };

  it('수익을 내는 식물만 id·종·수익으로 분해한다 (합계는 computePassiveYield 와 동일)', () => {
    const plants: IdentifiedPlant[] = [
      id('sprout', 'a'),        // +2
      id('crystal_rose', 'b'),  // +28
      id('celestial_tree', 'c'),// +0 (초월) → 제외
      { id: 'd', speciesId: 'maple', stage: 1 },                       // 미성숙 → 제외
      { ...id('cosmos', 'e'), witheredSince: { seconds: 1 } },         // 시듦 → 제외
    ];
    const breakdown = computeYieldBreakdown(plants);
    expect(breakdown).toEqual([
      { plantId: 'a', speciesId: 'sprout', yield: 2 },
      { plantId: 'b', speciesId: 'crystal_rose', yield: 28 },
    ]);
    const sum = breakdown.reduce((t, b) => t + b.yield, 0);
    expect(sum).toBe(computePassiveYield(plants));
  });

  it('빈 정원·수익 식물 없음은 빈 배열', () => {
    expect(computeYieldBreakdown([])).toEqual([]);
    expect(computeYieldBreakdown([{ id: 'x', speciesId: 'sprout', stage: 0 }])).toEqual([]);
  });
});
