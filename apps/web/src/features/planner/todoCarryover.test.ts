import { describe, expect, it } from 'vitest';
import { isCarryoverBoundary, selectCarryOverItems, type CarryDay } from 'shared/todoCarryover';

const old: CarryDay = {
  date: '2026-09-05',
  todos: [{ title: '장기로 옮긴 일의 과거 사본', done: false }],
};

describe('carryover after moving a daily todo to a long-term goal', () => {
  it('does not resurrect an older copy when every current task was moved', () => {
    expect(selectCarryOverItems([
      { date: '2026-09-06', todos: [], todoCarryoverClosed: true }, old,
    ])).toEqual({ sourceDate: null, items: [] });
  });

  it('does not skip a closed day that now contains only completed tasks', () => {
    expect(selectCarryOverItems([
      {
        date: '2026-09-06', todoCarryoverClosed: true,
        todos: [{ title: '오늘 완료한 다른 일', done: true }],
      }, old,
    ])).toEqual({ sourceDate: null, items: [] });
  });

  it('still carries the other pending tasks from a closed day', () => {
    expect(selectCarryOverItems([
      {
        date: '2026-09-06', todoCarryoverClosed: true,
        todos: [
          { title: '내일 계속할 일', done: false, linkedLongTodoId: 'goal-2' },
          { title: '완료한 일', done: true },
        ],
      }, old,
    ])).toEqual({
      sourceDate: '2026-09-06',
      items: [{ title: '내일 계속할 일', linkedLongTodoId: 'goal-2' }],
    });
  });

  it('honors the transfer boundary after several days without opening the app', () => {
    expect(selectCarryOverItems([
      { date: '2026-09-09', todos: [] },
      { date: '2026-09-08', todos: [] },
      { date: '2026-09-07', todos: [], todoCarryoverClosed: true }, old,
    ])).toEqual({ sourceDate: null, items: [] });
  });

  it('preserves legacy gap recovery when no transfer boundary exists', () => {
    expect(selectCarryOverItems([
      { date: '2026-09-07', todos: [] },
      { date: '2026-09-06', todos: [{ title: '완료', done: true }] }, old,
    ])).toEqual({
      sourceDate: old.date,
      items: [{ title: old.todos[0].title }],
    });
  });

  it('prefers more recent pending work over an older closed day', () => {
    expect(selectCarryOverItems([
      { date: '2026-09-07', todos: [{ title: '새로운 일', done: false }] },
      { date: '2026-09-06', todos: [], todoCarryoverClosed: true }, old,
    ])).toEqual({ sourceDate: '2026-09-07', items: [{ title: '새로운 일' }] });
  });

  it('uses the same stop rule in both server and client history scans', () => {
    expect(isCarryoverBoundary({ date: '2026-09-06', todos: [], todoCarryoverClosed: true })).toBe(true);
    expect(isCarryoverBoundary({ date: '2026-09-06', todos: [{ title: '할 일', done: false }] })).toBe(true);
    expect(isCarryoverBoundary({ date: '2026-09-06', todos: [{ title: '완료', done: true }] })).toBe(false);
    expect(isCarryoverBoundary({ date: '2026-09-06', todos: [] })).toBe(false);
  });
});
