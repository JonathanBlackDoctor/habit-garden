import { describe, it, expect } from 'vitest';
import {
  baseInterval, backoffFactor, effectiveInterval, daysSince,
  dueScore, shouldBecomeDormant, selectTodayPrayers, type RotationInput,
} from './prayerRotation';

const DAY = 24 * 60 * 60 * 1000;
const TODAY = new Date('2026-05-23T00:00:00Z').getTime();

function item(over: Partial<RotationInput> = {}): RotationInput {
  return {
    id: over.id ?? 'p',
    priority: over.priority ?? 'mid',
    pinned: over.pinned ?? false,
    rotationDays: over.rotationDays,
    receivedAtMs: over.receivedAtMs ?? TODAY - 3 * DAY,
    lastPrayedAtMs: over.lastPrayedAtMs,
  };
}

describe('baseInterval', () => {
  it('우선순위 기본 주기를 반환한다', () => {
    expect(baseInterval('high')).toBe(2);
    expect(baseInterval('mid')).toBe(5);
    expect(baseInterval('low')).toBe(10);
  });
  it('rotationDays가 있으면 우선한다', () => {
    expect(baseInterval('low', 3)).toBe(3);
  });
  it('rotationDays가 0 이하면 무시한다', () => {
    expect(baseInterval('high', 0)).toBe(2);
    expect(baseInterval('high', -5)).toBe(2);
  });
});

describe('backoffFactor', () => {
  it('4주 미만은 1배', () => {
    expect(backoffFactor(TODAY - 3 * 7 * DAY, TODAY)).toBe(1);
  });
  it('4주마다 +50%', () => {
    expect(backoffFactor(TODAY - 4 * 7 * DAY, TODAY)).toBeCloseTo(1.5);
    expect(backoffFactor(TODAY - 8 * 7 * DAY, TODAY)).toBeCloseTo(2.0);
  });
  it('미래 날짜는 음수가 되지 않는다', () => {
    expect(backoffFactor(TODAY + 10 * DAY, TODAY)).toBe(1);
  });
});

describe('effectiveInterval', () => {
  it('baseInterval × backoff', () => {
    const it1 = item({ priority: 'mid', receivedAtMs: TODAY - 4 * 7 * DAY });
    expect(effectiveInterval(it1, TODAY)).toBeCloseTo(5 * 1.5);
  });
});

describe('daysSince', () => {
  it('lastPrayedAt 기준으로 계산', () => {
    const it1 = item({ lastPrayedAtMs: TODAY - 2 * DAY });
    expect(daysSince(it1, TODAY)).toBeCloseTo(2);
  });
  it('lastPrayedAt 없으면 receivedAt 기준', () => {
    const it1 = item({ receivedAtMs: TODAY - 4 * DAY, lastPrayedAtMs: undefined });
    expect(daysSince(it1, TODAY)).toBeCloseTo(4);
  });
});

describe('dueScore', () => {
  it('경과/실효주기 비율', () => {
    const it1 = item({ priority: 'mid', lastPrayedAtMs: TODAY - 5 * DAY, receivedAtMs: TODAY - 5 * DAY });
    expect(dueScore(it1, TODAY)).toBeCloseTo(1);
  });
});

describe('shouldBecomeDormant', () => {
  it('high는 120일 초과 시 잠듦', () => {
    const itDormant = item({ priority: 'high', lastPrayedAtMs: TODAY - 121 * DAY, receivedAtMs: TODAY - 200 * DAY });
    expect(shouldBecomeDormant(itDormant, TODAY)).toBe(true);
    const itActive = item({ priority: 'high', lastPrayedAtMs: TODAY - 119 * DAY, receivedAtMs: TODAY - 200 * DAY });
    expect(shouldBecomeDormant(itActive, TODAY)).toBe(false);
  });
  it('mid는 75일, low는 45일 임계', () => {
    expect(shouldBecomeDormant(item({ priority: 'mid', lastPrayedAtMs: TODAY - 76 * DAY }), TODAY)).toBe(true);
    expect(shouldBecomeDormant(item({ priority: 'low', lastPrayedAtMs: TODAY - 46 * DAY }), TODAY)).toBe(true);
  });
  it('pinned는 절대 잠들지 않는다', () => {
    const it1 = item({ priority: 'low', pinned: true, lastPrayedAtMs: TODAY - 999 * DAY });
    expect(shouldBecomeDormant(it1, TODAY)).toBe(false);
  });
});

describe('selectTodayPrayers', () => {
  it('pinned는 항상 포함되고 망각 무관', () => {
    const items = [
      item({ id: 'a', pinned: true, priority: 'low', lastPrayedAtMs: TODAY - 1 * DAY }),
      item({ id: 'b', pinned: false, priority: 'low', lastPrayedAtMs: TODAY - 1 * DAY }), // dueScore < 1
    ];
    const res = selectTodayPrayers(items, TODAY);
    expect(res.pinnedIds).toContain('a');
    expect(res.rotationIds).not.toContain('a');
    expect(res.rotationIds).not.toContain('b'); // 아직 due 아님
  });

  it('dueScore × weight 내림차순 정렬', () => {
    const items = [
      item({ id: 'low-old', priority: 'low', receivedAtMs: TODAY - 30 * DAY, lastPrayedAtMs: TODAY - 30 * DAY }),
      item({ id: 'high-due', priority: 'high', receivedAtMs: TODAY - 6 * DAY, lastPrayedAtMs: TODAY - 6 * DAY }),
    ];
    const res = selectTodayPrayers(items, TODAY);
    expect(res.rotationIds[0]).toBe('high-due');
  });

  it('상한 limit까지만 반환', () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      item({ id: `p${i}`, priority: 'high', receivedAtMs: TODAY - 30 * DAY, lastPrayedAtMs: TODAY - 30 * DAY }),
    );
    const res = selectTodayPrayers(items, TODAY, 9);
    expect(res.rotationIds).toHaveLength(9);
  });

  it('due 아닌 항목은 제외', () => {
    const items = [
      item({ id: 'fresh', priority: 'mid', receivedAtMs: TODAY - 1 * DAY, lastPrayedAtMs: TODAY - 1 * DAY }),
    ];
    const res = selectTodayPrayers(items, TODAY);
    expect(res.rotationIds).toHaveLength(0);
  });
});
