import type { HabitCheckDoc, HabitDoc } from 'shared/types/firestore';

export interface QuestDef {
  id: string;
  title: string;
  goal: number;
  /** 한 주의 dates+checks+habits 를 받아 현재 진행값 산출 */
  progress: (input: {
    dates: string[];
    habits: HabitDoc[];
    checks: Array<HabitCheckDoc & { date: string }>;
  }) => number;
  reward: { points: number; freezeTokens?: number };
}

export const WEEKLY_QUESTS: QuestDef[] = [
  {
    id: 'morning_streak_5',
    title: '아침 습관 5일 달성',
    goal: 5,
    reward: { points: 80, freezeTokens: 1 },
    progress: ({ dates, habits, checks }) => {
      const morningIds = new Set(habits.filter((h) => h.timeOfDay === 'morning').map((h) => h.id));
      const byDate = new Map<string, boolean>();
      checks.forEach((c) => {
        if (!morningIds.has(c.habitId)) return;
        if (!dates.includes(c.date)) return;
        if (c.achieved) byDate.set(c.date, true);
      });
      return byDate.size;
    },
  },
  {
    id: 'total_checks_25',
    title: '한 주 25회 달성',
    goal: 25,
    reward: { points: 100 },
    progress: ({ dates, checks }) => checks.filter((c) => c.achieved && dates.includes(c.date)).length,
  },
  {
    id: 'no_zero_days',
    title: '0점 없는 한 주',
    goal: 7,
    reward: { points: 120, freezeTokens: 1 },
    progress: ({ dates, checks }) => {
      const has = new Set<string>();
      checks.forEach((c) => { if (c.achieved && dates.includes(c.date)) has.add(c.date); });
      return Math.min(has.size, 7);
    },
  },
  {
    id: 'reflect_5',
    title: '회고 5회 작성',
    goal: 5,
    reward: { points: 60 },
    progress: ({ dates, checks }) => {
      const days = new Set<string>();
      checks.forEach((c) => { if (c.mood && dates.includes(c.date)) days.add(c.date); });
      return Math.min(days.size, 5);
    },
  },
  {
    id: 'all_morning_3',
    title: '아침 습관 전체 달성 3일',
    goal: 3,
    reward: { points: 90 },
    progress: ({ dates, habits, checks }) => {
      const morning = habits.filter((h) => h.timeOfDay === 'morning');
      if (morning.length === 0) return 0;
      const need = morning.length;
      let cnt = 0;
      for (const d of dates) {
        const got = checks.filter((c) => c.date === d && c.achieved && morning.some((h) => h.id === c.habitId)).length;
        if (got >= need) cnt++;
      }
      return cnt;
    },
  },
];

/** weekStart 가 같은 주이면 변경 없이 유지, 아니면 무작위 선택 (해시 기반). */
export function pickWeeklyQuest(weekStart: string): QuestDef {
  let hash = 0;
  for (let i = 0; i < weekStart.length; i++) hash = (hash * 31 + weekStart.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % WEEKLY_QUESTS.length;
  return WEEKLY_QUESTS[idx];
}

/** 'YYYY-MM-DD' 가 속한 주의 월요일을 반환. */
export function weekStartOf(date: string): string {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // 월=0
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function datesOfWeek(weekStart: string): string[] {
  const out: string[] = [];
  const d = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const n = new Date(d);
    n.setDate(d.getDate() + i);
    out.push(n.toISOString().slice(0, 10));
  }
  return out;
}
