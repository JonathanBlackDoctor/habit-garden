/**
 * Timestamp 인터페이스 — firebase/firestore.Timestamp, firebase-admin/firestore.Timestamp 양쪽과
 * 구조적으로 호환되는 독립 정의. 클라이언트·Functions 모두 이 타입을 사용.
 * 실제 런타임 값은 각 환경의 SDK Timestamp이며, as any 캐스팅으로 처리한다.
 */
export interface Timestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

// ── 일일 문서 ────────────────────────────────────────────
// users/{uid}/days/{YYYY-MM-DD}
export interface DayDoc {
  date: string;                   // 'YYYY-MM-DD' (04:00 경계 기준)
  condition: ConditionData;
  reflection?: ReflectionData;
  dayScore?: number;              // 습관 가중평균 (0-100)
  pointsEarned?: number;
  streakSnapshot?: number;
  aiFeedback?: AIFeedback;
  finalized?: boolean;
  updatedAt: Timestamp;
}

// ── 컨디션 ───────────────────────────────────────────────
export interface ConditionData {
  sleepScore?: number;            // 0-100
  energyScore?: number;           // 0-100
  moodScore?: number;             // 1-10
  bedTime?: string;               // 'HH:mm'
  wakeTime?: string;
  immediatelyAwoke?: boolean;
  sleepEfficiency?: number;       // 0-1
  weather?: WeatherSnapshot;
}

export interface WeatherSnapshot {
  tempMin: number;
  tempMax: number;
  rainProb: number;
  feelsLike?: number;
  pm10?: 'good' | 'normal' | 'bad' | 'verybad';
  fetchedAt: Timestamp;
}

// ── 습관 정의 ────────────────────────────────────────────
// users/{uid}/habits/{id}
export interface HabitDoc {
  id: string;
  title: string;
  weight: number;                 // 1-10
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'anytime';
  order: number;
  scoreMode: 'scaled' | 'binary';
  achieveThreshold: number;       // scaled: 기본 3, binary: 1
  iconName: string;
  description?: string;
  active: boolean;
}

// ── 습관 체크 (일일) ──────────────────────────────────────
// users/{uid}/days/{date}/habitChecks/{habitId}
export interface HabitCheckDoc {
  habitId: string;
  score: number | null;           // scaled:1-5, binary:0|1, null=pass
  achieved: boolean;
  note?: string;
  checkedAt: Timestamp;
}

// ── 습관별 스트릭 ─────────────────────────────────────────
// users/{uid}/habits/{id}/streakMeta (단일 문서)
export interface HabitStreakData {
  current: number;
  best: number;
  lastAchievedDate?: string;
  freezeTokens: number;
}

// ── 회고 ────────────────────────────────────────────────
export interface ReflectionData {
  answers: Record<string, string>;
  completedAt: Timestamp;
}

// ── 경건 ────────────────────────────────────────────────
export interface JournalEntryDoc {
  id: string;
  text: string;
  createdAt: Timestamp;
}

export interface PrayerDoc {
  id: string;
  category: 'self' | 'family' | 'church' | 'other';
  title: string;
  body?: string;
  rotationDays: number;
  priority: 'high' | 'mid' | 'low';
  active: boolean;
}

// ── 플래너 ──────────────────────────────────────────────
export interface LongTodoDoc {
  id: string;
  title: string;
  deadline?: string;
  priority: 'high' | 'mid' | 'low';
  progress: number;
  done: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TodayTodoDoc {
  id: string;
  title: string;
  done: boolean;
  linkedLongTodoId?: string;
}

// ── 게임화 / 진척 ─────────────────────────────────────────
// users/{uid}/progress (단일 문서)
export interface ProgressDoc {
  totalPoints: number;
  spendablePoints: number;
  level: number;
  xpInLevel: number;
  globalStreak: number;
  globalBestStreak: number;
  gardenState: GardenState;
  updatedAt: Timestamp;
}

export interface GardenState {
  plants: PlantInstance[];
  unlockedSpecies: string[];
  decorations: string[];
  health: number;                 // 0-100
}

export interface PlantInstance {
  id: string;
  speciesId: string;
  stage: number;                  // 0=씨앗 … N=만개
  plantedAt: Timestamp;
  witheredSince?: Timestamp;
}

// users/{uid}/badges/{badgeId}
export interface BadgeDoc {
  badgeId: string;
  title: string;
  earnedAt: Timestamp;
  tier?: 'bronze' | 'silver' | 'gold';
}

// users/{uid}/pointLedger/{autoId}
export interface PointLedgerDoc {
  delta: number;
  reason: string;
  refId?: string;
  createdAt: Timestamp;
}

// ── AI 피드백 ─────────────────────────────────────────────
export interface AIFeedback {
  oneLineSummary: string;
  goodPoints: string[];
  toFix: string[];
  recommendations: string[];
  momentum: string;
  conditionAnalysis: string;
  generatedAt: Timestamp;
  retryCount: number;
}

// ── 포인트 상수 ──────────────────────────────────────────
export const POINT_PRICES = {
  SEED: 50,
  WATER: 20,
  UNLOCK_COMMON: 200,
  UNLOCK_RARE: 350,
  UNLOCK_EPIC: 500,
  DECO_LOW: 100,
  DECO_MID: 200,
  DECO_HIGH: 300,
  HEALTH_RESTORE: 80,
} as const;

export const POINT_EARN = {
  HABIT_BONUS_PERFECT: 5,
  REFLECTION: 20,
  DAILY_SUCCESS: 30,
  STREAK_7: 50,
  STREAK_30: 200,
  STREAK_100: 500,
} as const;

// ── 식물 종 ───────────────────────────────────────────────
export interface PlantSpecies {
  id: string;
  name: string;
  rarity: 'basic' | 'common' | 'rare';
  unlockCost: number;
  stages: number;
}

export const PLANT_SPECIES: PlantSpecies[] = [
  { id: 'sprout',    name: '새싹풀',   rarity: 'basic',  unlockCost: 0,   stages: 4 },
  { id: 'sunflower', name: '해바라기', rarity: 'common', unlockCost: 200, stages: 5 },
  { id: 'herb',      name: '허브',     rarity: 'common', unlockCost: 200, stages: 4 },
  { id: 'maple',     name: '단풍나무', rarity: 'rare',   unlockCost: 350, stages: 6 },
  { id: 'lotus',     name: '연꽃',     rarity: 'rare',   unlockCost: 500, stages: 6 },
];

// ── 배지 정의 ─────────────────────────────────────────────
export interface BadgeDef {
  id: string;
  title: string;
  tier: 'bronze' | 'silver' | 'gold';
  description: string;
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: 'streak_7',    title: '일주일의 약속', tier: 'bronze', description: '전체 스트릭 7일' },
  { id: 'streak_30',   title: '한 달의 뿌리',  tier: 'silver', description: '전체 스트릭 30일' },
  { id: 'streak_100',  title: '백일의 정원',   tier: 'gold',   description: '전체 스트릭 100일' },
  { id: 'reflect_30',  title: '돌아보는 사람', tier: 'silver', description: '회고 30일 연속' },
  { id: 'habit_50',    title: '꾸준함 50',     tier: 'bronze', description: '한 습관 50회 달성' },
  { id: 'first_bloom', title: '첫 개화',       tier: 'bronze', description: '식물 첫 만개' },
  { id: 'collector',   title: '정원사',         tier: 'gold',   description: '식물 종 5개 해금' },
  { id: 'condition_7', title: '몸을 살피다',   tier: 'bronze', description: '컨디션 7일 연속 기록' },
];

// ── 회고 질문 세트 ────────────────────────────────────────
export interface ReflectionQuestion {
  id: string;
  text: string;
  required: boolean;
  placeholder: string;
}

export const DEFAULT_REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  { id: 'q_best',     text: '오늘 가장 잘 지킨 행동 한 가지는?',       required: true,  placeholder: '예: 아침 QT를 빠짐없이 했다' },
  { id: 'q_regret',   text: '가장 아쉬웠던 점과 그 원인은?',           required: true,  placeholder: '예: 숏츠를 2시간 봤다. 지루함 회피' },
  { id: 'q_tomorrow', text: '내일 딱 한 가지 더 잘하고 싶은 것은?',    required: true,  placeholder: '예: 수업 직후 30분 복습' },
  { id: 'q_word',     text: '오늘 컨디션/집중을 한 단어로 표현하면?',   required: false, placeholder: '예: 흐림, 집중, 피곤' },
];

// ── 시드 습관 데이터 ──────────────────────────────────────
export const SEED_HABITS: Omit<HabitDoc, 'id'>[] = [
  { title: 'QT·아침기도',   weight: 10, timeOfDay: 'morning',   order: 0, scoreMode: 'scaled', achieveThreshold: 3, iconName: 'sun',           active: true },
  { title: '스마트폰 절제', weight: 9,  timeOfDay: 'anytime',   order: 1, scoreMode: 'scaled', achieveThreshold: 3, iconName: 'smartphone',    active: true, description: '<2h=5, 2-3h=4, 3-4h=3, 4-5h=2, 5h+=1' },
  { title: '숏츠 절제',     weight: 9,  timeOfDay: 'anytime',   order: 2, scoreMode: 'scaled', achieveThreshold: 3, iconName: 'clapperboard',  active: true, description: '<30m=5, 30-60m=4, 60-90m=3, 90-120m=2, 120m+=1' },
  { title: '수업복습',       weight: 8,  timeOfDay: 'evening',   order: 3, scoreMode: 'scaled', achieveThreshold: 3, iconName: 'book-open',     active: true },
  { title: '운동',           weight: 7,  timeOfDay: 'morning',   order: 4, scoreMode: 'binary', achieveThreshold: 1, iconName: 'dumbbell',      active: true },
  { title: '플래너 기록',   weight: 7,  timeOfDay: 'anytime',   order: 5, scoreMode: 'binary', achieveThreshold: 1, iconName: 'notebook-pen',  active: true },
  { title: '설거지',         weight: 5,  timeOfDay: 'evening',   order: 6, scoreMode: 'binary', achieveThreshold: 1, iconName: 'utensils',      active: true },
  { title: '청소',           weight: 5,  timeOfDay: 'evening',   order: 7, scoreMode: 'binary', achieveThreshold: 1, iconName: 'sparkles',      active: true },
];
