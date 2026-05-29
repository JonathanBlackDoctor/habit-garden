import { describe, it, expect } from 'vitest';
import { pointsForCheck, SCALED_ACHIEVE_THRESHOLD, PERFECT_BONUS } from './habitPoints';

// 습관 체크 → 포인트 매핑은 클라이언트(useHabits)와 서버(awardEngine)가 공유한다.
describe('pointsForCheck', () => {
  it('null(건너뛰기) → 0', () => {
    expect(pointsForCheck(10, 'scaled', null)).toBe(0);
    expect(pointsForCheck(10, 'binary', null)).toBe(0);
  });

  it('scaled 1점(미이행) → 0', () => {
    expect(pointsForCheck(10, 'scaled', 1)).toBe(0);
  });

  it('scaled 3점(달성) = weight×2', () => {
    expect(pointsForCheck(10, 'scaled', 3)).toBe(20);
  });

  it('scaled 5점 = weight×3 + PERFECT_BONUS', () => {
    expect(pointsForCheck(10, 'scaled', 5)).toBe(30 + PERFECT_BONUS);
  });

  it('binary 1 = weight×2, 0 = 0', () => {
    expect(pointsForCheck(7, 'binary', 1)).toBe(14);
    expect(pointsForCheck(7, 'binary', 0)).toBe(0);
  });

  it('scaled 점수가 있으면 weight 가 작아도 최소 1점', () => {
    expect(pointsForCheck(0, 'scaled', 2)).toBe(1);
  });

  it('범위 밖 점수는 1~5로 클램프 (4.7 → 5 취급)', () => {
    expect(pointsForCheck(10, 'scaled', 4.7)).toBe(30 + PERFECT_BONUS);
  });

  it('달성 임계는 3점', () => {
    expect(SCALED_ACHIEVE_THRESHOLD).toBe(3);
  });
});
