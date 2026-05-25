/**
 * levelRewards — 레벨업 보상 계산의 단일 출처(SSOT).
 *
 * 서버(levelEngine)와 클라이언트(레벨업 창)가 같은 규칙을 쓰도록 순수 함수로 분리한다.
 * 규칙: 홀수 레벨 → 씨앗, 짝수 레벨 → 포인트, 5레벨 단위 → 큰 보상(포인트+씨앗).
 * 포인트는 그 레벨업에 소모한 XP(xpForLevel)에 비례한다.
 */
import { LEVELUP_REWARD } from '../types/firestore';
import { xpForLevel } from './xpLevel';

export interface LevelUpStep {
  /** 도달한 레벨 */
  level: number;
  /** 이 레벨에서 지급되는 포인트 */
  points: number;
  /** 씨앗 지급 여부 */
  seed: boolean;
  /** 5레벨 단위 마일스톤 여부 */
  milestone: boolean;
}

export interface LevelUpRewards {
  steps: LevelUpStep[];
  totalPoints: number;
  /** 지급 의도 씨앗 수 (정원 자리 상한 적용 전) */
  totalSeeds: number;
}

/** 특정 레벨에 도달했을 때 받는 보상을 계산한다. */
export function levelStepReward(newLevel: number): LevelUpStep {
  const consumedXp = xpForLevel(newLevel - 1); // 이 레벨업에 소모한 XP
  const milestone = newLevel % LEVELUP_REWARD.MILESTONE_EVERY === 0;
  let seed = newLevel % 2 === 1;
  let points = 0;
  if (newLevel % 2 === 0) {
    points += LEVELUP_REWARD.EVEN_BASE_POINTS + Math.floor(consumedXp * LEVELUP_REWARD.REWARD_RATE);
  }
  if (milestone) {
    points += Math.floor(consumedXp * LEVELUP_REWARD.REWARD_RATE * LEVELUP_REWARD.MILESTONE_MULTIPLIER);
    seed = true;
  }
  return { level: newLevel, points, seed, milestone };
}

/**
 * 레벨업 스텝들에 대해 실제로 지급할 씨앗 종 목록을 계산한다(정원 자리 상한 적용).
 * 씨앗 지급 규칙(마일스톤 씨앗 종·자리 상한)을 서버(levelEngine)와 클라이언트(Admin
 * 레벨 조절)가 동일하게 쓰도록 여기에 모은다.
 */
export function levelUpSeedSpeciesList(
  steps: LevelUpStep[],
  opts: { slotsAvailable: number; milestoneSpeciesUnlocked: boolean },
): string[] {
  const seeds: string[] = [];
  for (const step of steps) {
    if (!step.seed) continue;
    if (seeds.length >= opts.slotsAvailable) break;
    seeds.push(
      step.milestone && opts.milestoneSpeciesUnlocked
        ? LEVELUP_REWARD.MILESTONE_SEED_SPECIES
        : LEVELUP_REWARD.SEED_SPECIES,
    );
  }
  return seeds;
}

function aggregate(steps: LevelUpStep[]): LevelUpRewards {
  return {
    steps,
    totalPoints: steps.reduce((sum, s) => sum + s.points, 0),
    totalSeeds: steps.reduce((sum, s) => sum + (s.seed ? 1 : 0), 0),
  };
}

/** (fromLevel, toLevel] 구간의 보상을 모은다. 창 표시용. */
export function rewardsForLevelRange(fromLevel: number, toLevel: number): LevelUpRewards {
  const steps: LevelUpStep[] = [];
  for (let level = fromLevel + 1; level <= toLevel; level++) {
    steps.push(levelStepReward(level));
  }
  return aggregate(steps);
}

export interface LevelProgression extends LevelUpRewards {
  newLevel: number;
  remainingXp: number;
}

/**
 * 현재 레벨·누적 XP에서 가능한 만큼 레벨업을 소진하고 결과와 보상을 반환한다.
 * 서버 정산용 — XP를 실제로 소모하며 최종 레벨을 결정한다.
 */
export function resolveLevelUps(level: number, xp: number): LevelProgression {
  const steps: LevelUpStep[] = [];
  let needed = xpForLevel(level);
  while (xp >= needed) {
    xp -= needed;
    level += 1;
    steps.push(levelStepReward(level));
    needed = xpForLevel(level);
  }
  return { ...aggregate(steps), newLevel: level, remainingXp: xp };
}
