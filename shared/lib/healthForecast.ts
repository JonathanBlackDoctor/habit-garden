/**
 * healthForecast — "내일 정원 생기" 선제적 예보 (클라이언트·서버 공유 순수 계산).
 *
 * 정원 생기(health)는 매일 04:00 KST 서버 리셋에서 '어제' 행동을 기준으로 한 번 계산된다
 * (dailyReset → processDailyGarden + applyHabitPenalty). 그래서 기존 피드백은 전부 회고적이다.
 * 이 모듈은 그 계산을 그대로 거울처럼 미러링해, 사용자가 '오늘' 행동하는 도중에
 * "이대로면 내일 생기가 어떻게 될지"를 실시간으로 미리 볼 수 있게 한다.
 *
 * 정확성이 핵심이다 — 실제 값은 같은 입력으로 서버가 계산하므로, 공식이 어긋나면 신뢰를 잃는다.
 * 서버가 쓰는 임계·델타는 HEALTH_RULES 로 모아 두고 서버(gardenAutogrow·dailyReset)도 이를
 * 소비하게 해서 drift 를 구조적으로 막는다.
 *
 * firebase-admin 등 런타임 의존성이 없어 단위 테스트가 가능하다.
 */
import {
  HABIT_PENALTY,
  type HabitDoc,
  type HabitCheckDoc,
  type PlantInstance,
} from '../types/firestore';
import { inHibernationWindow } from './hibernation';
import { SCALED_ACHIEVE_THRESHOLD } from './habitPoints';
import { speciesOf } from './gardenYield';

/**
 * 서버 생기 계산이 쓰는 임계·델타. 현재 dailyReset/gardenAutogrow 에 인라인 리터럴로
 * 흩어져 있던 값을 한곳에 모은다. 서버도 이 상수를 import 해서 예보와 항상 일치시킨다.
 */
// 생기 변화폭 확대(매우 강하게) + 자연 감소: 하루 습관 성과로 생기가 크게 출렁이고,
// 보호되지 않은 날은 매일 자연히 줄어 '계속 가꿔야 유지되는' 자원이 된다.
export const HEALTH_RULES = {
  SUCCESS_THRESHOLD: 0.6, // dayScore(달성/기록) 이 값 이상이면 성공
  SUCCESS_DELTA: 15,      // 성공일 → 생기 +15
  FAILURE_DELTA: -35,     // 실패일(보호 안 됨) → 생기 -35
  DAILY_DECAY: 5,         // 자연 감소 — 보호 안 된 날은 성공·실패와 무관하게 매일 -5
  WITHER_AT: 50,          // 생기 이 값 이하이면 식물 하나가 시들 수 있음
} as const;

export interface HealthForecastInput {
  currentHealth: number;
  habits: HabitDoc[];                       // 활성 습관 (useHabits 결과). 휴면은 내부에서 제외.
  checks: Record<string, HabitCheckDoc>;    // 오늘의 체크, habit.id 키
  plants: PlantInstance[];                  // eternal_bloom(초월) 생기 보너스 감지용
  spendablePoints: number;                  // 초월 식물 유지비(upkeep) 생존 판정
  protectedDay: boolean;                    // 휴가(vacationUntil)/freeze 토큰으로 보호된 날인가 (실패일에만 효력)
  weeklyGraceProtectable?: boolean;         // 주간 그레이스로 막을 수 있는 상태인가 — 스트릭>0 && 이번 주 미사용. 서버 tryConsumeStreakProtection 미러.
  date: string;                             // 게임일 'YYYY-MM-DD' (휴면 구간 판정용)
}

export interface HealthForecast {
  current: number;
  projected: number;
  delta: number;
  daySuccess: boolean;
  successDelta: number;          // 성공 +SUCCESS_DELTA / 0(보호) / 실패 FAILURE_DELTA
  dailyDecay: number;            // 자연 감소 (보호된 날은 0)
  habitHealthLoss: number;       // 습관 미완료 패널티 (상한 적용)
  transcendentVitality: number;  // eternal_bloom 등 초월 식물 생기 보너스
  flipsToSuccessNeeded: number;  // 성공 임계를 넘기려면 추가로 달성해야 할 습관 수
  intoWitheringZone: boolean;    // 지금은 안전한데 예보상 시들기 구간(≤50)으로 떨어지는가
  noHabits: boolean;             // 활성·비휴면 습관이 없음
  hasAnyCheck: boolean;          // 오늘 기록(score≠null)이 하나라도 있는가 — '기록 전' 상태 판별
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** 체크가 '달성'으로 인정되는가 — 서버 패널티 로직과 동일 기준. */
function isAchieved(h: HabitDoc, c: HabitCheckDoc): boolean {
  const threshold = h.scoreMode === 'scaled' ? SCALED_ACHIEVE_THRESHOLD : h.achieveThreshold;
  return c.achieved || (c.score !== null && c.score >= threshold);
}

/**
 * 오늘 데이터로 내일 아침 정산이 돌았을 때의 생기를 예측한다.
 * 서버 순서를 그대로 따른다: 성공 델타 → 자연 감소 → 초월 생기 보너스 → (시들기 판정) → 습관 패널티.
 * (decay 와 초월 보너스 순서는 100 클램프 때문에 결과가 달라지므로 서버와 정확히 일치시킨다.)
 */
export function projectTomorrowHealth(input: HealthForecastInput): HealthForecast {
  const { currentHealth, checks, plants, spendablePoints, date } = input;
  const current = clamp(currentHealth);

  // 활성·비휴면 습관만 패널티·달성 판단 대상 (서버 applyHabitPenalty 와 동일).
  const habits = input.habits.filter((h) => h.active && !inHibernationWindow(h, date, date));
  const noHabits = habits.length === 0;

  // ── 1) 하루 성공 판정 (서버 dailyReset 과 동일: 기록된(score≠null) 체크 기준) ──
  const scored = Object.values(checks).filter((c) => c.score !== null);
  const achievedScored = scored.filter((c) => c.achieved).length;
  const hasAnyCheck = scored.length > 0;
  const daySuccess = scored.length > 0 && achievedScored / scored.length >= HEALTH_RULES.SUCCESS_THRESHOLD;

  // ── 1.5) 보호일 판정 — 서버 dailyReset.processUserDay 와 정확히 일치시킨다.
  //   서버는 '성공하지 못한 날'에만 보호를 평가한다(성공일은 보호와 무관, 자연감소는 그대로).
  //   실패일이면: 휴가/freeze(스트릭 무관) + 주간 그레이스(스트릭>0 && 주 1회 미사용)로 보호.
  //   그레이스를 빼먹으면 '스트릭 유지 중 그 주 첫 실패일'에 예보가 폭락하지만 실제 정산은
  //   보호되어 생기가 그대로라, 예보가 서버와 크게 어긋난다(신뢰 붕괴) — 그래서 함께 반영한다.
  const protectedDay = !daySuccess && (input.protectedDay || (input.weeklyGraceProtectable ?? false));

  // ── 2) 생기 델타 (보호된 날은 실패 페널티 없음) ──
  const successDelta = daySuccess
    ? HEALTH_RULES.SUCCESS_DELTA
    : protectedDay
      ? 0
      : HEALTH_RULES.FAILURE_DELTA;

  // 자연 감소(3-3) — 보호된 날은 면제, 그 외엔 성공·실패 무관하게 매일 빠진다.
  const dailyDecay = protectedDay ? 0 : HEALTH_RULES.DAILY_DECAY;

  // ── 3) 초월(eternal_bloom 등) 생기 보너스 — 유지비를 낼 수 있고, 성공·보호된 날에만 생존 ──
  let budget = spendablePoints;
  let transcendentVitality = 0;
  for (const p of plants) {
    const trait = speciesOf(p.speciesId)?.trait;
    if (trait?.kind !== 'transcendent') continue;
    if (budget < trait.upkeep) continue;          // 유지비 미납 → 죽음, 보너스 없음
    if (!daySuccess && !protectedDay) continue;   // 게으른 미보호일 → 즉사, 보너스 없음
    budget -= trait.upkeep;
    if (trait.effect === 'vitality') transcendentVitality += trait.amount;
  }

  // ── 4) 습관 미완료 패널티 (보호된 날은 전체 스킵, 합계는 상한) ──
  let habitHealthLoss = 0;
  if (!protectedDay) {
    for (const h of habits) {
      const c = checks[h.id];
      if (!c) {
        habitHealthLoss += HABIT_PENALTY.HEALTH_PER_TODO;        // 미기록(방치)
      } else if (c.score === null) {
        continue;                                                 // 건너뛰기 — 제외
      } else if (!isAchieved(h, c)) {
        habitHealthLoss += HABIT_PENALTY.HEALTH_PER_MISSED;       // 미달성(시도)
      }
    }
    habitHealthLoss = Math.min(habitHealthLoss, HABIT_PENALTY.DAILY_HEALTH_CAP);
  }

  // ── 종합 (서버 적용 순서·클램프 그대로) ──
  let h = current;
  if (daySuccess) h = Math.min(100, h + HEALTH_RULES.SUCCESS_DELTA);
  else if (!protectedDay) h = Math.max(0, h + HEALTH_RULES.FAILURE_DELTA);
  // 서버(gardenAutogrow)는 자연 감소를 먼저 적용한 뒤 초월 보너스를 더한다.
  // 100 클램프가 끼면 둘의 순서가 결과를 바꾸므로(예: 영겁화·성공·고생기일) 동일 순서를 지킨다.
  if (dailyDecay) h = Math.max(0, h - dailyDecay);
  h = Math.min(100, h + transcendentVitality);
  const projected = Math.max(0, h - habitHealthLoss);

  return {
    current,
    projected,
    delta: projected - current,
    daySuccess,
    successDelta,
    dailyDecay,
    habitHealthLoss,
    transcendentVitality,
    flipsToSuccessNeeded: flipsToSuccess(habits, checks, scored.length, achievedScored),
    intoWitheringZone: projected <= HEALTH_RULES.WITHER_AT && current > HEALTH_RULES.WITHER_AT,
    noHabits,
    hasAnyCheck,
  };
}

/**
 * 성공 임계(0.6)를 넘기려면 추가로 몇 개를 더 '달성'해야 하는지.
 * 이미 기록됐지만 미달성인 습관(분모에 포함)을 먼저 뒤집는 게 비율을 빨리 올리므로 우선한다.
 * 미기록·건너뛰기 습관을 달성하면 분자·분모가 함께 +1 된다는 점을 반영한다.
 */
function flipsToSuccess(
  habits: HabitDoc[],
  checks: Record<string, HabitCheckDoc>,
  scoredTotal: number,
  achievedCount: number,
): number {
  if (scoredTotal > 0 && achievedCount / scoredTotal >= HEALTH_RULES.SUCCESS_THRESHOLD) return 0;

  const missed: boolean[] = [];     // 기록됐으나 미달성 (분모에 이미 포함)
  const unrecorded: boolean[] = []; // 미기록·건너뛰기 (달성 시 분모도 +1)
  for (const h of habits) {
    const c = checks[h.id];
    if (c && c.score !== null) {
      if (isAchieved(h, c)) continue;
      missed.push(true);
    } else {
      unrecorded.push(true);
    }
  }

  let total = scoredTotal;
  let achieved = achievedCount;
  let flips = 0;
  // 미달성(분모 유지) → 미기록(분모 증가) 순으로 그리디하게 채운다.
  for (let i = 0; i < missed.length; i++) {
    achieved += 1; flips += 1;
    if (achieved / total >= HEALTH_RULES.SUCCESS_THRESHOLD) return flips;
  }
  for (let i = 0; i < unrecorded.length; i++) {
    total += 1; achieved += 1; flips += 1;
    if (total > 0 && achieved / total >= HEALTH_RULES.SUCCESS_THRESHOLD) return flips;
  }
  return flips;
}
