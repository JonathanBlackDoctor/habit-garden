import { describe, it, expect } from 'vitest';
import { buildYesterdayRecap } from './yesterdayRecap';
import type { HabitCheckDoc, HabitDoc } from 'shared/types/firestore';

function habit(over: Partial<HabitDoc> & { id: string }): HabitDoc {
  return {
    title: over.id,
    weight: 5,
    timeOfDay: 'anytime',
    order: 0,
    scoreMode: 'scaled',
    achieveThreshold: 3,
    iconName: 'sun',
    active: true,
    ...over,
  };
}

function check(habitId: string, score: number | null, whyMissed?: string): HabitCheckDoc {
  return { habitId, score, achieved: false, whyMissed, checkedAt: {} as any };
}

describe('buildYesterdayRecap', () => {
  it('습관이 없으면 null', () => {
    expect(buildYesterdayRecap([], {})).toBeNull();
  });

  it('어제 체크가 하나도 없으면 null (첫날·미사용 — 잔소리 금지)', () => {
    const habits = [habit({ id: 'a' }), habit({ id: 'b' })];
    expect(buildYesterdayRecap(habits, {})).toBeNull();
  });

  it('전부 건너뜀이면 null', () => {
    const habits = [habit({ id: 'a' })];
    expect(buildYesterdayRecap(habits, { a: check('a', null) })).toBeNull();
  });

  it('달성·미달·미기록·건너뜀을 분류한다', () => {
    const habits = [
      habit({ id: 'done',    weight: 5 }),
      habit({ id: 'low',     weight: 7 }),                       // 점수 미달
      habit({ id: 'none',    weight: 3 }),                       // 미기록
      habit({ id: 'skip',    weight: 9 }),                       // 건너뜀 — 중립
      habit({ id: 'bin',     weight: 4, scoreMode: 'binary', achieveThreshold: 1 }), // 이진 미완료
    ];
    const recap = buildYesterdayRecap(habits, {
      done: check('done', 4),
      low:  check('low', 2, '피곤해서'),
      skip: check('skip', null),
      bin:  check('bin', 0),
    })!;

    expect(recap.achieved).toBe(1);
    expect(recap.intended).toBe(4); // 5개 중 건너뜀 1개 제외
    expect(recap.missed.map((m) => m.habit.id)).toEqual(['low', 'bin']); // 가중치 내림차순
    expect(recap.missed[0].whyMissed).toBe('피곤해서');
    expect(recap.unrecorded.map((h) => h.id)).toEqual(['none']);
    expect(recap.allDone).toBe(false);
  });

  it('focus 는 미달·미기록 중 가중치 최고 습관', () => {
    const habits = [
      habit({ id: 'done',  weight: 10 }),
      habit({ id: 'low',   weight: 6 }),
      habit({ id: 'none',  weight: 8 }), // 미기록이지만 가중치가 더 높음
    ];
    const recap = buildYesterdayRecap(habits, {
      done: check('done', 5),
      low:  check('low', 1),
    })!;
    expect(recap.focus?.id).toBe('none');
  });

  it('달성 판정은 저장된 achieved 가 아니라 점수로 재계산 (scaled 임계 3)', () => {
    const habits = [habit({ id: 'a' })];
    // achieved=false 로 저장돼 있어도 점수 3이면 달성
    const recap = buildYesterdayRecap(habits, { a: check('a', 3) })!;
    expect(recap.achieved).toBe(1);
    expect(recap.allDone).toBe(true);
    expect(recap.focus).toBeNull();
  });

  it('모두 달성하면 allDone', () => {
    const habits = [habit({ id: 'a' }), habit({ id: 'b', scoreMode: 'binary', achieveThreshold: 1 })];
    const recap = buildYesterdayRecap(habits, { a: check('a', 5), b: check('b', 1) })!;
    expect(recap.allDone).toBe(true);
    expect(recap.achieved).toBe(2);
    expect(recap.intended).toBe(2);
  });
});
