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
  mainWidgetOrder?: string[];   // 오늘 탭 위젯 표시 순서 (위젯 id 배열). 미설정 시 기본 순서 사용
  mainHiddenWidgets?: string[]; // 오늘 탭에서 숨길 위젯 id 목록
  lifeContext?: LifeContext; // 말씀 적용 AI가 참고할 사용자 생활 환경 (적용점을 실제 삶에 맞게 구체화)
  updatedAt: Timestamp;
}

// 말씀 적용 AI(parseApplication)가 참고하는 사용자 생활 환경.
// 모든 항목은 선택이며, 채워진 항목만 프롬프트에 포함된다(shared/lib/lifeContext).
export interface LifeContext {
  role?: string;     // 직업·신분 (예: '고3 수험생', '두 아이 키우는 직장맘', '편의점 야간 알바')
  family?: string;   // 함께 사는 가족·가정 상황 (예: '부모님·동생과 거주, 아버지와 갈등 중')
  routine?: string;  // 하루 일과·주요 시간대 (예: '평일 9-18시 근무, 출퇴근 지하철 1시간')
  people?: string;   // 자주 만나는 사람 (예: '같은 팀 동료 3명, 주일 청년부 셀원들')
  focus?: string;    // 요즘 영적 고민·바라는 변화 (예: '쉽게 화내는 습관, 말씀 묵상 꾸준함')
  memo?: string;     // 그 밖에 AI가 알면 좋을 자유 메모
  updatedAt?: Timestamp;
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
  successAwarded?: boolean;       // 오늘 '성공한 날' 스트릭 증가가 반영됐는지 (체크↔해제 반복 시 스트릭 폭증 방지)
  aiFeedback?: AIFeedback;
  finalized?: boolean;
  prayerPlan?: PrayerPlan;        // 오늘의 기도 목록 (dailyReset이 미리 계산)
  todosCarriedOver?: boolean;       // 전날 미완료 할 일 이월이 끝났는지 (하루 1회만 실행 — 멱등 가드)
  prayerCountedIds?: string[];    // 오늘 기도 카운트·스트릭이 반영된 기도제목 id (영구; 체크↔해제 반복 시 prayCount/스트릭 폭증 방지)
  prayerListCompleted?: boolean;  // 오늘 목록 완주가 반영됐는지 (prayerStreak 하루 1회 게이트)
  applicationCountedIds?: string[];      // 오늘 실천 카운트·연속이 반영된 application id (영구; 체크↔해제 반복 시 폭증 방지)
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
// active=진행 중 / completed=완료(정착) / archived=사용자가 직접 보관 / lapsed=오래 실천이 없어 자동 보류
export type ApplicationStatus = 'active' | 'completed' | 'archived' | 'lapsed';

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
  lapsedAt?: Timestamp;       // 오래 방치돼 자동 보류(lapsed)된 시각 (dailyReset이 설정)
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

// 마지막 실천(없으면 시작일) 이후 이 일수를 넘도록 진행 중(active)이면서 목표 미달인 적용은
// 매일 04:00 dailyReset이 자동으로 'lapsed'(보류)로 내려 진행 목록이 무한정 쌓이지 않게 한다.
export const APPLICATION_STALE_DAYS = 7;

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

// ── 진척 통계 ─────────────────────────────────────────────
// users/{uid}/progress/main (단일 문서)
// 서버 트리거들이 merge 쓰기로 암묵 생성한다 — 클라이언트 부트스트랩 없음.
export interface ProgressDoc {
  globalStreak?: number;            // '성공한 날'(기록 습관 ≥60% 달성) 연속 일수
  globalBestStreak?: number;
  // ── 기도 진척 ──────────────────────────────
  prayerStreak?: number;            // 기도 전역 연속일
  prayerBestStreak?: number;
  lastPrayerDate?: string;          // 'YYYY-MM-DD'
  totalPrayersAnswered?: number;
  lastReminderAt?: Timestamp;       // 알림 throttle (reminders.ts)
  updatedAt: Timestamp;
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
