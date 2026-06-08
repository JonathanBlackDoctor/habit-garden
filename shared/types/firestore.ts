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

// ── 사용자 프로필 (승인 게이트) ─────────────────────────
// userProfiles/{uid}
export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  status: 'pending' | 'approved' | 'rejected';
  isOwner: boolean;
  createdAt: Timestamp;
  approvedAt: Timestamp | null;
  approvedBy: string | null;
}

// ── 관리자 문의 (버그·문의) ───────────────────────────────
// inquiries/{id} — 최상위 컬렉션. 작성자 본인과 owner만 읽고, owner만 답변(수정).
export type InquiryCategory = 'bug' | 'question' | 'etc';
export type InquiryStatus = 'open' | 'answered';

export interface InquiryDoc {
  id: string;
  uid: string;                  // 작성자 실제 인증 uid
  email: string | null;
  displayName: string | null;
  category: InquiryCategory;
  message: string;
  status: InquiryStatus;        // open=답변 대기, answered=답변 완료
  reply: string | null;         // owner 답변
  createdAt: Timestamp;
  repliedAt: Timestamp | null;
  repliedBy: string | null;     // 답변한 owner uid
}

export const INQUIRY_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  bug:      '버그 신고',
  question: '문의',
  etc:      '기타',
};

// ── 사용자 설정 ─────────────────────────────────────────
// users/{uid}/settings/main
export interface UserSettingsDoc {
  features: {
    faith: boolean;          // 경건·기도제목 메뉴 표시 여부
  };
  prayerGroups?: string[];   // 기도제목을 받은 모임 목록 (직접 추가 가능). 미설정 시 기본값 사용
  prayerTargets?: string[];  // 기도 대상(요청자/나 자신) 목록 (직접 추가 가능). 미설정 시 기본값 사용
  nickname?: string;         // 정원 둘러보기에서 다른 사용자에게 표시되는 닉네임 (중복 허용)
  updatedAt: Timestamp;
}

// ── 일일 문서 ────────────────────────────────────────────
// users/{uid}/days/{YYYY-MM-DD}
export interface DayDoc {
  date: string;                   // 'YYYY-MM-DD' (04:00 경계 기준)
  condition: ConditionData;
  reflection?: ReflectionData;
  dayScore?: number;              // 습관 가중평균 (0-100)
  successAwarded?: boolean;       // 오늘 '성공한 날' 보너스·스트릭이 지급됐는지 (체크↔해제 반복 시 중복 적립·스트릭 폭증 방지)
  pointsEarned?: number;
  streakSnapshot?: number;
  aiFeedback?: AIFeedback;
  finalized?: boolean;
  habitBasePointsCurrent?: { [habitId: string]: number }; // 오늘 각 습관의 현재 기본 포인트. (현재-이전) 델타만 지급/삭감해 점수 변경·완료해제가 포인트에 반영되게 한다.
  habitComboBonusCurrent?: { [habitId: string]: number }; // 오늘 각 습관에 실제 적립된 연속일 콤보 보너스. 토글·점수변경 시 (현재-이전) 델타만 지급/회수.
  prayerPlan?: PrayerPlan;        // 오늘의 기도 목록 (dailyReset이 미리 계산)
  prayerCheckAwardedIds?: string[]; // 오늘 기도 체크 포인트가 현재 적립돼 있는 기도제목 id (체크 시 추가, 해제 시 제거 → 해제하면 그만큼 삭감)
  todoAwardedIds?: string[];        // 오늘 할 일 완료 포인트가 현재 적립돼 있는 todo id (완료 시 추가, 해제 시 제거 → 해제하면 그만큼 삭감)
  todosCarriedOver?: boolean;       // 전날 미완료 할 일 이월이 끝났는지 (하루 1회만 실행 — 멱등 가드)
  prayerCountedIds?: string[];    // 오늘 기도 카운트·스트릭이 반영된 기도제목 id (영구; 체크↔해제 반복 시 prayCount/스트릭 폭증 방지)
  prayerListCompleted?: boolean;  // 오늘 목록 완료 보너스 지급 여부
  morningBrief?: MorningBrief;    // 매일 06:00 생성되는 개인화 모닝 브리프
  updatedAt: Timestamp;
}

// 모닝 브리프 — DayDoc.morningBrief (morningBrief 스케줄러가 생성)
export interface MorningBrief {
  message: string;                          // AI 개인화 한두 문장
  priorityHabits: Array<{ id: string; title: string }>;  // 오늘 핵심 습관 (가중치 상위)
  yesterdayScore: number;                   // 어제 dayScore
  streak: number;                           // 현재 글로벌 스트릭
  generatedAt: Timestamp;
}

// 오늘의 기도 계획 — DayDoc.prayerPlan
export interface PrayerPlan {
  pinnedIds: string[];            // 고정 — 항상 노출
  rotationIds: string[];          // 오늘 추천된 로테이션 목록 (상한 N개)
  extraIds?: string[];            // 사용자가 '더 받기'로 추가한 오늘 한정 목록
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
  whyMissed?: string;             // 미달성 시 원인 한 줄 (Why-Tracking)
  tags?: string[];                // 자유 태그 (#스트레스 #피곤 등)
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
  screenTimeMinutes?: number;     // 오늘 스마트폰 사용 시간(분)
  completedAt: Timestamp;
}

// ── 경건 ────────────────────────────────────────────────
export interface JournalEntryDoc {
  id: string;
  text: string;
  createdAt: Timestamp;
}

// ── 기도제목 시스템 ───────────────────────────────────────
export type PrayerStatus   = 'active' | 'answered' | 'dormant';   // 활성 / 응답됨 / 잠든
export type PrayerPriority  = 'high' | 'mid' | 'low';
export type PrayerSource    = 'quick' | 'manual' | 'bulk_ai';

// 기도제목을 받은 모임 — 사용자가 직접 추가 가능. 미설정 시 이 기본값 사용
export const DEFAULT_PRAYER_GROUPS = ['교회', 'CMF', '개인'] as const;

// 기도 대상(요청자/나 자신) — 사용자가 직접 추가 가능. 미설정 시 이 기본값 사용
export const DEFAULT_PRAYER_TARGETS = ['나 자신'] as const;

// 기도제목 — users/{uid}/prayers/{prayerId}
export interface PrayerDoc {
  id: string;

  // ── 정리 기준 ──────────────────────────────
  group: string;                // 받은 모임 (교회/CMF/개인 …)
  target: string;               // 기도 대상 (요청한 사람 / 나 자신)
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
  batchId?: string;             // 무더기 저장 시 같은 묶음 식별 (신규 저장분부터)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 일일 기도 체크 — users/{uid}/days/{YYYY-MM-DD}/prayerChecks/{prayerId}
export interface PrayerCheckDoc {
  prayerId: string;
  prayedAt: Timestamp;
}

// 주간 기도 회고 — users/{uid}/prayerWeekly/{weekId='YYYY-MM-DD'(주 시작일)}
export interface PrayerWeeklyDigestDoc {
  id: string;
  weekStart: Timestamp;
  weekEnd: Timestamp;
  totalChecks: number;
  topGroups: { group: string; count: number }[];
  topGroup: string;
  answeredCount: number;
  answeredItems: { title: string; answerNote?: string }[];
  forgottenWarning: { title: string; daysSince: number }[];
  oneLineEncouragement: string;       // AI 생성 격려 두 문장
  generatedAt: Timestamp;
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
  carriedFrom?: string;             // 'YYYY-MM-DD' — 미완료로 이월돼 온 출처 날짜
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
  weeklyQuest?: WeeklyQuestData;    // Phase 4-1 (레거시 단일 — weeklyQuests 로 대체됨)
  weeklyQuests?: WeeklyQuestData[]; // 주당 3개 동시 지급
  lastReminderAt?: Timestamp;       // Phase 3 — 알림 throttle
  comebackUntil?: string;           // Phase 4-5 — 회복 모드 종료일 'YYYY-MM-DD'
  freezeTokens?: number;            // Phase 4-3 — 글로벌 freeze 토큰
  freezeProtectedDate?: string;     // 'YYYY-MM-DD' — freeze 토큰으로 보호한 날 (스트릭·정원 보호)
  seasonProgress?: SeasonProgressData;  // Phase 4-2
  // ── 스트릭 보호 (그레이스/아픔/휴가) ──────────
  graceUsed?: { weekStart: string; daysUsed: number };  // 주 1회 그레이스 데이
  sickDays?: { month: string; daysUsed: number };       // 월 1회 아픔 데이
  vacationUntil?: string;           // 'YYYY-MM-DD' — 이 날짜까지 스트릭 동결
  // ── 온보딩 ─────────────────────────────────
  starterBonusApplied?: boolean;    // 시작 자원(200P + 새싹 1개) 1회 지급 여부
  // ── 정원 통계 (2차 다양화) ─────────────────
  gardenStats?: GardenStats;
  updatedAt: Timestamp;
}

// 정원 게임 통계 — 컬렉션·마일스톤·자동 성장 카운트 등
export interface GardenStats {
  codexEntries?: string[];                    // 발견(해금 또는 첫 심기) 한 종 ID 목록
  harvestsBySpecies?: Record<string, number>; // 종별 누적 수확
  harvestsByRarity?: Record<string, number>;  // 'basic' | 'common' | 'rare' | 'epic' | 'legendary' 별 수확
  rareDropsTriggered?: number;                // 희귀 드롭 누적 발생 횟수
  autogrowToday?: number;                     // 오늘 자동 성장 카운트 (매일 04:00 리셋)
  autogrowTotal?: number;                     // 누적 자동 성장
  consecutiveHealthyDays?: number;            // 정원 생기≥80 연속일
  passiveYieldTotal?: number;                 // 누적 일일 자동 P
  lastYieldDate?: string;                      // passive yield 를 정산한 게임일(YYYY-MM-DD, 04:00 KST). 서버 리셋과 클라이언트 폴백이 공유해 중복 지급을 막는다.
  lastDailyGardenDate?: string;               // 일일 정산(processDailyGarden)을 마친 게임일(YYYY-MM-DD, 04:00 KST). 중복 실행 시 재정산 방지.
  starBoostBonus?: number;                    // ★3 종 누계로 인한 종합 효율 메타 (정보용)
  plantsLost?: number;                        // 게을러져 죽은(영구 제거된) 식물 누적 수
  dailyDirectPlants?: number;                 // 오늘 직접 심기 횟수 (04:00 KST 리셋)
  dailyDirectPlantsDate?: string;             // 'YYYY-MM-DD' 게임일 기준
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
  lastFastGrowDate?: string;      // fast 트레잇 자동 성장을 적용한 게임일(YYYY-MM-DD, 04:00 KST 경계).
                                  //   서버 일일 리셋과 클라이언트 이중 경로가 공유해 하루 1회만 성장시킨다.
}

export interface PlantInstance {
  id: string;
  speciesId: string;
  stage: number;                  // 0=씨앗 … N=만개
  plantedAt: Timestamp;
  witheredSince?: Timestamp;
  neglectStreak?: number;         // 연속 실패(게으른)일 수 — 연약 전설 trait 에서 사용
  wateredAt?: Timestamp;          // 마지막 물주기 시각 (하루 1회 제한)
}

// ── 공개 정원 (둘러보기) ──────────────────────────────────
// gardens/{uid} — 최상위 공개 컬렉션. 인증된 사용자 누구나 읽기 가능, 본인만 쓰기.
// progress/main 의 민감 정보(포인트·기도·통계)는 제외하고 정원 표시에 필요한 값만 미러링한다.
// 닉네임을 설정한 사용자만 문서가 생성되어 둘러보기 목록에 노출된다.
export interface PublicGardenDoc {
  uid: string;
  nickname: string;               // 사용자 설정 닉네임 (중복 허용)
  level: number;                  // ProgressDoc.level 미러
  gardenState: GardenState;       // 식물·종·생기 (민감 정보 아님)
  updatedAt: Timestamp;
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
/** 스트릭(freeze) 토큰 최대 보유 수 — 아주 귀한 자원이라 상한을 둔다. */
export const FREEZE_TOKEN_CAP = 3;

export const POINT_PRICES = {
  SEED: 50,                       // 기본 심기 비용 (PlantSpecies.seedCost 가 우선)
  WATER: 10,                      // 물주기 비용 (균형 조정: 20→10)
  UNLOCK_COMMON: 200,
  UNLOCK_RARE: 350,
  UNLOCK_EPIC: 500,
  UNLOCK_LEGENDARY: 2500,         // 전설 등급 기본 해금 비용
  UNLOCK_TRANSCENDENT: 12000,     // 초월 등급 해금 비용 (어마어마하게 비쌈)
  DECO_LOW: 100,
  DECO_MID: 200,
  DECO_HIGH: 300,
  HEALTH_RESTORE: 80,
  HARVEST_BONUS_RARE: 20,         // 희귀 이상 수확 시 추가 보너스
  HARVEST_BONUS_EPIC: 40,         // 에픽 이상 수확 시 추가 (희귀 보너스에 누적)
  HARVEST_BONUS_LEGENDARY: 100,   // 전설 수확 시 추가 (위에 누적)
} as const;

export const PLANTS_PER_BED = 8;   // 화단 한 페이지에 보이는 식물 수
export const PLANTS_PER_ROW = 4;   // 계단식 한 줄당 식물 수 (8개 = 2줄)
export const MAX_BEDS = 3;         // 최대 화단 수
export const MAX_GARDEN_PLANTS = MAX_BEDS * PLANTS_PER_BED;  // 정원 전체 식물 자리 = 24

// 등급별 일일 수확 (만개 식물 → spendablePoints 자동 가산) 기본값
// 초월(transcendent)은 수익이 없다(0) — 보유·유지 자체가 목적.
export const DAILY_YIELD_BY_RARITY: Record<'basic' | 'common' | 'rare' | 'epic' | 'legendary' | 'transcendent', number> = {
  basic: 2, common: 4, rare: 6, epic: 10, legendary: 15, transcendent: 0,
};

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

// ── 레벨업 보상 (레벨업 1회마다 지급) ─────────────────────
// 규칙: 홀수 레벨 → 씨앗, 짝수 레벨 → 포인트, 5레벨 단위 → 큰 보상(포인트+씨앗).
// 포인트는 그 레벨업에 소모한 XP(xpForLevel)에 비례시켜 난이도 곡선을 따라가게 한다.
export const LEVELUP_REWARD = {
  EVEN_BASE_POINTS:      20,    // 짝수 레벨 도달 시 고정 베이스 포인트
  REWARD_RATE:           0.15,  // 소모 XP 대비 포인트 비율
  MILESTONE_EVERY:       5,     // 큰 보상 주기 (5레벨마다)
  MILESTONE_MULTIPLIER:  2,     // 큰 보상 = 소모 XP × REWARD_RATE × 이 배수
  SEED_SPECIES:        'sprout',   // 기본 보상 씨앗
  MILESTONE_SEED_SPECIES: 'clover', // 큰 보상 씨앗 (미해금 시 sprout 로 대체)
} as const;

// 하루 직접 심기 상한 (레벨업 보상 씨앗은 제외)
export const DAILY_PLANT_LIMIT = 5;

// 하루 기도 체크 포인트 상한 (인플레이션 방지)
export const PRAYER_DAILY_CHECK_CAP = 30;

// 하루 습관 체크 포인트 상한 (수백 개 습관 생성 악용 방지)
export const HABIT_DAILY_CHECK_CAP = 300;

// ── 할 일(todo) 포인트 상수 ───────────────────────────────
export const TODO_POINT_EARN = {
  TODO_CHECK: 3,    // 오늘 할 일 1건 완료
} as const;

// 하루 할 일 완료 포인트 상한 (인플레이션 방지)
export const TODO_DAILY_CHECK_CAP = 30;

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

// ── 식물 종 ───────────────────────────────────────────────
// 종별 특성 (passive abilities) — 게임 루프 다양성 위한 트레잇
export type PlantTrait =
  | { kind: 'lucky' }                // 1/5 확률로 stage 1 시작 + 희귀 드롭 가능성
  | { kind: 'beauty'; xp: number }   // 매일 04:00 정원에 있으면 +xp
  | { kind: 'hardy' }                // 시들기 면역
  | { kind: 'fast' }                 // health>=80 (생기 80 이상)일 때 dailyReset 시 stage +1
  | { kind: 'healer'; heal: number } // 만개 시 정원 health +heal
  | { kind: 'streakSync' }           // 기도 streak>0 일 때 만개 시각효과 + 수확 +50%
  | { kind: 'bloomer' }              // 매일 자동 성장 (health 무관, 100% 확률) — legendary 전용
  // ── 연약 전설 (화려하지만 게을러지면 죽는) ──
  | { kind: 'brittle' }                    // 실패한 날 1회로 즉시 죽음(제거). 물로 회복 불가.
  | { kind: 'fragile' }                    // 실패→시듦, 시든 채 또 실패→죽음. 물/성공으로 회복.
  | { kind: 'waning'; graceDays: number }  // graceDays 연속 실패 시 죽음. 성공하면 카운터 리셋.
  | { kind: 'regress' }                    // 실패한 날마다 stage−1, stage 0에서 또 실패→죽음.
  | { kind: 'radiant' }                    // 평소 시들지 않음. 만개(최고 stage) 후 실패하면 즉시 죽음.
  // ── 초월 (보유·유지 자체가 의미인 프레스티지) ──
  // 매일 upkeep 차감 · 하루 실패 즉사. 살아있으면 매일 dailyXp 만큼 경험치를 주고(유지비에 상응),
  // effect 는 종별 고유 보조 효과(vitality=생기 회복, guardian=죽음 방지, none=없음).
  | { kind: 'transcendent'; upkeep: number; dailyXp: number; effect: 'vitality' | 'guardian' | 'none'; amount: number };

export interface PlantSpecies {
  id: string;
  name: string;
  rarity: 'basic' | 'common' | 'rare' | 'epic' | 'legendary' | 'transcendent';
  unlockCost: number;
  stages: number;
  trait?: PlantTrait;
  harvestYield?: number;             // 만개 수확 시 환급 P (이미 +50% 인플레 반영된 값)
  seedCost?: number;                 // 종별 차등 심기 비용 (없으면 POINT_PRICES.SEED)
  dailyYield?: number;               // 만개 후 일일 자동 P (없으면 DAILY_YIELD_BY_RARITY[rarity])
  description?: string;
}

export const PLANT_SPECIES: PlantSpecies[] = [
  // ── 기본 (basic) ────────────────────────────────────────
  { id: 'sprout',     name: '새싹풀',   rarity: 'basic',  unlockCost: 0,   seedCost: 25, stages: 4, harvestYield: 15, description: '기본 새싹. 모든 정원의 시작점.' },
  { id: 'dandelion',  name: '민들레',   rarity: 'basic',  unlockCost: 60,  seedCost: 25, stages: 3, harvestYield: 18,
    trait: { kind: 'lucky' }, description: '🍃 행운의 홀씨. 1/5 확률 한 단계 위 시작.' },
  { id: 'moss',       name: '이끼',     rarity: 'basic',  unlockCost: 30,  seedCost: 25, stages: 2, harvestYield: 12,
    trait: { kind: 'hardy' }, description: '🌿 작지만 끈질김. 시들기 면역.' },

  // ── 일반 (common) ───────────────────────────────────────
  { id: 'sunflower',  name: '해바라기', rarity: 'common', unlockCost: 200, seedCost: 50, stages: 5, harvestYield: 60, description: '햇살을 머금은 꽃.' },
  { id: 'herb',       name: '허브',     rarity: 'common', unlockCost: 200, seedCost: 50, stages: 4, harvestYield: 45, description: '향긋한 잎. 부담 없이 키우기 좋음.' },
  { id: 'clover',     name: '클로버',   rarity: 'common', unlockCost: 150, seedCost: 50, stages: 3, harvestYield: 38,
    trait: { kind: 'lucky' }, description: '🍀 행운: 1/5 확률 한 단계 위 시작.' },
  { id: 'rose',       name: '장미',     rarity: 'common', unlockCost: 250, seedCost: 50, stages: 5, harvestYield: 75,
    trait: { kind: 'beauty', xp: 3 }, description: '✿ 매일 정원에 있으면 +3 XP.' },
  { id: 'cactus',     name: '선인장',   rarity: 'common', unlockCost: 180, seedCost: 50, stages: 3, harvestYield: 45,
    trait: { kind: 'hardy' }, description: '🌵 시들기 면역.' },
  { id: 'tulip',      name: '튤립',     rarity: 'common', unlockCost: 220, seedCost: 50, stages: 4, harvestYield: 60, description: '🌷 봄을 부르는 잔.' },
  { id: 'daisy',      name: '데이지',   rarity: 'common', unlockCost: 180, seedCost: 50, stages: 4, harvestYield: 50,
    trait: { kind: 'beauty', xp: 2 }, description: '🌼 매일 정원에 있으면 +2 XP.' },
  { id: 'mint',       name: '민트',     rarity: 'common', unlockCost: 200, seedCost: 40, stages: 3, harvestYield: 45,
    trait: { kind: 'fast' }, description: '🌱 생기 80 이상일 때 매일 자동 성장.' },

  // ── 희귀 (rare) ─────────────────────────────────────────
  { id: 'maple',      name: '단풍나무', rarity: 'rare',   unlockCost: 350, seedCost: 80, stages: 6, harvestYield: 120, description: '계절을 머금은 나무.' },
  { id: 'lotus',      name: '연꽃',     rarity: 'rare',   unlockCost: 500, seedCost: 80, stages: 6, harvestYield: 150,
    trait: { kind: 'healer', heal: 10 }, description: '🪷 만개 시 정원 생기 +10.' },
  { id: 'orchid',     name: '난초',     rarity: 'rare',   unlockCost: 400, seedCost: 80, stages: 5, harvestYield: 105, description: '귀한 보라꽃.' },
  { id: 'bamboo',     name: '대나무',   rarity: 'rare',   unlockCost: 300, seedCost: 80, stages: 6, harvestYield: 120,
    trait: { kind: 'fast' }, description: '🎋 생기 80 이상일 때 매일 자동 성장.' },
  { id: 'pine',       name: '소나무',   rarity: 'rare',   unlockCost: 450, seedCost: 80, stages: 7, harvestYield: 130,
    trait: { kind: 'hardy' }, description: '🌲 시들기 면역. 길게 자람.' },
  { id: 'fern',       name: '고사리',   rarity: 'rare',   unlockCost: 380, seedCost: 70, stages: 5, harvestYield: 110,
    trait: { kind: 'healer', heal: 5 }, description: '🌿 만개 시 정원 생기 +5.' },
  { id: 'hydrangea',  name: '수국',     rarity: 'rare',   unlockCost: 500, seedCost: 75, stages: 6, harvestYield: 135,
    trait: { kind: 'beauty', xp: 5 }, description: '💠 매일 정원에 있으면 +5 XP.' },
  { id: 'carnation',  name: '카네이션', rarity: 'rare',   unlockCost: 420, seedCost: 70, stages: 5, harvestYield: 120, description: '🌷 감사의 꽃.' },

  // ── 에픽 (epic) ─────────────────────────────────────────
  { id: 'cosmos',     name: '코스모스', rarity: 'epic',   unlockCost: 700, seedCost: 130, stages: 5, harvestYield: 180,
    trait: { kind: 'streakSync' }, description: '✨ 기도 연속일 동안 빛나며, 수확 +50%.' },
  { id: 'firefly_flower', name: '반딧불꽃', rarity: 'epic', unlockCost: 800, seedCost: 130, stages: 6, harvestYield: 210,
    trait: { kind: 'streakSync' }, description: '🌟 밤하늘처럼 반짝. 기도 연속 시 수확 +50%.' },
  { id: 'rainbow_iris', name: '무지개붓꽃', rarity: 'epic', unlockCost: 1100, seedCost: 130, stages: 5, harvestYield: 240,
    trait: { kind: 'lucky' }, description: '🌈 행운 + 빛. 희귀 드롭 확률↑.' },
  { id: 'moonbloom',  name: '달꽃',     rarity: 'epic',   unlockCost: 1300, seedCost: 150, stages: 6, harvestYield: 270,
    trait: { kind: 'healer', heal: 15 }, description: '🌙 만개 시 정원 생기 +15.' },

  // ── 전설 (legendary) ────────────────────────────────────
  // 생명나무: 안전한 자동성장 전설 (변경 없음). 그 외 전설은 화려하지만 게을러지면 죽는다.
  { id: 'tree_of_life', name: '생명나무', rarity: 'legendary', unlockCost: 2500, seedCost: 200, stages: 8, harvestYield: 450, dailyYield: 15,
    trait: { kind: 'bloomer' }, description: '🌳 매일 자동 성장. 8단계 만에 만개하는 영광의 나무.' },
  { id: 'crystal_rose', name: '수정장미', rarity: 'legendary', unlockCost: 4000, seedCost: 280, stages: 6, harvestYield: 820, dailyYield: 28,
    trait: { kind: 'brittle' }, description: '💎 단 하루도 거를 수 없는 수정 장미. 거른 날 즉시 스러진다. 최고 수확.' },
  { id: 'starlight_lily', name: '별빛백합', rarity: 'legendary', unlockCost: 3200, seedCost: 240, stages: 7, harvestYield: 600, dailyYield: 20,
    trait: { kind: 'fragile' }, description: '✨ 별빛을 머금은 백합. 거른 날 시들고, 이어 거르면 죽는다.' },
  { id: 'aurora_orchid', name: '오로라난초', rarity: 'legendary', unlockCost: 3000, seedCost: 230, stages: 6, harvestYield: 560, dailyYield: 18,
    trait: { kind: 'waning', graceDays: 3 }, description: '🌌 오로라빛 난초. 사흘 연속 거르면 끝내 죽는다.' },
  { id: 'golden_peony', name: '황금모란', rarity: 'legendary', unlockCost: 3400, seedCost: 250, stages: 7, harvestYield: 640, dailyYield: 22,
    trait: { kind: 'regress' }, description: '🏵️ 황금빛 모란. 거른 날마다 한 단계씩 시들어 사라진다.' },
  { id: 'dawn_lily', name: '여명백합', rarity: 'legendary', unlockCost: 3800, seedCost: 270, stages: 8, harvestYield: 760, dailyYield: 26,
    trait: { kind: 'radiant' }, description: '🌅 여명처럼 빛나는 백합. 만개의 영광을 게을러지면 한순간에 잃는다.' },

  // ── 초월 (transcendent) ──────────────────────────────────
  // 일일 자동 수익(dailyYield)은 없다(0). 매일 유지비가 빠져나가며, 하루라도 거르면 즉시 스러진다.
  // 해금·심기 비용이 어마어마하다. 그 대가로 가장 황홀한 비주얼과 종별 소폭 보조 효과를 준다.
  // 살아있으면 매일 한 단계씩 자라 만개하고, 만개해 거두면 씨앗값(seedCost)만큼의 수익이 난다
  // (해금비·누적 유지비는 회수되지 않으므로 여전히 큰 손해).
  { id: 'celestial_tree', name: '천상수', rarity: 'transcendent', unlockCost: 12000, seedCost: 1500, stages: 7, harvestYield: 1500, dailyYield: 0,
    trait: { kind: 'transcendent', upkeep: 30, dailyXp: 60, effect: 'none', amount: 0 },
    description: '🌟 천상에 뿌리내린 빛의 나무. 매일 자라며 살아있는 동안 +60 XP. 유지비 30P/일, 하루만 거르면 스러진다. 만개 수확 시 1500P.' },
  { id: 'eternal_bloom', name: '영겁화', rarity: 'transcendent', unlockCost: 12000, seedCost: 1500, stages: 6, harvestYield: 1500, dailyYield: 0,
    trait: { kind: 'transcendent', upkeep: 30, dailyXp: 40, effect: 'vitality', amount: 1 },
    description: '🌹 영겁을 피어 있는 오로라빛 꽃. 매일 자라며 +40 XP·정원 생기 +1. 유지비 30P/일, 하루만 거르면 스러진다. 만개 수확 시 1500P.' },
  { id: 'galaxy_lily', name: '은하백합', rarity: 'transcendent', unlockCost: 12000, seedCost: 1500, stages: 6, harvestYield: 1500, dailyYield: 0,
    trait: { kind: 'transcendent', upkeep: 30, dailyXp: 40, effect: 'guardian', amount: 1 },
    description: '🌌 은하를 머금은 백합. 매일 자라며 +40 XP·다른 식물 죽음 매일 1회 방지. 유지비 30P/일, 하루만 거르면 스러진다. 만개 수확 시 1500P.' },
];

// 도감/컬렉션 완성 기준 종 수 — 초월(transcendent)은 별도 프레스티지 티어로 제외.
export const CODEX_SPECIES_COUNT = PLANT_SPECIES.filter((s) => s.rarity !== 'transcendent').length;

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
  { id: 'collector',   title: '정원사',         tier: 'bronze', description: '식물 종 5개 해금' },
  { id: 'condition_7', title: '몸을 살피다',   tier: 'bronze', description: '컨디션 7일 연속 기록' },
  // ── 정원 2차: 컬렉션 등급 ──────────────────────────────
  { id: 'collector_10',  title: '식물 애호가',   tier: 'bronze', description: '식물 종 10개 해금' },
  { id: 'collector_15',  title: '정원 마스터',   tier: 'silver', description: '식물 종 15개 해금' },
  { id: 'collector_20',  title: '식물학자',       tier: 'gold',   description: '식물 종 20개 해금' },
  { id: 'collector_25',  title: '생명의 정원',   tier: 'gold',   description: '모든 식물 종 25개 해금' },
  // ── 정원 2차: 수확 챌린지 ──────────────────────────────
  { id: 'harvest_rare_10',      title: '귀한 수확',     tier: 'silver', description: '희귀 이상 10회 수확' },
  { id: 'harvest_epic_5',       title: '에픽 수확가',   tier: 'gold',   description: '에픽 식물 5회 수확' },
  { id: 'harvest_legendary_1',  title: '전설의 정원사', tier: 'gold',   description: '전설 식물 1회 수확' },
  // ── 정원 2차: 트레잇·자동 성장 ─────────────────────────
  { id: 'rare_drop_5',          title: '행운의 손길',   tier: 'bronze', description: '희귀 씨앗 드롭 5회 경험' },
  { id: 'autogrow_50',          title: '자라나는 정원', tier: 'silver', description: '습관·기도로 자동 성장 50회' },
  // ── 정원 2차: 도감·생기 ───────────────────────────────
  { id: 'codex_complete',       title: '도감 완성',     tier: 'gold',   description: '식물 도감 25종 모두 발견' },
  { id: 'garden_healthy_14',    title: '활기찬 정원',   tier: 'silver', description: '정원 생기 80 이상 14일 연속' },
  // ── 초월 (프레스티지) ─────────────────────────────────
  { id: 'transcendent_keeper',  title: '초월의 수호자', tier: 'gold',   description: '초월 식물을 보유' },
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

// ── 게스트(둘러보기) 시드 습관 — 운동·청소·스마트폰 절제만 노출 ──
export const GUEST_SEED_HABITS: Omit<HabitDoc, 'id'>[] = [
  { title: '스마트폰 절제', weight: 9, timeOfDay: 'anytime', order: 0, scoreMode: 'scaled', achieveThreshold: 3, iconName: 'smartphone', active: true, description: '<2h=5, 2-3h=4, 3-4h=3, 4-5h=2, 5h+=1' },
  { title: '운동',          weight: 7, timeOfDay: 'morning', order: 1, scoreMode: 'binary', achieveThreshold: 1, iconName: 'dumbbell',   active: true },
  { title: '청소',          weight: 5, timeOfDay: 'evening', order: 2, scoreMode: 'binary', achieveThreshold: 1, iconName: 'sparkles',   active: true },
];

// ── 시드 기도제목 데이터 ──────────────────────────────────
export type PrayerSeed = Pick<PrayerDoc, 'group' | 'target' | 'title' | 'priority'> & {
  body?: string;
  pinned?: boolean;
};

export const SEED_PRAYERS: PrayerSeed[] = [
  { group: '개인', target: '나 자신', title: '말씀과 기도로 하루를 시작하기',   priority: 'high', pinned: true,  body: '매일 아침 QT와 기도로 하나님과 동행하기' },
  { group: '개인', target: '나 자신', title: '미디어 절제와 마음의 절제',       priority: 'mid',  body: '스마트폰·숏츠 사용을 줄이고 집중력 회복' },
  { group: '개인', target: '가족',     title: '가족의 건강과 믿음',              priority: 'high', body: '부모님의 건강과 온 가족의 신앙 성장' },
  { group: '교회', target: '교회 공동체', title: '교회 공동체와 주일 예배',      priority: 'mid',  body: '함께 예배하는 지체들과 교회의 부흥' },
  { group: 'CMF',  target: '나 자신', title: '맡은 사역을 충성되게',            priority: 'mid',  body: '섬기는 자리에서 지혜와 사랑으로 감당하기' },
  { group: '개인', target: '친구',     title: '친구·지인의 구원과 회복',         priority: 'low',  body: '아직 주님을 모르는 친구들을 위한 중보' },
];

// 기도 우선순위 라벨 (UI 표시용)
export const PRAYER_PRIORITY_LABELS: Record<PrayerPriority, string> = {
  high: '높음',
  mid:  '보통',
  low:  '낮음',
};
