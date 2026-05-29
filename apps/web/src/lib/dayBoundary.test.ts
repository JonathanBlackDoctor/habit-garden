import { describe, it, expect } from 'vitest';
import { plannerDate } from './dayBoundary';

// 04:00 KST 경계가 모든 실행 환경 타임존에서 동일하게 동작함을 고정한다.
// (이 경계가 어긋나면 C1 의 날짜 롤오버 및 앱 전반의 '오늘'이 깨진다)
describe('plannerDate — 04:00 KST 경계', () => {
  it('03:59 KST 는 아직 전날(플래너 기준)', () => {
    // 2026-05-29T18:59Z = 2026-05-30 03:59 KST
    expect(plannerDate(new Date('2026-05-29T18:59:00Z'))).toBe('2026-05-29');
  });

  it('정확히 04:00 KST 에 새 플래너 날로 전환', () => {
    // 2026-05-29T19:00Z = 2026-05-30 04:00 KST
    expect(plannerDate(new Date('2026-05-29T19:00:00Z'))).toBe('2026-05-30');
  });

  it('자정(00:00 KST)은 여전히 전날 플래너 날', () => {
    // 2026-05-29T15:00Z = 2026-05-30 00:00 KST
    expect(plannerDate(new Date('2026-05-29T15:00:00Z'))).toBe('2026-05-29');
  });

  it('01:30 KST 도 전날 플래너 날', () => {
    expect(plannerDate(new Date('2026-05-29T16:30:00Z'))).toBe('2026-05-29');
  });

  it('정오(12:00 KST)는 그날', () => {
    // 2026-05-29T03:00Z = 2026-05-29 12:00 KST
    expect(plannerDate(new Date('2026-05-29T03:00:00Z'))).toBe('2026-05-29');
  });
});
