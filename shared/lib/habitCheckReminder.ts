import type { HabitDoc, HabitCheckDoc, UserSettingsDoc } from '../types/firestore';
import { visibleHabits, type InlineKeyboard } from './telegram';

export const HABIT_CHECK_URL = 'https://jonathanblackdoctor.github.io/habit-check/';
export const usesHabitCheck = (settings?: UserSettingsDoc) => settings?.habitCheckReminders === 'three-times-daily';
export function habitCheckTargets(hour: number, habits: HabitDoc[], checks: Record<string, HabitCheckDoc>) {
  const period = ({ 9: 'morning', 13: 'afternoon', 19: 'evening' } as const)[hour as 9 | 13 | 19];
  if (!period) return [];
  return visibleHabits(habits).filter(h => !(h as HabitDoc & { archivedAt?: unknown }).archivedAt)
    .filter(h => h.timeOfDay === period || (hour === 19 && h.timeOfDay === 'anytime'))
    .filter(h => !Object.prototype.hasOwnProperty.call(checks, h.id));
}
export function habitCheckMessage(date: string, view: 'habits' | 'review' | 'prayers', snooze = false) {
  const link = `${HABIT_CHECK_URL}?view=${view}`;
  const title = view === 'prayers' ? '🙏 오늘의 기도' : view === 'review' ? '🌙 오늘 기록을 마무리해요' : '🌿 잠깐, 습관 체크';
  const body = view === 'prayers' ? '오늘의 기도제목을 한곳에서 확인해요.' : view === 'review' ? '빠진 기록만 차분히 확인해요. 안 했음·건너뜀도 기록할 수 있어요.' : snooze ? '요청한 다시 알림이에요. 지금 가능한 만큼 기록해요.' : '지금 확인할 수 있는 습관부터 기록해요.';
  const keyboard: InlineKeyboard = [[{ text: view === 'prayers' ? '기도 열기' : view === 'review' ? '하루 마감 열기' : '습관 체크 열기', url: link }]];
  return { title, body, link, telegram: { text: `${title}\n${body}`, keyboard } };
}
