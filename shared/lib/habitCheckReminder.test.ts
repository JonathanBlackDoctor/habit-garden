import { describe, it, expect } from 'vitest';
import { habitCheckTargets, habitCheckMessage, usesHabitCheck } from './habitCheckReminder';
import type { HabitDoc, HabitCheckDoc, UserSettingsDoc } from '../types/firestore';
import { plannerDateKST } from './telegram';
const habit = (id: string, timeOfDay: HabitDoc['timeOfDay'], overrides = {}) => ({ id, timeOfDay, title: 'Synthetic habit', order: 1, active: true, scoreMode: 'binary', ...overrides }) as HabitDoc;
describe('Habit Check reminders', () => {
  it('requires per-account opt in', () => {
    expect(usesHabitCheck()).toBe(false);
    expect(usesHabitCheck({ habitCheckReminders: 'three-times-daily' } as UserSettingsDoc)).toBe(true);
  });
  it('sends only the current period at 9, 13 and 19, including anytime in the evening', () => {
    const habits = [habit('a', 'morning'), habit('b', 'afternoon'), habit('c', 'anytime')];
    expect(habitCheckTargets(9, habits, {}).map(h => h.id)).toEqual(['a']);
    expect(habitCheckTargets(13, habits, {}).map(h => h.id)).toEqual(['b']);
    expect(habitCheckTargets(19, habits, {}).map(h => h.id)).toEqual(['c']);
    for (const hour of [6, 21, 22]) expect(habitCheckTargets(hour, habits, {})).toEqual([]);
  });
  it('excludes inactive, dormant, archived and any intentionally recorded item', () => {
    const habits = [habit('off', 'morning', { active: false }), habit('sleep', 'morning', { hibernatedSince: '2026-01-01' }), habit('archive', 'morning', { archivedAt: 1 }), habit('zero', 'morning'), habit('skip', 'morning'), habit('done', 'morning'), habit('open', 'morning')];
    const checks = {zero: {score: 0}, skip: {score: null}, done: {score: 1}} as unknown as Record<string, HabitCheckDoc>;
    expect(habitCheckTargets(9, habits, checks).map(h => h.id)).toEqual(['open']);
  });
  it('links directly to the requested view without titles or account identifiers', () => {
    for (const view of ['habits', 'review', 'prayers'] as const) {
      const message = habitCheckMessage('2026-09-28', view);
      expect(new URL(message.link).searchParams.get('view')).toBe(view);
      expect(message.telegram.keyboard[0][0].url).toBe(message.link);
      expect(message.telegram.text).not.toMatch(/\d+\/\d+|스트릭|남았|달성률/);
    }
    expect(habitCheckMessage('2026-09-28', 'habits').telegram.keyboard).toHaveLength(1);
  });
  it('keeps the 4am day boundary for prayer and snooze', () => {
    expect(plannerDateKST(new Date('2026-09-28T03:59:59+09:00'))).toBe('2026-09-27');
    expect(plannerDateKST(new Date('2026-09-28T04:00:00+09:00'))).toBe('2026-09-28');
  });
});
