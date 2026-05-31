import { describe, it, expect } from 'vitest';
import { selectCarryOverItems, type CarryDay } from './todoCarryover';

function day(date: string, todos: CarryDay['todos']): CarryDay {
  return { date, todos };
}

describe('selectCarryOverItems', () => {
  it('가져올 게 없으면 sourceDate=null, items=[]', () => {
    expect(selectCarryOverItems([])).toEqual({ sourceDate: null, items: [] });
    expect(
      selectCarryOverItems([day('2026-05-30', [{ done: true, title: 'a' }])]),
    ).toEqual({ sourceDate: null, items: [] });
  });

  it('어제(가장 최근) 미완료를 이월한다', () => {
    const res = selectCarryOverItems([
      day('2026-05-30', [
        { done: false, title: '운동' },
        { done: true, title: '독서' },
      ]),
    ]);
    expect(res.sourceDate).toBe('2026-05-30');
    expect(res.items).toEqual([{ title: '운동' }]);
  });

  it('완료 항목은 제외하고 미완료만 가져온다', () => {
    const res = selectCarryOverItems([
      day('2026-05-30', [
        { done: true, title: '완료1' },
        { done: false, title: '미완1' },
        { done: false, title: '미완2' },
      ]),
    ]);
    expect(res.items).toEqual([{ title: '미완1' }, { title: '미완2' }]);
  });

  it('linkedLongTodoId 는 있을 때만 보존한다', () => {
    const res = selectCarryOverItems([
      day('2026-05-30', [
        { done: false, title: '연결', linkedLongTodoId: 'L1' },
        { done: false, title: '비연결' },
      ]),
    ]);
    expect(res.items).toEqual([
      { title: '연결', linkedLongTodoId: 'L1' },
      { title: '비연결' },
    ]);
    expect('linkedLongTodoId' in res.items[1]).toBe(false);
  });

  it('사슬이 끊겨 어제가 비어도 더 과거의 미완료를 복구한다 (사용자 부재·서버 누락 대비)', () => {
    // 최신순: 어제(빈) → 그제(빈) → 3일 전(미완료 존재)
    const res = selectCarryOverItems([
      day('2026-05-30', []),
      day('2026-05-29', [{ done: true, title: '다완료' }]),
      day('2026-05-28', [{ done: false, title: '잊힌 할 일' }]),
    ]);
    expect(res.sourceDate).toBe('2026-05-28');
    expect(res.items).toEqual([{ title: '잊힌 할 일' }]);
  });

  it('미완료가 여러 날에 걸쳐 있어도 가장 최근 한 날만 가져온다 (중복 이월 방지)', () => {
    const res = selectCarryOverItems([
      day('2026-05-30', [{ done: false, title: '최근날 항목' }]),
      day('2026-05-28', [{ done: false, title: '과거 원본' }]),
    ]);
    expect(res.sourceDate).toBe('2026-05-30');
    expect(res.items).toEqual([{ title: '최근날 항목' }]);
  });
});
