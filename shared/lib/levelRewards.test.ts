import { describe, it, expect } from 'vitest';
import { resolveLevelUps, rewardsForLevelRange, levelStepReward } from './levelRewards';

// 레벨 보상은 서버(levelEngine)와 클라이언트 레벨업 창의 단일 출처(SSOT)다.
// H2(음수 XP 클램프)는 '레벨은 강등되지 않는다'는 전제에 기댄다 — 그 전제를 고정한다.
describe('resolveLevelUps', () => {
  it('XP 가 부족하면 레벨업 없음, remainingXp 보존', () => {
    const r = resolveLevelUps(1, 5);
    expect(r.newLevel).toBe(1);
    expect(r.steps).toHaveLength(0);
    expect(r.remainingXp).toBe(5);
    expect(r.totalPoints).toBe(0);
  });

  it('여러 레벨을 한 번에 소진하되 remainingXp 는 음수가 아니다', () => {
    const r = resolveLevelUps(1, 100_000);
    expect(r.newLevel).toBeGreaterThan(1);
    expect(r.remainingXp).toBeGreaterThanOrEqual(0);
    expect(r.steps.length).toBe(r.newLevel - 1); // level 1 에서 시작
  });

  it('레벨은 단조 증가 — 0 XP 로는 절대 내려가지 않는다', () => {
    expect(resolveLevelUps(5, 0).newLevel).toBe(5);
    expect(resolveLevelUps(5, 0).steps).toHaveLength(0);
  });
});

describe('levelStepReward', () => {
  it('홀수 레벨은 씨앗, 짝수 레벨은 포인트', () => {
    expect(levelStepReward(3).seed).toBe(true);
    expect(levelStepReward(4).points).toBeGreaterThan(0);
  });

  it('5의 배수는 마일스톤(씨앗+포인트)', () => {
    const s = levelStepReward(10);
    expect(s.milestone).toBe(true);
    expect(s.seed).toBe(true);
    expect(s.points).toBeGreaterThan(0);
  });
});

describe('rewardsForLevelRange', () => {
  it('(from, to] 구간 보상을 합산', () => {
    const r = rewardsForLevelRange(1, 3); // level 2, 3
    expect(r.steps).toHaveLength(2);
    expect(r.totalPoints).toBe(r.steps.reduce((sum, x) => sum + x.points, 0));
    expect(r.totalSeeds).toBe(r.steps.reduce((sum, x) => sum + (x.seed ? 1 : 0), 0));
  });
});
