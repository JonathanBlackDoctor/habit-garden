import { describe, it, expect } from 'vitest';
import {
  speciesOf,
  dailyYieldOf,
  computePassiveYield,
  passiveYieldForDay,
  type YieldablePlant,
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

describe('passiveYieldForDay (서버·클라 공유 마커)', () => {
  const today = '2026-06-08';
  const cosmos = mature('cosmos'); // epic, 만개 → 10

  it('오늘 아직 정산 전이면 수확량을 반환한다', () => {
    expect(passiveYieldForDay([cosmos], undefined, today)).toBe(10);
    expect(passiveYieldForDay([cosmos], '2026-06-07', today)).toBe(10); // 어제 정산 → 오늘은 다시 지급
  });

  it('오늘 이미 정산했으면(lastYieldDate === gameDay) 0 — 중복 지급 방지', () => {
    expect(passiveYieldForDay([cosmos], today, today)).toBe(0);
  });
});
