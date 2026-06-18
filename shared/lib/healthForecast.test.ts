import { describe, it, expect } from 'vitest';
import { projectTomorrowHealth, HEALTH_RULES, type HealthForecastInput } from './healthForecast';
import { HABIT_PENALTY, type HabitDoc, type HabitCheckDoc, type PlantInstance } from '../types/firestore';

const DATE = '2026-06-15';

function habit(id: string, over: Partial<HabitDoc> = {}): HabitDoc {
  return {
    id, title: id, weight: 5, timeOfDay: 'anytime', order: 0,
    scoreMode: 'binary', achieveThreshold: 1, iconName: 'x', active: true,
    ...over,
  };
}

function check(score: number | null, achieved: boolean): HabitCheckDoc {
  return { habitId: 'x', score, achieved, checkedAt: {} as any };
}

function plant(speciesId: string): PlantInstance {
  return { id: speciesId, speciesId, stage: 5, plantedAt: {} as any };
}

function run(over: Partial<HealthForecastInput>): ReturnType<typeof projectTomorrowHealth> {
  return projectTomorrowHealth({
    currentHealth: 80, habits: [], checks: {}, plants: [],
    spendablePoints: 1000, protectedDay: false, date: DATE,
    ...over,
  });
}

describe('projectTomorrowHealth', () => {
  it('습관이 없으면 noHabits=true', () => {
    const f = run({ habits: [] });
    expect(f.noHabits).toBe(true);
  });

  it('기록이 없으면 hasAnyCheck=false (실패 + 미기록 패널티 합산)', () => {
    // 8개 미기록 → 패널티 min(8*5,40)=40, 실패 -35, 자연감소 -5 → 80-35-5-40=0
    const habits = Array.from({ length: 8 }, (_, i) => habit(`h${i}`));
    const f = run({ habits, currentHealth: 80 });
    expect(f.hasAnyCheck).toBe(false);
    expect(f.daySuccess).toBe(false);
    expect(f.habitHealthLoss).toBe(HABIT_PENALTY.DAILY_HEALTH_CAP);
    expect(f.projected).toBe(0);
    expect(f.delta).toBe(-80);
  });

  it('전부 달성하면 성공 보너스, 패널티 0', () => {
    const habits = [habit('a'), habit('b')];
    const checks = { a: check(1, true), b: check(1, true) };
    const f = run({ habits, checks, currentHealth: 80 });
    expect(f.daySuccess).toBe(true);
    expect(f.successDelta).toBe(HEALTH_RULES.SUCCESS_DELTA);
    expect(f.habitHealthLoss).toBe(0);
    expect(f.projected).toBe(90);                   // 80 +15(성공) -5(자연감소)
  });

  it('성공 판정은 기록된(score≠null) 체크 기준 — 1개만 달성·기록해도 성공', () => {
    const habits = [habit('a'), habit('b'), habit('c')];
    const checks = { a: check(1, true) };           // b,c 미기록
    const f = run({ habits, checks, currentHealth: 80 });
    expect(f.daySuccess).toBe(true);                // 달성/기록 = 1/1 = 100%
    // 미기록 b,c 패널티 = 2*5=10, 성공 +15, 자연감소 -5 → 80+15-5-10=80
    expect(f.habitHealthLoss).toBe(10);
    expect(f.projected).toBe(80);
  });

  it('미달성·미기록이 섞인 실패일 패널티', () => {
    const habits = [habit('a'), habit('b'), habit('c')];
    const checks = { a: check(0, false), b: check(0, false) };  // 미달성 2, c 미기록 1
    const f = run({ habits, checks, currentHealth: 70 });
    expect(f.daySuccess).toBe(false);               // 0/2 = 0%
    // 미달성 3+3, 미기록 5 → 11, 실패 -35, 자연감소 -5 → 70-35-5-11=19
    expect(f.habitHealthLoss).toBe(11);
    expect(f.projected).toBe(19);
  });

  it('건너뛰기(score=null)는 성공 분모·패널티에서 모두 제외', () => {
    const habits = [habit('a'), habit('b')];
    const checks = { a: check(1, true), b: check(null, false) };  // b 건너뜀
    const f = run({ habits, checks, currentHealth: 80 });
    expect(f.daySuccess).toBe(true);                // 1/1
    expect(f.habitHealthLoss).toBe(0);              // 건너뜀은 패널티 없음
    expect(f.projected).toBe(90);                   // 80 +15 -5
  });

  it('flipsToSuccessNeeded — 미달성 2개 중 하나만 뒤집으면 성공(1/2=50%<60%, 2/2 필요)', () => {
    const habits = [habit('a'), habit('b')];
    const checks = { a: check(0, false), b: check(0, false) };
    const f = run({ habits, checks });
    expect(f.flipsToSuccessNeeded).toBe(2);         // 1/2=50% 미달, 2/2=100% 달성
  });

  it('flipsToSuccessNeeded — 3개 중 1 달성 2 미달성이면 1개만 더', () => {
    const habits = [habit('a'), habit('b'), habit('c')];
    const checks = { a: check(1, true), b: check(0, false), c: check(0, false) };
    // 현재 1/3=33%. 미달성 하나 뒤집으면 2/3=66%≥60% → 1
    const f = run({ habits, checks });
    expect(f.flipsToSuccessNeeded).toBe(1);
  });

  it('보호된 날 — 실패여도 패널티·자연감소 없음 (생기 변동 없음)', () => {
    const habits = [habit('a'), habit('b')];
    const checks = { a: check(0, false) };          // 실패 + 미기록
    const f = run({ habits, checks, currentHealth: 60, protectedDay: true });
    expect(f.successDelta).toBe(0);
    expect(f.habitHealthLoss).toBe(0);
    expect(f.projected).toBe(60);
  });

  it('eternal_bloom — 성공·유지비 충분 시 생기 +1', () => {
    const habits = [habit('a')];
    const checks = { a: check(1, true) };
    const f = run({ habits, checks, plants: [plant('eternal_bloom')], currentHealth: 80, spendablePoints: 100 });
    expect(f.transcendentVitality).toBe(1);
    expect(f.projected).toBe(91);                   // 80 +15(성공) +1(초월) -5(자연감소)
  });

  it('eternal_bloom — 실패(미보호)면 즉사라 보너스 없음', () => {
    const habits = [habit('a')];
    const checks = { a: check(0, false) };
    const f = run({ habits, checks, plants: [plant('eternal_bloom')], currentHealth: 80, spendablePoints: 100 });
    expect(f.transcendentVitality).toBe(0);
  });

  it('eternal_bloom — 유지비 부족이면 보너스 없음', () => {
    const habits = [habit('a')];
    const checks = { a: check(1, true) };
    const f = run({ habits, checks, plants: [plant('eternal_bloom')], spendablePoints: 10 });
    expect(f.transcendentVitality).toBe(0);
  });

  it('100 초과 클램프', () => {
    const habits = [habit('a')];
    const checks = { a: check(1, true) };
    const f = run({ habits, checks, currentHealth: 99 });
    expect(f.projected).toBe(95);                   // 99+15=114→100 클램프 후 자연감소 -5 → 95
  });

  it('0 미만 클램프', () => {
    const habits = Array.from({ length: 8 }, (_, i) => habit(`h${i}`));
    const f = run({ habits, checks: { h0: check(0, false) }, currentHealth: 5 });
    expect(f.projected).toBe(0);
  });

  it('시들기 구간 진입 감지 (현재>50, 예보≤50)', () => {
    const habits = Array.from({ length: 8 }, (_, i) => habit(`h${i}`));
    const f = run({ habits, currentHealth: 60 });   // 60-35-5=20, 패널티40 → 0 ≤50
    expect(f.intoWitheringZone).toBe(true);
  });

  it('이미 시들기 구간이면 새 진입으로 보지 않음', () => {
    const habits = [habit('a')];
    const checks = { a: check(1, true) };
    const f = run({ habits, checks, currentHealth: 45 });  // 45+15-5=55, current<=50
    expect(f.intoWitheringZone).toBe(false);
  });

  it('휴면 습관은 패널티 대상에서 제외', () => {
    const habits = [
      habit('a', { hibernatedSince: '2026-06-01' }),  // 휴면 중 (until 없음)
      habit('b'),
    ];
    const checks = { b: check(1, true) };
    const f = run({ habits, checks, currentHealth: 80 });
    // a는 휴면이라 미기록 패널티 없음, b 성공 → 1/1 성공 +15, 자연감소 -5
    expect(f.habitHealthLoss).toBe(0);
    expect(f.projected).toBe(90);
  });
});
