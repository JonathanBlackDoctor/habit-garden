import { describe, it, expect } from 'vitest';
import {
  MAIN_WIDGET_IDS,
  DEFAULT_ORDER,
  BEGINNER_CORE_WIDGETS,
  BEGINNER_HIDDEN_WIDGETS,
  mergeWidgetOrder,
} from './widgetOrder';

describe('mergeWidgetOrder', () => {
  it('미설정(빈 값)이면 기본 순서를 그대로 반환한다', () => {
    expect(mergeWidgetOrder(undefined)).toEqual(DEFAULT_ORDER);
    expect(mergeWidgetOrder([])).toEqual(DEFAULT_ORDER);
  });

  it('알 수 없는(삭제된) id 는 버린다', () => {
    const result = mergeWidgetOrder(['habits', 'ghost', 'garden']);
    expect(result).toContain('habits');
    expect(result).toContain('garden');
    expect(result).not.toContain('ghost' as never);
  });

  it('저장 순서에 없는 새 위젯도 빠짐없이 끼워 넣는다(누락 없음)', () => {
    // 사용자가 일부만 저장해 둔 상태에서도 모든 위젯이 결과에 존재해야 한다.
    const result = mergeWidgetOrder(['garden', 'habits']);
    expect([...result].sort()).toEqual([...MAIN_WIDGET_IDS].sort());
    // 사용자가 정한 우선 순서는 보존된다.
    expect(result.indexOf('garden')).toBeLessThan(result.indexOf('habits'));
  });

  it('전체를 저장해 둔 경우 그 순서를 그대로 유지한다', () => {
    const custom = [...MAIN_WIDGET_IDS].reverse();
    expect(mergeWidgetOrder(custom)).toEqual(custom);
  });
});

describe('초보자 레이아웃', () => {
  it('코어(습관·정원·할 일)는 숨김 목록에 없다', () => {
    for (const id of BEGINNER_CORE_WIDGETS) {
      expect(BEGINNER_HIDDEN_WIDGETS).not.toContain(id);
    }
  });

  it('코어 + 숨김 = 전체 위젯 (빠짐·중복 없음)', () => {
    const union = [...BEGINNER_CORE_WIDGETS, ...BEGINNER_HIDDEN_WIDGETS].sort();
    expect(union).toEqual([...MAIN_WIDGET_IDS].sort());
  });

  it('숨김 기본값을 적용해도 코어 위젯은 계속 보인다', () => {
    const order = mergeWidgetOrder(undefined);
    const visible = order.filter((id) => !BEGINNER_HIDDEN_WIDGETS.includes(id));
    expect(visible.sort()).toEqual([...BEGINNER_CORE_WIDGETS].sort());
  });
});
