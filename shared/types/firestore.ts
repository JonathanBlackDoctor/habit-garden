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
  prayerPlan?: PrayerPlan;        // 오늘의 기도 목록 (dailyReset이 미리 계산)
  updatedAt: Timestamp;
}

// 오늘의 기도 계획 — DayDoc.prayerPlan
export interface PrayerPlan {
  pinnedIds: string[];            // 고정 — 항상 노출
  rotationIds: string[];          // 오늘 추천된 로테이션 목록 (상한 N개)
  generatedAt: Timestamp;
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
  mood?: 1 | 2 | 3 | 4 | 5;       // 체크 직후 한 줄 회고 — Phase 2-4
  checkedAt: Timestamp;
}

// ── 일일 한 줄 회고 (습관별 묶음) ────────────────────────
// users/{uid}/reflections/{YYYY-MM-DD}
export interface DailyReflectionDoc {
  date: string;
  entries: Array<{
    habitId: string;
    mood: 1 | 2 | 3 | 4 | 5;
    note?: string;
    at: Timestamp;
  }>;
  updatedAt: Timestamp;
}

// ── FCM 디바이스 토큰 ─────────────────────────────────────
// users/{uid}/notifications/{tokenId}
export interface NotificationTokenDoc {
  token: string;
  platform: 'web' | 'android' | 'ios';
  userAgent?: string;
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
}

// ── 주간 퀘스트 (ProgressDoc 내부) ───────────────────────
export interface WeeklyQuestData {
  id: string;                     // 퀘스트 정의 ID
  weekStart: string;              // 'YYYY-MM-DD' (월요일 기준)
  goal: number;                   // 목표값
  current: number;                // 진행값
  reward: { points: number; freezeTokens?: number };
  completedAt?: Timestamp;
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

// ── 기도제목 시스템 ───────────────────────────────────────
export type PrayerCategory = 'self' | 'family' | 'church' | 'ministry' | 'friend' | 'other';
export type PrayerStatus   = 'active' | 'answered' | 'dormant';   // 활성 / 응답됨 / 잠든
export type PrayerPriority  = 'high' | 'mid' | 'low';
export type PrayerSource    = 'quick' | 'manual' | 'bulk_ai';

// 기도 대상자 — users/{uid}/people/{personId}
export interface PrayerPersonDoc {
  id: string;
  name: string;                 // 표시 이름
  aliases?: string[];           // 다른 표기(별명 등) — AI 중복 매칭용
  relation: PrayerCategory;     // 기본 분류
  note?: string;                // 메모(관계, 배경)
  activeCount: number;          // 활성 기도제목 수 (denormalized)
  answeredCount: number;        // 응답된 기도제목 수
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 기도제목 — users/{uid}/prayers/{prayerId}
export interface PrayerDoc {
  id: string;

  // ── 정리 기준 ──────────────────────────────
  personId?: string;            // 대상자 링크 (없을 수 있음)
  personName: string;           // 표시·검색용 (비정규화)
  category: PrayerCategory;     // 분류
  receivedAt: Timestamp;        // 받은 날짜

  // ── 내용 ───────────────────────────────────
  title: string;                // 한 줄 요약 (목록 표시)
  body?: string;                // 상세 / 원문 보존
  tags?: string[];              // 자유 태그(선택)

  // ── 우선순위·로테이션 ───────────────────────
  priority: PrayerPriority;
  pinned: boolean;              // 고정 = 매일 노출, 망각 안 됨
  rotationDays?: number;        // 희망 주기(일). 미지정 시 priority 기본값 사용

  // ── 상태·추적 ──────────────────────────────
  status: PrayerStatus;
  lastPrayedAt?: Timestamp;     // 마지막으로 기도한 시각
  prayCount: number;            // 누적 기도 횟수
  streak: number;               // 이 제목 연속 기도(선택적 표시)
  answeredAt?: Timestamp;
  answerNote?: string;          // 응답 간증
  dormantSince?: Timestamp;     // 잠든 시각

  // ── 출처·메타 ──────────────────────────────
  source: PrayerSource;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 일일 기도 체크 — users/{uid}/days/{YYYY-MM-DD}/prayerChecks/{prayerId}
export interface PrayerCheckDoc {
  prayerId: string;
  prayedAt: Timestamp;
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
  // ── 기도 진척 ──────────────────────────────
  prayerStreak?: number;            // 기도 전역 연속일
  prayerBestStreak?: number;
  lastPrayerDate?: string;          // 'YYYY-MM-DD'
  totalPrayersAnswered?: number;
  // ── 동기부여 확장 ──────────────────────────
  weeklyQuest?: WeeklyQuestData;    // Phase 4-1
  lastReminderAt?: Timestamp;       // Phase 3 — 알림 throttle
  comebackUntil?: string;           // Phase 4-5 — 회복 모드 종료일 'YYYY-MM-DD'
  freezeTokens?: number;            // Phase 4-3 — 글로벌 freeze 토큰
  seasonProgress?: SeasonProgressData;  // Phase 4-2
  updatedAt: Timestamp;
}

// ── 시즌 진행 상태 ──────────────────────────────────────
export interface SeasonProgressData {
  seasonId: string;                 // 예: '2026-spring'
  totalChecks: number;              // 시즌 동안 달성된 체크 수
  rewardsClaimed: string[];         // 받은 보상 ID 목록
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
  HARVEST_BONUS_RARE: 20,         // 희귀 이상 수확 시 추가 보너스
} as const;

export const POINT_EARN = {
  HABIT_BONUS_PERFECT: 5,
  REFLECTION: 20,
  DAILY_SUCCESS: 30,
  STREAK_7: 50,
  STREAK_30: 200,
  STREAK_100: 500,
} as const;

// ── 기도 포인트 상수 (설계 §7.2) ──────────────────────────
export const PRAYER_POINT_EARN = {
  PRAYER_CHECK:        2,    // 기도제목 1건 체크
  DAILY_LIST_COMPLETE: 15,   // 오늘의 목록 전부 완료
  PRAYER_STREAK_7:     40,
  PRAYER_STREAK_30:    150,
  PRAYER_ANSWERED:     30,   // 응답 기록 시 (간증 작성 권장)
} as const;

// 하루 기도 체크 포인트 상한 (인플레이션 방지)
export const PRAYER_DAILY_CHECK_CAP = 30;

// 오늘의 기도 로테이션 목록 상한 N
export const PRAYER_ROTATION_LIMIT = 9;

// ── 우선순위별 로테이션 기본값 (설계 §5.1) ────────────────
// baseInterval: 기본 노출 주기(일), dormantThreshold: 잠듦 임계(일)
export const PRAYER_ROTATION_DEFAULTS: Record<
  PrayerPriority,
  { baseInterval: number; dormantThreshold: number; weight: number }
> = {
  high: { baseInterval: 2,  dormantThreshold: 120, weight: 3 },
  mid:  { baseInterval: 5,  dormantThreshold: 75,  weight: 2 },
  low:  { baseInterval: 10, dormantThreshold: 45,  weight: 1 },
};

// 기도 분류 라벨 (UI 표시용)
export const PRAYER_CATEGORY_LABELS: Record<PrayerCategory, string> = {
  self:     '자신',
  family:   '가족',
  church:   '교회',
  ministry: '사역',
  friend:   '지인',
  other:    '기타',
};

// ── 식물 종 ───────────────────────────────────────────────
// 종별 특성 (passive abilities) — 게임 루프 다양성 위한 트레잇
export type PlantTrait =
  | { kind: 'lucky' }                // 클로버: 심기 시 1/5 확률로 stage 1 시작
  | { kind: 'beauty'; xp: number }   // 장미: 매일 04:00 정원에 있으면 +xp
  | { kind: 'hardy' }                // 선인장: 시들기 1회 면역
  | { kind: 'fast' }                 // 대나무: health>80 일 때 dailyReset 시 stage +1
  | { kind: 'healer'; heal: number } // 연꽃: 만개 시 정원 health +heal
  | { kind: 'streakSync' };          // 코스모스: 기도 streak>0 일 때 만개 시각효과 + 수확 +50%

export interface PlantSpecies {
  id: string;
  name: string;
  rarity: 'basic' | 'common' | 'rare' | 'epic';
  unlockCost: number;
  stages: number;
  trait?: PlantTrait;                // 신규: 종별 특성
  harvestYield?: number;             // 신규: 만개 수확 시 환급 P
  description?: string;              // 상점 UI 한 줄 설명
}

export const PLANT_SPECIES: PlantSpecies[] = [
  // 기본
  { id: 'sprout',    name: '새싹풀',   rarity: 'basic',  unlockCost: 0,   stages: 4, harvestYield: 10, description: '기본 새싹. 시작점.' },
  // 일반
  { id: 'sunflower', name: '해바라기', rarity: 'common', unlockCost: 200, stages: 5, harvestYield: 40, description: '햇살을 머금은 꽃.' },
  { id: 'herb',      name: '허브',     rarity: 'common', unlockCost: 200, stages: 4, harvestYield: 30, description: '향긋한 잎. 빨리 자람.' },
  { id: 'clover',    name: '클로버',   rarity: 'common', unlockCost: 150, stages: 3, harvestYield: 25,
    trait: { kind: 'lucky' }, description: '🍀 행운: 1/5 확률 한 단계 위에서 시작.' },
  { id: 'rose',      name: '장미',     rarity: 'common', unlockCost: 250, stages: 5, harvestYield: 50,
    trait: { kind: 'beauty', xp: 3 }, description: '✿ 매일 정원에 있으면 +3 XP.' },
  { id: 'cactus',    name: '선인장',   rarity: 'common', unlockCost: 180, stages: 3, harvestYield: 30,
    trait: { kind: 'hardy' }, description: '🌵 시들기 면역.' },
  // 희귀
  { id: 'maple',     name: '단풍나무', rarity: 'rare',   unlockCost: 350, stages: 6, harvestYield: 80, description: '계절을 머금은 나무.' },
  { id: 'lotus',     name: '연꽃',     rarity: 'rare',   unlockCost: 500, stages: 6, harvestYield: 100,
    trait: { kind: 'healer', heal: 10 }, description: '🪷 만개 시 정원 생기 +10.' },
  { id: 'orchid',    name: '난초',     rarity: 'rare',   unlockCost: 400, stages: 5, harvestYield: 70, description: '귀한 보라꽃.' },
  { id: 'bamboo',    name: '대나무',   rarity: 'rare',   unlockCost: 300, stages: 6, harvestYield: 80,
    trait: { kind: 'fast' }, description: '🎋 생기>80 일 때 매일 +1 단계 자동 성장.' },
  // 에픽
  { id: 'cosmos',    name: '코스모스', rarity: 'epic',   unlockCost: 600, stages: 5, harvestYield: 120,
    trait: { kind: 'streakSync' }, description: '✨ 기도 연속일 동안 빛나며, 수확 +50%.' },
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

// ── 시드 기도제목 데이터 ──────────────────────────────────
export type PrayerSeed = Pick<PrayerDoc, 'category' | 'title' | 'priority'> & {
  personName?: string;
  body?: string;
  pinned?: boolean;
};

export const SEED_PRAYERS: PrayerSeed[] = [
  { category: 'self',     title: '말씀과 기도로 하루를 시작하기',   priority: 'high', pinned: true,  body: '매일 아침 QT와 기도로 하나님과 동행하기' },
  { category: 'self',     title: '미디어 절제와 마음의 절제',       priority: 'mid',  body: '스마트폰·숏츠 사용을 줄이고 집중력 회복' },
  { category: 'family',   title: '가족의 건강과 믿음',              priority: 'high', personName: '가족', body: '부모님의 건강과 온 가족의 신앙 성장' },
  { category: 'church',   title: '교회 공동체와 주일 예배',         priority: 'mid',  body: '함께 예배하는 지체들과 교회의 부흥' },
  { category: 'ministry', title: '맡은 사역을 충성되게',            priority: 'mid',  body: '섬기는 자리에서 지혜와 사랑으로 감당하기' },
  { category: 'friend',   title: '친구·지인의 구원과 회복',         priority: 'low',  personName: '친구', body: '아직 주님을 모르는 친구들을 위한 중보' },
];

// 기도 우선순위 라벨 (UI 표시용)
export const PRAYER_PRIORITY_LABELS: Record<PrayerPriority, string> = {
  high: '높음',
  mid:  '보통',
  low:  '낮음',
};
