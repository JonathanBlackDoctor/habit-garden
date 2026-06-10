import { describe, it, expect } from 'vitest';
import { PRAYER_VERSES, pickDailyVerse } from './prayerVerses';

describe('PRAYER_VERSES', () => {
  it('모든 구절에 reference와 text가 있다', () => {
    expect(PRAYER_VERSES.length).toBeGreaterThanOrEqual(10);
    for (const v of PRAYER_VERSES) {
      expect(v.reference.trim().length).toBeGreaterThan(0);
      expect(v.text.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('pickDailyVerse', () => {
  it('같은 날짜는 항상 같은 구절을 반환한다', () => {
    const a = pickDailyVerse('2026-06-10');
    const b = pickDailyVerse('2026-06-10');
    expect(a).toBe(b);
    expect(PRAYER_VERSES).toContain(a);
  });

  it('한 달에 걸쳐 여러 구절이 고르게 섞인다', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      const date = `2026-06-${String(d).padStart(2, '0')}`;
      seen.add(pickDailyVerse(date).reference);
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});
