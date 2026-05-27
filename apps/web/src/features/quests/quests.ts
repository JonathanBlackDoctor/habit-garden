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
    reward: { points: 180 },
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
    reward: { points: 220 },
    progress: ({ dates, checks }) => checks.filter((c) => c.achieved && dates.includes(c.date)).length,
  },
  {
    id: 'no_zero_days',
    title: '0점 없는 한 주',
    goal: 7,
    reward: { points: 320, freezeTokens: 1 },
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
    reward: { points: 150 },
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
    reward: { points: 200 },
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
  {
    id: 'perfect_10',
    title: '완벽 점수(5점) 10회',
    goal: 10,
    reward: { points: 260 },
    // 5점은 scaled 척도에서만 나온다(binary 최대 1) — score===5 만 세면 안전하다.
    progress: ({ dates, checks }) => checks.filter((c) => c.score === 5 && dates.includes(c.date)).length,
  },
  {
    id: 'evening_streak_5',
    title: '저녁 습관 5일 달성',
    goal: 5,
    reward: { points: 180 },
    progress: ({ dates, habits, checks }) => {
      const eveningIds = new Set(habits.filter((h) => h.timeOfDay === 'evening').map((h) => h.id));
      const byDate = new Map<string, boolean>();
      checks.forEach((c) => {
        if (!eveningIds.has(c.habitId)) return;
        if (!dates.includes(c.date)) return;
        if (c.achieved) byDate.set(c.date, true);
      });
      return byDate.size;
    },
  },
  {
    id: 'heavy_hitter_15',
    title: '핵심 습관 15회 달성',
    goal: 15,
    reward: { points: 240 },
    // 가중치 8 이상(중요) 습관에 집중.
    progress: ({ dates, habits, checks }) => {
      const heavy = new Set(habits.filter((h) => h.weight >= 8).map((h) => h.id));
      if (heavy.size === 0) return 0;
      return checks.filter((c) => c.achieved && heavy.has(c.habitId) && dates.includes(c.date)).length;
    },
  },
  {
    id: 'full_clear_2',
    title: '완벽한 하루 2일 (전체 달성)',
    goal: 2,
    reward: { points: 300, freezeTokens: 1 },
    progress: ({ dates, habits, checks }) => {
      if (habits.length === 0) return 0;
      const need = habits.length;
      let cnt = 0;
      for (const d of dates) {
        const got = new Set(checks.filter((c) => c.date === d && c.achieved).map((c) => c.habitId)).size;
        if (got >= need) cnt++;
      }
      return cnt;
    },
  },
  {
    id: 'weekend_warrior',
    title: '주말에도 6회 달성',
    goal: 6,
    reward: { points: 200 },
    // dates 는 월~일 순서 — index 5=토, 6=일.
    progress: ({ dates, checks }) => {
      const weekend = new Set([dates[5], dates[6]]);
      return checks.filter((c) => c.achieved && weekend.has(c.date)).length;
    },
  },
  {
    id: 'growth_reflect_5',
    title: '미달성 원인 5회 돌아보기',
    goal: 5,
    reward: { points: 160 },
    progress: ({ dates, checks }) => checks.filter((c) => c.whyMissed && dates.includes(c.date)).length,
  },
];

/**
 * weekStart 해시를 시드로 서로 다른 n개 퀘스트를 결정적으로 고른다.
 * 같은 주이면 항상 동일한 조합, 중복 없음. (주당 3개 지급)
 */
export function pickWeeklyQuests(weekStart: string, n = 3): QuestDef[] {
  let seed = 0;
  for (let i = 0; i < weekStart.length; i++) seed = (seed * 31 + weekStart.charCodeAt(i)) | 0;
  let h = Math.abs(seed) || 1;
  const pool = [...WEEKLY_QUESTS];
  const picked: QuestDef[] = [];
  const count = Math.min(n, pool.length);
  for (let k = 0; k < count; k++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff; // LCG — 결정적 의사난수
    const idx = h % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
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
