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
  dailyPrayerLimit?: number; // 오늘의 기도 목록 상한 직접 지정. 미설정/0 = 활성 수 기반 자동(adaptiveDailyLimit)
  habitGroups?: HabitGroup[];   // 습관 묶음(예: '학교') — 일괄 건너뛰기 단위. 사용자가 직접 만든다.
  prayerReminder?: {         // 기도 리마인더 (FCM) — 설정한 시각에 하루 1회
    enabled: boolean;
    hour: number;            // 0~23 (KST)
  };
  notifications?: {          // 알림 타입별 on/off (미설정 = on). 푸시 알림이 켜진 경우에만 의미 있음
    habitReminder?: boolean; // 시간대별 습관 리마인더 + 스누즈 재알림
    morningBrief?: boolean;  // 매일 06:00 모닝 브리프
    prayerWeekly?: boolean;  // 주간 기도 회고 도착 알림
    progressWeekly?: boolean; // 주간 진척 요약 (일요일 20:00)
  };
  nickname?: string;         // 정원 둘러보기에서 다른 사용자에게 표시되는 닉네임 (중복 허용)
  mainWidgetOrder?: string[];   // 오늘 탭 위젯 표시 순서 (위젯 id 배열). 미설정 시 기본 순서 사용
  mainHiddenWidgets?: string[]; // 오늘 탭에서 숨길 위젯 id 목록
  updatedAt: Timestamp;
}

// 알림 타입 — FCM data.action 값과 1:1 대응. 전달/오픈 트래킹 및 타입별 on/off 키로 사용.
export type NotificationType =
  | 'habit_reminder'
  | 'prayer_reminder'
  | 'morning_brief'
  | 'prayer_weekly'
  | 'progress_weekly';

// 알림 전달/오픈 트래킹 (일자별 집계) — users/{uid}/notifStats/{YYYY-MM-DD}
//  - sent:   FCM 가 접수한 토큰 수 (디바이스 도달이 아닌 '발송 성공')
//  - failed: FCM 접수 실패 토큰 수
//  - opened: 사용자가 알림을 눌러 앱을 연(또는 포커스한) 횟수
export interface NotificationStatsDoc {
  date: string;
  sent?: Partial<Record<NotificationType, number>>;
  failed?: Partial<Record<NotificationType, number>>;
  opened?: Partial<Record<NotificationType, number>>;
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
  applicationCheckAwardedIds?: string[]; // 오늘 말씀 적용 실천 체크 포인트가 적립돼 있는 application id (해제 시 삭감)
  applicationCountedIds?: string[];      // 오늘 실천 카운트·연속이 반영된 application id (영구; 체크↔해제 반복 시 폭증 방지)
  // ── 습관 미완료 패널티 (dailyReset 가 어제 분에 1회 적용; penaltyApplied 멱등 게이트) ──
  penaltyApplied?: boolean;       // 이 날짜에 패널티 정산을 이미 마쳤는지
  penaltyPoints?: number;         // 차감된 포인트(절댓값)
  penaltyHealthLoss?: number;     // 감소된 정원 생기(절댓값)
  penaltyCount?: number;          // 패널티 대상 습관 수 (미기록+미달성)
  morningBrief?: MorningBrief;    // 매일 06:00 생성되는 개인화 모닝 브리프
  resolutionPracticed?: boolean;  // 어제 회고의 '내일의 다짐(q_tomorrow)'을 오늘 실천했는지 — 회고 피드백 루프
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

// ── 습관 묶음 ────────────────────────────────────────────
// UserSettingsDoc.habitGroups[] — 예: '학교'. 등교일에만 하는 습관을 묶어 일괄 건너뛰기 한다.
export interface HabitGroup {
  id: string;
  name: string;
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
  groupId?: string | null;          // 소속 습관 묶음 id (HabitGroup.id). 없으면 묶음 없음.
  hibernatedSince?: string | null;  // YYYY-MM-DD, 휴면 시작일
  hibernatedUntil?: string | null;  // YYYY-MM-DD, 휴면 종료(깨운)일. 비어있으면 현재 휴면 중
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
  daySatisfaction?: number;       // 오늘 하루를 얼마나 잘 살았는지 자기평가 (1-10, 주관적 종속변수)
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
  verse?: {                     // AI 추천 말씀 (개역개정) — 상세·기도 모드에 표시
    reference: string;          // 예: "시편 46:10"
    text: string;
    reason?: string;            // 이 기도와의 연결 한 줄
  };

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

// ── 말씀 적용 (큐티·주일설교·말씀묵상 → 삶의 적용 다회 실천 추적) ──────────
// users/{uid}/applications/{id}
// 적용(무엇을 실천할지)을 기록하고, 이후 며칠간 '오늘 실천했나?'를 체크해
// 실천 횟수·연속일을 추적한다(기도제목 체크와 동일한 멱등 구조).
export type ApplicationType = 'qt' | 'sermon' | 'meditation' | 'lgm' | 'etc';   // 큐티 / 주일설교 / 말씀묵상 / LGM / 기타
export type ApplicationStatus = 'active' | 'completed' | 'archived';

export interface ApplicationDoc {
  id: string;
  type: ApplicationType;
  date: string;               // 'YYYY-MM-DD' — 말씀을 받은(작성) 날
  reference?: string;         // 본문 (예: '요한복음 3:16')
  title?: string;             // 설교 제목 / 묵상 주제 (선택)
  insight?: string;           // 깨달은 말씀 — 무엇을 말씀하셨나 (선택)
  application: string;        // 구체적 적용 — 무엇을 실천할지 (필수)
  status: ApplicationStatus;
  targetDays: number;         // 며칠간 실천할 목표 (기본 7)
  practiceCount: number;      // 누적 실천 횟수 (= practicedDates.length)
  practicedDates: string[];   // 실천 체크한 날짜들 ('YYYY-MM-DD'); 서버(applicationAward)가 관리
  streak: number;             // 연속 실천일
  lastPracticedAt?: Timestamp;
  completedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 일일 실천 체크 — users/{uid}/days/{YYYY-MM-DD}/applicationChecks/{appId}
export interface ApplicationCheckDoc {
  applicationId: string;
  practicedAt: Timestamp;
}

export const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = {
  qt:         '큐티',
  sermon:     '주일설교',
  meditation: '말씀묵상',
  lgm:        'LGM',
  etc:        '기타',
};

export const APPLICATION_DEFAULT_TARGET_DAYS = 7;

export const APPLICATION_POINT_EARN = {
  PRACTICE_CHECK: 3,   // 하루 1건 실천 체크
  COMPLETE:       20,  // 적용을 '완료'로 마무리 (간증/정착)
} as const;

// 하루 실천 체크 포인트 상한 (인플레이션 방지)
export const APPLICATION_DAILY_CHECK_CAP = 30;

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
  lastDailyGardenDate?: string;               // 일일 정산(processDailyGarden)을 마친 게임일(YYYY-MM-DD, 04:00 KST). 중복 실행 시 재정산 방지.
  lastPassiveYieldDate?: string;              // 만개 식물 passive yield 를 지급한 게임일(YYYY-MM-DD, 04:00 KST).
                                              //   서버 일일 리셋과 클라이언트 이중 경로가 공유 → 하루 1회만 지급(스케줄드 누락 보완).
  lastPassiveYieldAmount?: number;            // 마지막으로 지급한 passive yield 액수(P). 체감 토스트 표시에 사용.
  starBoostBonus?: number;                    // ★3 종 누계로 인한 종합 효율 메타 (정보용)
  plantsLost?: number;                        // 게을러져 죽은(영구 제거된) 식물 누적 수
  dailyDirectPlants?: number;                 // 오늘 직접 심기 횟수 (04:00 KST 리셋)
  dailyDirectPlantsDate?: string;             // 'YYYY-MM-DD' 게임일 기준
  lastDailyRecap?: DailyGardenRecap;          // 마지막 일일 정산 요약 (정원 탭에서 '어젯밤 정원 소식'으로 표시)
  crownClaimed?: string[];                    // crown(면류관·백향목) 영구 보상을 이미 받은 식물 instance id 목록
}

// 한 식물이 어젯밤 일일 정산에서 겪은 변화·기여를 정리한 항목.
// events 는 발생한 사건, 나머지는 그 식물이 가져다준(또는 낸) 수치.
export interface DailyGardenRecapPlant {
  plantId: string;
  speciesId: string;
  events: ('grew' | 'bloomed' | 'withered' | 'regressed' | 'died')[];
  yield?: number;     // 그 식물이 벌어다 준 포인트(P)
  xp?: number;        // 그 식물이 가져다준 경험치(XP)
  vitality?: number;  // 그 식물이 회복시킨 정원 생기
  upkeep?: number;    // 그 식물 유지에 든 포인트(P)
}

/**
 * 일일 정산 요약 — 매일 04:00 KST 정원 처리(processDailyGarden)에서 일어난 변화를
 * 한 번에 정리해 정원 탭에서 자세히 볼 수 있게 한다. (gameDay 가 오늘이면 노출)
 *
 * 서버 정산이 누락돼 클라이언트 이중 경로가 passive yield 만 지급한 경우에는 partial=true 로
 * 일부(포인트 수익)만 채워진 요약이 들어갈 수 있다.
 */
export interface DailyGardenRecap {
  gameDay: string;            // 이 요약이 다루는 게임일 'YYYY-MM-DD' (04:00 KST)
  yesterdaySuccess: boolean;  // 어제를 성공일로 마쳤는지
  protectedDay: boolean;      // 보호된 날(휴가·그레이스·freeze)이었는지
  pointsEarned: number;       // 만개 식물 passive yield 합계(P)
  upkeepPaid: number;         // 초월 식물 유지비 합계(P)
  xpGained: number;           // 식물이 가져다준 경험치 합계(XP)
  healthBefore: number;       // 정산 전 정원 생기
  healthAfter: number;        // 정산 후 정원 생기
  grown: number;              // 한 단계 이상 자란 식물 수
  bloomed: number;            // 이날 만개에 도달한 식물 수
  withered: number;           // 새로 시든 식물 수
  regressed: number;          // 한 단계 시든(stage↓) 식물 수
  lost: number;               // 영구히 떠나보낸 식물 수
  streakSeed: boolean;        // 7일 스트릭 보너스 씨앗을 받았는지
  plants: DailyGardenRecapPlant[]; // 변화·기여가 있는 식물별 상세
  partial?: boolean;          // 클라이언트 이중 경로가 일부만 채운 요약
  createdAt?: Timestamp;      // 서버 정산이 남긴 생성 시각(표시용 합성 요약에는 없을 수 있음)
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
  neglectStreak?: number;         // 연속 실패(게으른)일 수 — trial/연약 전설 trait 에서 사용
  wateredAt?: Timestamp;          // 마지막 물주기 시각 (하루 1회 제한)
  bloomDays?: number;             // 만개 유지 연속일 — compound(복리)·crown(면류관) trait 에서 사용
  restUsedWeek?: string;          // 이번 주 '안식'(sabbath) 사용 ISO 주키 (예 2026-W25)
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
  UNLOCK_SACRED: 12000,           // 신성 등급 해금 비용 (가장 귀함)
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

export type PlantRarity = 'basic' | 'common' | 'rare' | 'epic' | 'legendary' | 'sacred';

// 등급별 일일 수확 (만개 식물 → spendablePoints 자동 가산) 기본값
export const DAILY_YIELD_BY_RARITY: Record<PlantRarity, number> = {
  basic: 2, common: 4, rare: 6, epic: 10, legendary: 15, sacred: 12,
};

// 등급별 물주기 시 샘물 소비량. 기본(basic)=5, 등급이 오를수록 증가.
export const SPRING_WATER_BY_RARITY: Record<PlantRarity, number> = {
  basic: 5, common: 6, rare: 8, epic: 11, legendary: 14, sacred: 18,
};

// 등급별 '건강한 성장'에 필요한 최소 정원 생기. 미달 시 성장 정체·시듦 위험↑ (고티어일수록 관리 부담↑).
export const MIN_VITALITY_BY_RARITY: Record<PlantRarity, number> = {
  basic: 0, common: 20, rare: 40, epic: 55, legendary: 70, sacred: 85,
};

// streakHarvest(연속의 결실) 발동에 필요한 전체 연속일 임계
export const STREAK_HARVEST_MIN = 7;

// 티어 점진 해금: 다음 등급은 이전 등급을 ⌈prevCount × 이 비율⌉ 종 보유 시 열린다.
export const TIER_GATE_RATIO = 0.6;

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

// ── 습관 미완료 패널티 (설계: 매일 04:00 어제 분 정산) ────────────────────
// 대상: 손도 안 댄(미기록) + 시도했으나 미달성. 건너뛰기·휴면·보호된 날은 제외.
// 미기록(방치)은 미달성(시도)보다 무겁게 본다(MISSED_FACTOR 로 감경).
// 포인트는 사용 포인트(spendable)만 차감하며 레벨/누적 XP 는 보존(레벨 후퇴 없음).
export const HABIT_PENALTY = {
  POINT_PER_WEIGHT: 1,     // 미기록 습관 1개당 가중치 × 이 값 P 차감
  MISSED_FACTOR: 0.5,      // 미달성(시도)은 위 패널티의 절반만
  DAILY_POINT_CAP: 40,     // 하루 포인트 차감 상한
  HEALTH_PER_TODO: 2,      // 미기록 1개당 정원 생기 감소
  HEALTH_PER_MISSED: 1,    // 미달성 1개당 정원 생기 감소
  DAILY_HEALTH_CAP: 12,    // 하루 생기 감소 상한
} as const;

// ── 할 일(todo) 포인트 상수 ───────────────────────────────
export const TODO_POINT_EARN = {
  TODO_CHECK: 3,    // 오늘 할 일 1건 완료
} as const;

// 하루 할 일 완료 포인트 상한 (인플레이션 방지)
export const TODO_DAILY_CHECK_CAP = 30;

// 오늘의 기도 로테이션 목록 상한 N (활성 수가 적을 때의 하한·기본값)
export const PRAYER_ROTATION_LIMIT = 9;

// 하루에 새로 노출하는 '미시작' 기도제목 상한 (무더기 입력 시 폭주 방지 — A)
export const PRAYER_NEW_PER_DAY = 3;

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
  // ── 신규 능력 체계 (활성 로스터) ──
  | { kind: 'streakHarvest'; pct: number }   // A1 연속의 결실: 전체 연속 STREAK_HARVEST_MIN+ 일 때 수확 +pct
  | { kind: 'sabbath' }                      // A7 안식: 주 1회 '쉼의 날'엔 시들지 않음
  | { kind: 'catalyst' }                     // B2 촉매: 매일 정원 내 다른 비만개 식물 1개 +1 성장
  | { kind: 'guardian' }                     // B1 수호자: 매일 정원 식물 1개 시듦 방지
  | { kind: 'amplifier'; pct: number }       // B3 증폭자: 정원 전체 일일수익 +pct
  | { kind: 'compound' }                     // C3 복리: 일일수익이 bloomDays 에 비례해 점증
  | { kind: 'purifier'; heal: number }       // B4 정화자: 매일 정원 생기 +heal
  | { kind: 'prayerSync'; pct: number }      // A2 기도 동조: 기도 streak>0 일 때 수확 +pct
  | { kind: 'trial'; graceDays: number; multiplier: number } // D1 인내의 시험: graceDays 연속 거르면 죽음, 수확 ×multiplier
  | { kind: 'crown'; days: number }          // D6 면류관: bloomDays≥days 면 영구 보상 1회
  | { kind: 'grace' }                        // E1+E2 은혜·치유: 매일 자동성장·불사 + 생기회복 + 시든 식물 소생
  | { kind: 'communion'; pct: number }       // E4 화목: 정원 내 다른 식물 수익 +pct
  | { kind: 'eternal' }                      // E6 영존: 시들지 않고 만개 유지
  | { kind: 'abundance' }                    // C1 풍요: 수확↑↑·일일0 (라벨 마커; 실효과는 dailyYield:0+높은 harvestYield)
  // ── 레거시 (은퇴 종 보존용 — 신규 종엔 미사용) ──
  | { kind: 'lucky' }
  | { kind: 'beauty'; xp: number }
  | { kind: 'hardy' }
  | { kind: 'fast' }
  | { kind: 'healer'; heal: number }
  | { kind: 'streakSync' }
  | { kind: 'bloomer' }
  | { kind: 'brittle' }
  | { kind: 'fragile' }
  | { kind: 'waning'; graceDays: number }
  | { kind: 'regress' }
  | { kind: 'radiant' }
  | { kind: 'transcendent'; upkeep: number; dailyXp: number; effect: 'vitality' | 'guardian' | 'none'; amount: number };

export interface PlantSpecies {
  id: string;
  name: string;
  rarity: PlantRarity;
  unlockCost: number;
  stages: number;
  trait?: PlantTrait;
  harvestYield?: number;             // 만개 수확 시 환급 P
  seedCost?: number;                 // 종별 차등 심기 비용 (없으면 POINT_PRICES.SEED)
  dailyYield?: number;               // 만개 후 일일 자동 P (없으면 DAILY_YIELD_BY_RARITY[rarity])
  description?: string;
  retired?: boolean;                 // 은퇴 종: 상점·도감·배지·게이트에서 제외(정의는 유지해 기존 인스턴스 보존)
}

export const PLANT_SPECIES: PlantSpecies[] = [
  // ── 기본 (basic) ×11 — 능력 없음, 입문·진행 페이싱 ─────────
  { id: 'sprout',    name: '새싹풀',   rarity: 'basic', unlockCost: 0,  seedCost: 25, stages: 4, harvestYield: 15, description: '기본 새싹. 모든 정원의 시작점.' },
  { id: 'moss',      name: '이끼',     rarity: 'basic', unlockCost: 30, seedCost: 25, stages: 2, harvestYield: 12, description: '🌿 작지만 끈질긴 이끼.' },
  { id: 'dandelion', name: '민들레',   rarity: 'basic', unlockCost: 50, seedCost: 25, stages: 3, harvestYield: 18, description: '🍃 흔하지만 강인한 들꽃.' },
  { id: 'clover',    name: '클로버',   rarity: 'basic', unlockCost: 40, seedCost: 25, stages: 3, harvestYield: 16, description: '🍀 소박한 행복의 풀.' },
  { id: 'daisy',     name: '데이지',   rarity: 'basic', unlockCost: 50, seedCost: 25, stages: 4, harvestYield: 20, description: '🌼 순수한 흰 꽃.' },
  { id: 'violet',    name: '제비꽃',   rarity: 'basic', unlockCost: 35, seedCost: 25, stages: 3, harvestYield: 15, description: '🌷 겸손한 보랏빛 제비꽃.' },
  { id: 'balsam',    name: '봉선화',   rarity: 'basic', unlockCost: 45, seedCost: 25, stages: 4, harvestYield: 18, description: '💮 손톱을 물들이던 추억의 꽃.' },
  { id: 'foxtail',   name: '강아지풀', rarity: 'basic', unlockCost: 30, seedCost: 25, stages: 2, harvestYield: 12, description: '🌾 바람에 흔들리는 풋풋한 풀.' },
  { id: 'chickweed', name: '별꽃',     rarity: 'basic', unlockCost: 35, seedCost: 25, stages: 3, harvestYield: 14, description: '✨ 작은 흰 별 모양 꽃.' },
  { id: 'mugwort',   name: '쑥',       rarity: 'basic', unlockCost: 40, seedCost: 25, stages: 3, harvestYield: 16, description: '🌿 강인한 들약초.' },
  { id: 'portulaca', name: '채송화',   rarity: 'basic', unlockCost: 45, seedCost: 25, stages: 3, harvestYield: 17, description: '🌸 햇볕 아래 알록달록 피는 꽃.' },

  // ── 일반 (common) ×10 ───────────────────────────────────
  { id: 'sunflower',     name: '해바라기', rarity: 'common', unlockCost: 200, seedCost: 50, stages: 5, harvestYield: 60, description: '🌻 햇살을 머금은 꽃.' },
  { id: 'rose',          name: '장미',     rarity: 'common', unlockCost: 250, seedCost: 50, stages: 5, harvestYield: 75, description: '🌹 아름다움과 사랑의 꽃.' },
  { id: 'herb',          name: '허브',     rarity: 'common', unlockCost: 200, seedCost: 50, stages: 4, harvestYield: 45, description: '🌿 향긋한 잎.' },
  { id: 'mint',          name: '민트',     rarity: 'common', unlockCost: 200, seedCost: 40, stages: 3, harvestYield: 45, description: '🌱 싱그러운 민트.' },
  { id: 'tulip',         name: '튤립',     rarity: 'common', unlockCost: 220, seedCost: 50, stages: 4, harvestYield: 60,
    trait: { kind: 'streakHarvest', pct: 0.2 }, description: '🌷 연속의 결실: 전체 연속 7일 이상이면 수확 +20%.' },
  { id: 'lavender',      name: '라벤더',   rarity: 'common', unlockCost: 230, seedCost: 50, stages: 4, harvestYield: 58,
    trait: { kind: 'sabbath' }, description: '💜 안식: 주 1회 쉼의 날엔 시들지 않는다.' },
  { id: 'narcissus',     name: '수선화',   rarity: 'common', unlockCost: 210, seedCost: 50, stages: 4, harvestYield: 52, description: '🌼 새 출발을 알리는 꽃.' },
  { id: 'pansy',         name: '팬지',     rarity: 'common', unlockCost: 200, seedCost: 50, stages: 4, harvestYield: 50, description: '🌸 얼굴무늬가 친근한 삼색 꽃.' },
  { id: 'marigold',      name: '금잔화',   rarity: 'common', unlockCost: 200, seedCost: 50, stages: 4, harvestYield: 50, description: '🟠 따뜻한 주황빛 꽃.' },
  { id: 'morning_glory', name: '나팔꽃',   rarity: 'common', unlockCost: 210, seedCost: 50, stages: 4, harvestYield: 54, description: '🌅 아침을 여는 나팔꽃.' },

  // ── 희귀 (rare) ×7 ──────────────────────────────────────
  { id: 'maple',        name: '단풍나무', rarity: 'rare', unlockCost: 350, seedCost: 80, stages: 6, harvestYield: 120, description: '🍁 계절을 머금은 나무.' },
  { id: 'lotus',        name: '연꽃',     rarity: 'rare', unlockCost: 500, seedCost: 80, stages: 6, harvestYield: 150, description: '🪷 진흙 위 피어난 정결한 꽃.' },
  { id: 'orchid',       name: '난초',     rarity: 'rare', unlockCost: 400, seedCost: 80, stages: 5, harvestYield: 105, description: '🌸 귀한 보라꽃.' },
  { id: 'hydrangea',    name: '수국',     rarity: 'rare', unlockCost: 500, seedCost: 75, stages: 6, harvestYield: 135, description: '💠 풍성한 수국 송이.' },
  { id: 'bamboo',       name: '대나무',   rarity: 'rare', unlockCost: 300, seedCost: 80, stages: 6, harvestYield: 120,
    trait: { kind: 'catalyst' }, description: '🎋 촉매: 매일 정원의 다른 식물 하나를 한 단계 키운다.' },
  { id: 'pine',         name: '소나무',   rarity: 'rare', unlockCost: 450, seedCost: 80, stages: 7, harvestYield: 130,
    trait: { kind: 'guardian' }, description: '🌲 수호자: 매일 정원 식물 하나의 시듦을 막는다.' },
  { id: 'plum_blossom', name: '매화',     rarity: 'rare', unlockCost: 420, seedCost: 80, stages: 6, harvestYield: 125, description: '🌸 잔설 속 피어나는 인내의 꽃.' },

  // ── 에픽 (epic) ×5 — 성경: 풍요·향·예배 ──────────────────
  { id: 'fig',         name: '무화과',   rarity: 'epic', unlockCost: 800,  seedCost: 130, stages: 5, harvestYield: 320, dailyYield: 0,
    trait: { kind: 'abundance' }, description: '🫐 풍요: 일일 수익은 없지만 만개 수확이 매우 크다.' },
  { id: 'pomegranate', name: '석류',     rarity: 'epic', unlockCost: 900,  seedCost: 140, stages: 5, harvestYield: 210, description: '🔴 다산과 풍성을 상징하는 붉은 열매.' },
  { id: 'olive',       name: '감람나무', rarity: 'epic', unlockCost: 1000, seedCost: 150, stages: 6, harvestYield: 240,
    trait: { kind: 'compound' }, description: '🫒 복리: 만개를 오래 유지할수록 일일 수익이 점점 늘어난다.' },
  { id: 'grape',       name: '포도나무', rarity: 'epic', unlockCost: 950,  seedCost: 140, stages: 5, harvestYield: 220,
    trait: { kind: 'amplifier', pct: 0.1 }, description: '🍇 증폭자: 정원 전체 일일 수익 +10%.' },
  { id: 'saffron',     name: '사프란',   rarity: 'epic', unlockCost: 1100, seedCost: 150, stages: 5, harvestYield: 250, description: '🌸 귀한 향품, 보랏빛 크로커스.' },

  // ── 전설 (legendary) ×4 — 성경: 위엄·신비·시험 ───────────
  { id: 'palm',         name: '종려나무',       rarity: 'legendary', unlockCost: 2800, seedCost: 240, stages: 7, harvestYield: 620, dailyYield: 15,
    trait: { kind: 'trial', graceDays: 3, multiplier: 2 }, description: '🌴 인내의 시험: 사흘 연속 거르면 스러지나, 끝까지 지키면 수확 ×2.' },
  { id: 'cedar',        name: '레바논 백향목', rarity: 'legendary', unlockCost: 3200, seedCost: 260, stages: 8, harvestYield: 680, dailyYield: 15,
    trait: { kind: 'crown', days: 30 }, description: '🌲 면류관: 만개를 30일 유지하면 영구 보상을 받는다.' },
  { id: 'myrrh',        name: '몰약나무',       rarity: 'legendary', unlockCost: 3000, seedCost: 240, stages: 6, harvestYield: 580, dailyYield: 15,
    trait: { kind: 'purifier', heal: 8 }, description: '🌫️ 정화자: 매일 정원 생기를 +8 회복한다.' },
  { id: 'frankincense', name: '유향나무',       rarity: 'legendary', unlockCost: 3400, seedCost: 260, stages: 7, harvestYield: 640, dailyYield: 15,
    trait: { kind: 'prayerSync', pct: 0.5 }, description: '🪔 기도 동조: 기도 연속일 동안 수확 +50%.' },

  // ── 신성 (sacred) ×3 — 성경: 은혜의 정점 ─────────────────
  { id: 'tree_of_life',  name: '생명나무',         rarity: 'sacred', unlockCost: 12000, seedCost: 1000, stages: 8, harvestYield: 800, dailyYield: 15,
    trait: { kind: 'grace' }, description: '🌳 은혜: 값없이 매일 자라며 시들지 않는다. 매일 정원 생기를 회복하고 시든 식물 하나를 소생시킨다.' },
  { id: 'true_vine',     name: '참포도나무',       rarity: 'sacred', unlockCost: 11000, seedCost: 900, stages: 7, harvestYield: 700, dailyYield: 12,
    trait: { kind: 'communion', pct: 0.15 }, description: '🍇 화목: 정원의 다른 식물들이 함께 풍성해진다(수익 +15%).' },
  { id: 'burning_bush',  name: '불타는 떨기나무', rarity: 'sacred', unlockCost: 11000, seedCost: 900, stages: 6, harvestYield: 680, dailyYield: 12,
    trait: { kind: 'eternal' }, description: '🔥 영존: 꺼지지 않는 불꽃처럼 시들지 않고 만개를 유지한다.' },

  // ── 은퇴 (retired) — 상점·도감·배지에서 숨김. 정의를 남겨 기존에 심긴 인스턴스를 보존한다. ──
  { id: 'cactus',     name: '선인장',   rarity: 'common',    unlockCost: 180,   seedCost: 50,   stages: 3, harvestYield: 45,  retired: true,
    trait: { kind: 'hardy' }, description: '🌵 (지난 식물) 시들기 면역.' },
  { id: 'fern',       name: '고사리',   rarity: 'rare',      unlockCost: 380,   seedCost: 70,   stages: 5, harvestYield: 110, retired: true,
    trait: { kind: 'healer', heal: 5 }, description: '🌿 (지난 식물) 만개 시 정원 생기 +5.' },
  { id: 'carnation',  name: '카네이션', rarity: 'rare',      unlockCost: 420,   seedCost: 70,   stages: 5, harvestYield: 120, retired: true, description: '🌷 (지난 식물) 감사의 꽃.' },
  { id: 'cosmos',     name: '코스모스', rarity: 'epic',      unlockCost: 700,   seedCost: 130,  stages: 5, harvestYield: 180, retired: true,
    trait: { kind: 'streakSync' }, description: '✨ (지난 식물) 기도 연속 시 수확 +50%.' },
  { id: 'firefly_flower', name: '반딧불꽃', rarity: 'epic',  unlockCost: 800,   seedCost: 130,  stages: 6, harvestYield: 210, retired: true,
    trait: { kind: 'streakSync' }, description: '🌟 (지난 식물) 기도 연속 시 수확 +50%.' },
  { id: 'rainbow_iris', name: '무지개붓꽃', rarity: 'epic',  unlockCost: 1100,  seedCost: 130,  stages: 5, harvestYield: 240, retired: true,
    trait: { kind: 'lucky' }, description: '🌈 (지난 식물).' },
  { id: 'moonbloom',  name: '달꽃',     rarity: 'epic',      unlockCost: 1300,  seedCost: 150,  stages: 6, harvestYield: 270, retired: true,
    trait: { kind: 'healer', heal: 15 }, description: '🌙 (지난 식물) 만개 시 정원 생기 +15.' },
  { id: 'crystal_rose', name: '수정장미', rarity: 'legendary', unlockCost: 4000, seedCost: 280, stages: 6, harvestYield: 820, dailyYield: 28, retired: true,
    trait: { kind: 'brittle' }, description: '💎 (지난 식물) 거른 날 즉시 스러진다.' },
  { id: 'starlight_lily', name: '별빛백합', rarity: 'legendary', unlockCost: 3200, seedCost: 240, stages: 7, harvestYield: 600, dailyYield: 20, retired: true,
    trait: { kind: 'fragile' }, description: '✨ (지난 식물).' },
  { id: 'aurora_orchid', name: '오로라난초', rarity: 'legendary', unlockCost: 3000, seedCost: 230, stages: 6, harvestYield: 560, dailyYield: 18, retired: true,
    trait: { kind: 'waning', graceDays: 3 }, description: '🌌 (지난 식물).' },
  { id: 'golden_peony', name: '황금모란', rarity: 'legendary', unlockCost: 3400, seedCost: 250, stages: 7, harvestYield: 640, dailyYield: 22, retired: true,
    trait: { kind: 'regress' }, description: '🏵️ (지난 식물).' },
  { id: 'dawn_lily',  name: '여명백합', rarity: 'legendary', unlockCost: 3800, seedCost: 270, stages: 8, harvestYield: 760, dailyYield: 26, retired: true,
    trait: { kind: 'radiant' }, description: '🌅 (지난 식물).' },
  { id: 'celestial_tree', name: '천상수', rarity: 'sacred', unlockCost: 12000, seedCost: 1500, stages: 7, harvestYield: 1500, dailyYield: 0, retired: true,
    trait: { kind: 'transcendent', upkeep: 30, dailyXp: 60, effect: 'none', amount: 0 }, description: '🌟 (지난 식물).' },
  { id: 'eternal_bloom', name: '영겁화', rarity: 'sacred', unlockCost: 12000, seedCost: 1500, stages: 6, harvestYield: 1500, dailyYield: 0, retired: true,
    trait: { kind: 'transcendent', upkeep: 30, dailyXp: 40, effect: 'vitality', amount: 1 }, description: '🌹 (지난 식물).' },
  { id: 'galaxy_lily', name: '은하백합', rarity: 'sacred', unlockCost: 12000, seedCost: 1500, stages: 6, harvestYield: 1500, dailyYield: 0, retired: true,
    trait: { kind: 'transcendent', upkeep: 30, dailyXp: 40, effect: 'guardian', amount: 1 }, description: '🌌 (지난 식물).' },
];

// 활성 종 = 은퇴하지 않은 종 (상점·도감·배지·티어게이트 공통 필터)
export const isActiveSpecies = (s: PlantSpecies): boolean => !s.retired;

// 도감/컬렉션 완성 기준 종 수 — 신성(sacred)·은퇴 종은 제외.
export const CODEX_SPECIES_COUNT = PLANT_SPECIES.filter((s) => s.rarity !== 'sacred' && !s.retired).length;

// 레벨 마일스톤 도달 시 확정 해금되는 종 (레벨 → speciesId)
export const MILESTONE_SPECIES_GRANTS: Record<number, string> = {
  10: 'fig', 15: 'olive', 20: 'palm', 25: 'cedar',
};

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
  { id: 'collector_25',  title: '생명의 정원',   tier: 'gold',   description: '식물 종 25개 해금' },
  { id: 'collector_30',  title: '푸른 손길',     tier: 'gold',   description: '식물 종 30개 해금' },
  { id: 'collector_37',  title: '만개한 정원',   tier: 'gold',   description: '모든 식물 종 37개 해금' },
  // ── 정원 2차: 수확 챌린지 ──────────────────────────────
  { id: 'harvest_rare_10',      title: '귀한 수확',     tier: 'silver', description: '희귀 이상 10회 수확' },
  { id: 'harvest_epic_5',       title: '에픽 수확가',   tier: 'gold',   description: '에픽 식물 5회 수확' },
  { id: 'harvest_legendary_1',  title: '전설의 정원사', tier: 'gold',   description: '전설 식물 1회 수확' },
  // ── 정원 2차: 트레잇·자동 성장 ─────────────────────────
  { id: 'rare_drop_5',          title: '행운의 손길',   tier: 'bronze', description: '희귀 씨앗 드롭 5회 경험' },
  { id: 'autogrow_50',          title: '자라나는 정원', tier: 'silver', description: '습관·기도로 자동 성장 50회' },
  // ── 정원 2차: 도감·생기 ───────────────────────────────
  { id: 'codex_complete',       title: '도감 완성',     tier: 'gold',   description: '식물 도감 37종 모두 발견' },
  { id: 'garden_healthy_14',    title: '활기찬 정원',   tier: 'silver', description: '정원 생기 80 이상 14일 연속' },
  // ── 초월 (프레스티지) ─────────────────────────────────
  { id: 'sacred_keeper',        title: '신성의 수호자', tier: 'gold',   description: '신성 식물을 보유' },
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
