import { describe, it, expect } from 'vitest';
import {
  baseInterval, backoffFactor, effectiveInterval, daysSince,
  dueScore, shouldBecomeDormant, selectTodayPrayers,
  adaptiveDailyLimit, dayJitter, type RotationInput,
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
    target: over.target,
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

  it('dueScore × weight 내림차순 정렬 (jitter 무관하게 우열 유지)', () => {
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
    const res = selectTodayPrayers(items, TODAY, { limit: 9 });
    expect(res.rotationIds).toHaveLength(9);
  });

  it('due 아닌 (시작된) 항목은 제외', () => {
    const items = [
      item({ id: 'fresh', priority: 'mid', receivedAtMs: TODAY - 1 * DAY, lastPrayedAtMs: TODAY - 1 * DAY }),
    ];
    const res = selectTodayPrayers(items, TODAY);
    expect(res.rotationIds).toHaveLength(0);
  });

  // ── A: 신규(미시작) 우대 + 하루 신규 상한 ───────────────────
  it('미시작 항목은 dueScore<1 이어도 신규 슬롯으로 등장', () => {
    const items = [
      item({ id: 'new', priority: 'low', receivedAtMs: TODAY, lastPrayedAtMs: undefined }),
    ];
    const res = selectTodayPrayers(items, TODAY);
    expect(res.rotationIds).toContain('new');
  });

  it('하루 신규 상한(newPerDay)만큼만 노출 — 무더기 분산', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      item({ id: `n${i}`, priority: 'mid', receivedAtMs: TODAY - i * 1000, lastPrayedAtMs: undefined }),
    );
    const res = selectTodayPrayers(items, TODAY, { newPerDay: 3 });
    expect(res.rotationIds).toHaveLength(3);
  });

  it('신규는 받은날 최신순(다음날 단일 추가가 무더기 backlog보다 앞섬)', () => {
    const items = [
      item({ id: 'old-bulk', priority: 'mid', receivedAtMs: TODAY - 1 * DAY, lastPrayedAtMs: undefined }),
      item({ id: 'fresh', priority: 'mid', receivedAtMs: TODAY, lastPrayedAtMs: undefined }),
    ];
    const res = selectTodayPrayers(items, TODAY, { newPerDay: 1 });
    expect(res.rotationIds).toEqual(['fresh']);
  });

  it('신규 슬롯과 로테이션이 함께 채워진다', () => {
    const items = [
      item({ id: 'new1', priority: 'mid', receivedAtMs: TODAY, lastPrayedAtMs: undefined }),
      item({ id: 'due1', priority: 'high', receivedAtMs: TODAY - 10 * DAY, lastPrayedAtMs: TODAY - 10 * DAY }),
    ];
    const res = selectTodayPrayers(items, TODAY, { limit: 9, newPerDay: 3 });
    expect(res.rotationIds).toContain('new1');
    expect(res.rotationIds).toContain('due1');
  });

  // ── B: 사람(target) 소프트 페널티 ───────────────────────────
  it('같은 target이 목록을 독식하지 않고 분산된다', () => {
    // 같은 사람 5개(살짝 더 due) + 다른 사람 1개. 소프트 페널티로 다른 사람도 진입.
    const many = Array.from({ length: 5 }, (_, i) =>
      item({ id: `kim${i}`, priority: 'mid', target: '김씨', receivedAtMs: TODAY - 20 * DAY, lastPrayedAtMs: TODAY - 20 * DAY }),
    );
    const other = item({ id: 'lee', priority: 'mid', target: '이씨', receivedAtMs: TODAY - 12 * DAY, lastPrayedAtMs: TODAY - 12 * DAY });
    const res = selectTodayPrayers([...many, other], TODAY, { limit: 3 });
    expect(res.rotationIds).toContain('lee'); // 점수 낮아도 다양성으로 진입
    const kimCount = res.rotationIds.filter((id) => id.startsWith('kim')).length;
    expect(kimCount).toBeLessThan(3); // 한 사람이 전부 차지하지 않음
  });

  // ── E: 적응형 상한 ──────────────────────────────────────────
  it('override가 있으면 그 값으로 상한', () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      item({ id: `p${i}`, priority: 'high', receivedAtMs: TODAY - 30 * DAY, lastPrayedAtMs: TODAY - 30 * DAY }),
    );
    const res = selectTodayPrayers(items, TODAY, { override: 5 });
    expect(res.rotationIds).toHaveLength(5);
  });
});

describe('adaptiveDailyLimit', () => {
  it('활성이 적으면 하한(9) 유지', () => {
    expect(adaptiveDailyLimit(15)).toBe(9);
    expect(adaptiveDailyLimit(60)).toBe(9);
  });
  it('활성이 많으면 늘어나되 최대 15', () => {
    expect(adaptiveDailyLimit(120)).toBe(10);
    expect(adaptiveDailyLimit(180)).toBe(15);
    expect(adaptiveDailyLimit(300)).toBe(15);
  });
  it('override 양수면 그 값 우선', () => {
    expect(adaptiveDailyLimit(300, 6)).toBe(6);
    expect(adaptiveDailyLimit(10, 0)).toBe(9); // 0은 무시 → 자동
  });
});

describe('dayJitter', () => {
  it('같은 날·같은 id면 항상 같은 값', () => {
    expect(dayJitter('abc', 100)).toBe(dayJitter('abc', 100));
  });
  it('범위는 [0.92, 1.08)', () => {
    for (const id of ['a', 'bb', 'ccc', 'prayer-1']) {
      const v = dayJitter(id, 12345);
      expect(v).toBeGreaterThanOrEqual(0.92);
      expect(v).toBeLessThan(1.08);
    }
  });
  it('날이 바뀌면 보통 값이 달라진다', () => {
    expect(dayJitter('abc', 100)).not.toBe(dayJitter('abc', 101));
  });
});
