/**
 * 텔레그램 봇 순수 로직 — Firestore·네트워크 의존이 없는 부분만 모은다.
 *
 * Cloud Functions 쪽에는 테스트 러너가 없으므로, 값이 있는 로직(콜백 인코딩,
 * 날짜 경계, 메시지·키보드 생성, 회고 단계 전이)은 전부 여기로 빼서
 * vitest(`shared/lib/telegram.test.ts`)로 검증한다.
 */
import {
  DEFAULT_REFLECTION_QUESTIONS,
  type HabitDoc,
  type HabitCheckDoc,
} from '../types/firestore';
import { SCALED_ACHIEVE_THRESHOLD } from './habitPoints';
import { isHibernating } from './hibernation';

// shared/ 의 다른 모듈들처럼 외부 의존 없이 순수 TypeScript 로만 둔다
// (pnpm workspace 에서 shared 는 자기 node_modules 가 없어 date-fns 를 못 찾는다).
const KST_OFFSET_H = 9;
const DAY_START_H = 4;    // 하루 경계 04:00 KST

export type TelegramChatType = 'private' | 'group' | 'supergroup' | 'channel';

/**
 * 계정 데이터는 봇과의 1:1 대화에서만 노출한다. 그룹 chat id를 연결하면 그룹의 다른
 * 구성원도 인라인 버튼을 누를 수 있으므로, chat과 발신자가 같은 private 대화인지 확인한다.
 */
export function isPrivateTelegramChat(
  chat: { id: number | string; type: TelegramChatType },
  fromId: number | string | undefined,
): boolean {
  return chat.type === 'private' && fromId !== undefined && String(chat.id) === String(fromId);
}

// ── 날짜 ────────────────────────────────────────────────────────────────────
/**
 * 04:00 경계 기준 '플래너 날짜'. 웹앱 `lib/dayBoundary.plannerDate` 와 같은 규칙으로,
 * 새벽 2시에 체크해도 전날 기록으로 들어간다.
 */
export function plannerDateKST(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + (KST_OFFSET_H - DAY_START_H) * 3600_000);
  return shifted.toISOString().slice(0, 10);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' → '9월 5일(금)' */
export function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
  return `${m}월 ${d}일(${dow})`;
}

// ── HTML 이스케이프 ─────────────────────────────────────────────────────────
/**
 * parse_mode:'HTML' 로 보내므로 사용자 데이터(습관 제목·회고 답변)는 반드시 통과시킨다.
 * MarkdownV2 는 이스케이프해야 할 문자가 훨씬 많아 채택하지 않았다.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── 인라인 키보드 타입 ──────────────────────────────────────────────────────
export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}
export type InlineKeyboard = InlineButton[][];

export type HabitTimeOfDay = HabitDoc['timeOfDay'];
export type HabitListFilter = HabitTimeOfDay | 'nightAnytime' | 'all';

export interface HabitListContext {
  filter: HabitListFilter;
  pendingOnly: boolean;
  page: number;
}

export const DEFAULT_HABIT_LIST_CONTEXT: HabitListContext = {
  filter: 'all',
  pendingOnly: true,
  page: 0,
};

const FILTER_CODES: Record<HabitListFilter, string> = {
  morning: 'm',
  afternoon: 'a',
  evening: 'e',
  night: 'n',
  anytime: 'y',
  nightAnytime: 'z',
  all: 'l',
};

const CODE_FILTERS = Object.fromEntries(
  Object.entries(FILTER_CODES).map(([filter, code]) => [code, filter]),
) as Record<string, HabitListFilter>;

export function normalizeHabitListContext(
  input?: Partial<HabitListContext>,
): HabitListContext {
  const filter = input?.filter && FILTER_CODES[input.filter]
    ? input.filter
    : DEFAULT_HABIT_LIST_CONTEXT.filter;
  const rawPage = Number(input?.page ?? 0);
  return {
    filter,
    pendingOnly: input?.pendingOnly ?? DEFAULT_HABIT_LIST_CONTEXT.pendingOnly,
    page: Number.isFinite(rawPage) ? Math.max(0, Math.floor(rawPage)) : 0,
  };
}

// ── 콜백 데이터 ─────────────────────────────────────────────────────────────
// 텔레그램 callback_data 는 64바이트 제한. 'ns:action:...' 형태로 ':' 구분한다
// (날짜에는 '-'만, Firestore 자동 id 는 영숫자만 들어가므로 충돌이 없다).
export const CALLBACK_MAX_BYTES = 64;

export type Callback =
  | ({ ns: 't'; action: 'list';   date: string } & Partial<HabitListContext>)
  | ({ ns: 't'; action: 'pick';   date: string; habitId: string } & Partial<HabitListContext>)
  | ({ ns: 't'; action: 'save';   date: string; habitId: string; score: number | null } & Partial<HabitListContext>)
  | ({ ns: 't'; action: 'clear';  date: string; habitId: string } & Partial<HabitListContext>)
  | { ns: 't'; action: 'snooze'; date: string; filter: HabitListFilter; minutes: 30 | 120 }
  | { ns: 't'; action: 'pause';  date: string }
  | { ns: 'r'; action: 'answer'; value: string }
  | { ns: 'r'; action: 'start' }
  | { ns: 'r'; action: 'cancel' }
  | { ns: 'n'; action: 'toggle'; key: NotifKey };

export function encodeCallback(cb: Callback): string {
  let s: string;
  if (cb.ns === 't') {
    if (cb.action === 'snooze') {
      s = `t:z:${cb.date}:${FILTER_CODES[cb.filter]}:${cb.minutes}`;
    } else if (cb.action === 'pause') {
      s = `t:x:${cb.date}`;
    } else {
      const c = normalizeHabitListContext(cb);
      const suffix = `${FILTER_CODES[c.filter]}:${c.pendingOnly ? 'p' : 'a'}:${c.page}`;
      if (cb.action === 'list')       s = `t:l:${cb.date}:${suffix}`;
      else if (cb.action === 'pick')  s = `t:h:${cb.date}:${cb.habitId}:${suffix}`;
      else if (cb.action === 'clear') s = `t:u:${cb.date}:${cb.habitId}:${suffix}`;
      else                            s = `t:s:${cb.date}:${cb.habitId}:${cb.score === null ? 'n' : cb.score}:${suffix}`;
    }
  } else if (cb.ns === 'r') {
    if (cb.action === 'cancel')     s = 'r:x';
    else if (cb.action === 'start') s = 'r:go';
    else                            s = `r:a:${cb.value}`;
  } else {
    s = `n:t:${cb.key}`;
  }
  if (Buffer.byteLength(s, 'utf8') > CALLBACK_MAX_BYTES) {
    throw new Error(`callback_data too long (${s.length}): ${s}`);
  }
  return s;
}

/** 잘못된/오래된 페이로드는 예외 대신 null 을 돌려준다 (웹훅은 절대 500 을 내면 안 됨). */
export function parseCallback(raw: string | undefined | null): Callback | null {
  if (!raw) return null;
  const p = raw.split(':');
  if (p[0] === 't') {
    if (p[1] === 'z' && p[2] && CODE_FILTERS[p[3]] && (p[4] === '30' || p[4] === '120')) {
      return { ns: 't', action: 'snooze', date: p[2], filter: CODE_FILTERS[p[3]], minutes: Number(p[4]) as 30 | 120 };
    }
    if (p[1] === 'x' && p[2]) return { ns: 't', action: 'pause', date: p[2] };
    if (p[1] === 'l' && p[2]) {
      const c = parseHabitListContext(p, 3);
      return c ? { ns: 't', action: 'list', date: p[2], ...c } : null;
    }
    if (p[1] === 'h' && p[2] && p[3]) {
      const c = parseHabitListContext(p, 4);
      return c ? { ns: 't', action: 'pick', date: p[2], habitId: p[3], ...c } : null;
    }
    if (p[1] === 'u' && p[2] && p[3]) {
      const c = parseHabitListContext(p, 4);
      return c ? { ns: 't', action: 'clear', date: p[2], habitId: p[3], ...c } : null;
    }
    if (p[1] === 's' && p[2] && p[3] && p[4] !== undefined) {
      const score = p[4] === 'n' ? null : Number(p[4]);
      if (score !== null && !Number.isFinite(score)) return null;
      const c = parseHabitListContext(p, 5);
      return c ? { ns: 't', action: 'save', date: p[2], habitId: p[3], score, ...c } : null;
    }
    return null;
  }
  if (p[0] === 'r') {
    if (p[1] === 'x')  return { ns: 'r', action: 'cancel' };
    if (p[1] === 'go') return { ns: 'r', action: 'start' };
    if (p[1] === 'a' && p[2] !== undefined) return { ns: 'r', action: 'answer', value: p.slice(2).join(':') };
    return null;
  }
  if (p[0] === 'n' && p[1] === 't' && isNotifKey(p[2])) {
    return { ns: 'n', action: 'toggle', key: p[2] };
  }
  return null;
}

/** 배포 전 메시지의 짧은 콜백도 계속 받되, 새 콜백은 필터·페이지를 모두 검증한다. */
function parseHabitListContext(parts: string[], start: number): HabitListContext | null {
  if (parts.length === start) return { ...DEFAULT_HABIT_LIST_CONTEXT };
  const filter = CODE_FILTERS[parts[start]];
  const pending = parts[start + 1];
  const page = Number(parts[start + 2]);
  if (!filter || (pending !== 'p' && pending !== 'a') || !Number.isInteger(page) || page < 0 || page > 99) {
    return null;
  }
  return { filter, pendingOnly: pending === 'p', page };
}

// ── 습관 목록 ───────────────────────────────────────────────────────────────
/**
 * 봇이 보여줄 오늘의 습관. 웹앱 `useHabits`(active && !isHibernating)와 같은 조건이라
 * 앱 화면과 봇 목록이 어긋나지 않는다.
 */
export function visibleHabits(habits: HabitDoc[]): HabitDoc[] {
  return habits
    .filter((h) => h.active && !isHibernating(h))
    .sort((a, b) => a.order - b.order);
}

/** 웹앱 timeOfDay()와 같은 KST 구간. */
export function habitTimeOfDayKST(date: Date = new Date()): Exclude<HabitTimeOfDay, 'anytime'> {
  const h = new Date(date.getTime() + KST_OFFSET_H * 3600_000).getUTCHours();
  if (h >= 4 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

export function reminderFilterForHour(hour: number): HabitListFilter | null {
  if (hour === 9) return 'morning';
  if (hour === 13) return 'afternoon';
  if (hour === 19) return 'evening';
  if (hour === 21) return 'nightAnytime';
  return null;
}

export function habitMatchesFilter(habit: HabitDoc, filter: HabitListFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'nightAnytime') return habit.timeOfDay === 'night' || habit.timeOfDay === 'anytime';
  return habit.timeOfDay === filter;
}

export function hasHabitCheck(checks: Record<string, HabitCheckDoc>, habitId: string): boolean {
  return Object.prototype.hasOwnProperty.call(checks, habitId);
}

/** 웹앱 `useSaveHabitCheck` 와 동일한 달성 판정. */
export function isAchieved(habit: HabitDoc, score: number | null): boolean {
  if (score === null) return false;
  const threshold = habit.scoreMode === 'scaled' ? SCALED_ACHIEVE_THRESHOLD : habit.achieveThreshold;
  return score >= threshold;
}

/** 한 습관의 현재 상태를 나타내는 아이콘. */
export function statusIcon(check: HabitCheckDoc | undefined): string {
  if (!check) return '⭕';
  if (check.score === null) return '⏭';
  return check.achieved ? '✅' : '⚠️';
}

// 인라인 키보드가 지나치게 길어지지 않도록 한 화면에 보여줄 습관 수 상한.
export const HABIT_LIST_LIMIT = 12;

export interface HabitListView {
  date: string;
  habits: HabitDoc[];
  checks: Record<string, HabitCheckDoc>;
  streak: number;
  dayScore: number | null;
}

export function isValidHabitScore(habit: HabitDoc, score: number | null): boolean {
  if (score === null) return true;
  if (!Number.isInteger(score)) return false;
  return habit.scoreMode === 'scaled'
    ? score >= 1 && score <= 5
    : score === 0 || score === 1;
}

const FILTER_LABELS: Record<HabitListFilter, string> = {
  morning: '☀️ 아침',
  afternoon: '🥗 오후',
  evening: '🌆 저녁',
  night: '🌙 밤',
  anytime: '🕰 수시',
  nightAnytime: '🌙 밤·수시',
  all: '🌿 전체',
};

export function buildHabitListMessage(
  v: HabitListView,
  input?: Partial<HabitListContext>,
): { text: string; keyboard: InlineKeyboard } {
  const requested = normalizeHabitListContext(input);
  const scoped = v.habits.filter((h) => habitMatchesFilter(h, requested.filter));
  const pending = scoped.filter((h) => !hasHabitCheck(v.checks, h.id));
  const selected = requested.pendingOnly ? pending : scoped;
  const ordered = [...selected].sort((a, b) => {
    const aDone = hasHabitCheck(v.checks, a.id) ? 1 : 0;
    const bDone = hasHabitCheck(v.checks, b.id) ? 1 : 0;
    return aDone - bDone || a.order - b.order;
  });
  const totalPages = Math.max(1, Math.ceil(ordered.length / HABIT_LIST_LIMIT));
  const page = Math.min(requested.page, totalPages - 1);
  const context: HabitListContext = { ...requested, page };
  const shown = ordered.slice(page * HABIT_LIST_LIMIT, (page + 1) * HABIT_LIST_LIMIT);
  const done = v.habits.filter((h) => hasHabitCheck(v.checks, h.id)).length;
  const scopedDone = scoped.length - pending.length;

  const lines = [
    `🌱 <b>${formatDateLabel(v.date)}</b>${v.streak > 0 ? ` · 🔥 ${v.streak}일째` : ''}`,
    `${FILTER_LABELS[context.filter]} · ${context.pendingOnly ? `남은 습관 ${pending.length}개` : `기록 ${scopedDone}/${scoped.length}`}`,
    `오늘 전체 ${done}/${v.habits.length}${v.dayScore !== null ? ` · dayScore ${v.dayScore}` : ''}`,
  ];
  if (v.habits.length === 0) {
    lines.push('', '등록된 습관이 없어요. 앱에서 습관을 먼저 추가해 주세요.');
    return { text: lines.join('\n'), keyboard: [] };
  }

  if (scoped.length === 0) lines.push('', '이 시간대에 등록된 습관이 없어요.');
  else if (context.pendingOnly && pending.length === 0) lines.push('', '이 범위의 습관을 모두 기록했어요. 수고했어요.');
  if (totalPages > 1) lines.push('', `<i>${page + 1}/${totalPages} 페이지</i>`);

  const keyboard: InlineKeyboard = shown.map((h) => habitRow(h, v.checks[h.id], v.date, context));

  if (totalPages > 1) {
    const pager: InlineButton[] = [];
    if (page > 0) pager.push(listButton('◀ 이전', v.date, { ...context, page: page - 1 }));
    if (page < totalPages - 1) pager.push(listButton('다음 ▶', v.date, { ...context, page: page + 1 }));
    keyboard.push(pager);
  }

  if (context.pendingOnly && pending.length > 0) {
    keyboard.push([
      { text: '⏰ 30분 뒤', callback_data: encodeCallback({ ns: 't', action: 'snooze', date: v.date, filter: context.filter, minutes: 30 }) },
      { text: '⏰ 2시간 뒤', callback_data: encodeCallback({ ns: 't', action: 'snooze', date: v.date, filter: context.filter, minutes: 120 }) },
    ]);
    keyboard.push([{ text: '🌙 오늘 습관 알림 끝', callback_data: encodeCallback({ ns: 't', action: 'pause', date: v.date }) }]);
  }

  keyboard.push(...habitFilterKeyboard(v.date, context));

  return { text: lines.join('\n'), keyboard };
}

function habitRow(
  habit: HabitDoc,
  check: HabitCheckDoc | undefined,
  date: string,
  context: HabitListContext,
): InlineButton[] {
  const base = { date, habitId: habit.id, ...context };
  if (habit.scoreMode === 'binary' && !check) {
    return [
      { text: `✅ ${habit.title} 완료`, callback_data: encodeCallback({ ns: 't', action: 'save', score: 1, ...base }) },
      { text: '다른 기록', callback_data: encodeCallback({ ns: 't', action: 'pick', ...base }) },
    ];
  }
  if (habit.scoreMode === 'binary' && check?.achieved) {
    return [
      { text: `↩ ${habit.title} 완료 취소`, callback_data: encodeCallback({ ns: 't', action: 'clear', ...base }) },
      { text: '변경', callback_data: encodeCallback({ ns: 't', action: 'pick', ...base }) },
    ];
  }

  const score = !check ? (habit.scoreMode === 'scaled' ? '1~5점 선택' : '기록 선택')
    : check.score === null ? '건너뜀'
    : habit.scoreMode === 'scaled' ? `${check.score}점`
    : check.achieved ? '완료' : '미달성';
  return [{
    text: `${statusIcon(check)} ${habit.title} · ${score}`,
    callback_data: encodeCallback({ ns: 't', action: 'pick', ...base }),
  }];
}

function listButton(text: string, date: string, context: HabitListContext): InlineButton {
  return { text, callback_data: encodeCallback({ ns: 't', action: 'list', date, ...context }) };
}

function habitFilterKeyboard(date: string, context: HabitListContext): InlineKeyboard {
  const filterButton = (filter: HabitListFilter, text: string) => listButton(
    `${context.filter === filter || (context.filter === 'nightAnytime' && filter === 'night') ? '• ' : ''}${text}`,
    date,
    { ...context, filter, page: 0 },
  );
  return [
    [filterButton('morning', '아침'), filterButton('afternoon', '오후'), filterButton('evening', '저녁')],
    [filterButton('night', '밤'), filterButton('anytime', '수시'), filterButton('all', '전체')],
    [
      listButton(`${context.pendingOnly ? '• ' : ''}미완료만`, date, { ...context, pendingOnly: true, page: 0 }),
      listButton(`${!context.pendingOnly ? '• ' : ''}완료 포함`, date, { ...context, pendingOnly: false, page: 0 }),
      listButton('🔄', date, context),
    ],
  ];
}

export function buildScorePicker(
  habit: HabitDoc,
  date: string,
  check: HabitCheckDoc | undefined,
  input?: Partial<HabitListContext>,
): { text: string; keyboard: InlineKeyboard } {
  const context = normalizeHabitListContext(input);
  const cb = (score: number | null) =>
    encodeCallback({ ns: 't', action: 'save', date, habitId: habit.id, score, ...context });

  const rows: InlineKeyboard = habit.scoreMode === 'scaled'
    ? [[1, 2, 3, 4, 5].map((n) => ({ text: `${n}`, callback_data: cb(n) }))]
    : [[{ text: '✅ 달성', callback_data: cb(1) }, { text: '❌ 미달성', callback_data: cb(0) }]];

  const tail: InlineButton[] = [{ text: '⏭ 건너뛰기', callback_data: cb(null) }];
  if (check) {
    tail.push({ text: '🗑 기록 지우기', callback_data: encodeCallback({ ns: 't', action: 'clear', date, habitId: habit.id, ...context }) });
  }
  rows.push(tail);
  rows.push([{ text: '↩ 목록으로', callback_data: encodeCallback({ ns: 't', action: 'list', date, ...context }) }]);

  const lines = [`<b>${escapeHtml(habit.title)}</b>`];
  if (habit.description) lines.push(escapeHtml(habit.description));
  lines.push('', habit.scoreMode === 'scaled'
    ? `1 매우 부족 · 2 부족 · 3 보통 · 4 양호 · 5 우수\n${SCALED_ACHIEVE_THRESHOLD}점부터 달성이에요.`
    : '달성 여부를 골라주세요.');
  if (check) lines.push('', `현재 기록: ${check.score === null ? '건너뜀' : `${check.score}점`}`);

  return { text: lines.join('\n'), keyboard: rows };
}

// ── 회고 플로우 ─────────────────────────────────────────────────────────────
export type ReflectionStep =
  | 'resolution' | 'q_best' | 'q_regret' | 'q_tomorrow' | 'q_word'
  | 'satisfaction' | 'screenTime';

export interface ReflectionSession {
  steps: ReflectionStep[];
  stepIndex: number;
  date: string;
  answers: Record<string, string>;
  yesterdayResolution?: string;
  resolutionPracticed?: boolean;
  daySatisfaction?: number;
  screenTimeMinutes?: number;
}

/** 어제 회고에 '내일의 다짐'이 있으면 그 실천 여부를 먼저 묻는다 (회고 피드백 루프). */
export function buildReflectionSteps(yesterdayResolution?: string): ReflectionStep[] {
  const steps: ReflectionStep[] = [];
  if (yesterdayResolution) steps.push('resolution');
  steps.push('q_best', 'q_regret', 'q_tomorrow', 'q_word', 'satisfaction', 'screenTime');
  return steps;
}

export function newReflectionSession(date: string, yesterdayResolution?: string): ReflectionSession {
  return {
    steps: buildReflectionSteps(yesterdayResolution),
    stepIndex: 0,
    date,
    answers: {},
    yesterdayResolution,
  };
}

export function currentStep(s: ReflectionSession): ReflectionStep | null {
  return s.stepIndex < s.steps.length ? s.steps[s.stepIndex] : null;
}

const SKIP = encodeCallback({ ns: 'r', action: 'answer', value: 'skip' });
const CANCEL_ROW: InlineButton[] = [{ text: '✖ 그만두기', callback_data: encodeCallback({ ns: 'r', action: 'cancel' }) }];

/** 현재 단계에서 사용자에게 보낼 질문. */
export function reflectionPrompt(s: ReflectionSession): { text: string; keyboard: InlineKeyboard } {
  const step = currentStep(s);
  const n = s.stepIndex + 1;
  const total = s.steps.length;
  const head = `<i>회고 ${n}/${total}</i>\n\n`;

  if (step === 'resolution') {
    return {
      text: `${head}어제의 다짐이에요.\n\n“${escapeHtml(s.yesterdayResolution ?? '')}”\n\n오늘 실천했나요?`,
      keyboard: [
        [{ text: '네, 했어요', callback_data: encodeCallback({ ns: 'r', action: 'answer', value: 'yes' }) },
         { text: '아니요', callback_data: encodeCallback({ ns: 'r', action: 'answer', value: 'no' }) }],
        CANCEL_ROW,
      ],
    };
  }
  if (step === 'satisfaction') {
    const btn = (v: number) => ({ text: `${v}`, callback_data: encodeCallback({ ns: 'r', action: 'answer', value: `sat${v}` }) });
    return {
      text: `${head}오늘 하루를 얼마나 잘 살았다고 느끼나요? (1~10, 선택)`,
      keyboard: [
        [1, 2, 3, 4, 5].map(btn),
        [6, 7, 8, 9, 10].map(btn),
        [{ text: '건너뛰기', callback_data: SKIP }],
        CANCEL_ROW,
      ],
    };
  }
  if (step === 'screenTime') {
    return {
      text: `${head}오늘 스마트폰을 얼마나 썼나요? (선택)\n<code>2:30</code>, <code>2시간 30분</code>, <code>150</code>(분) 처럼 보내주세요.`,
      keyboard: [[{ text: '건너뛰기', callback_data: SKIP }], CANCEL_ROW],
    };
  }

  const q = DEFAULT_REFLECTION_QUESTIONS.find((x) => x.id === step);
  const text = `${head}<b>${escapeHtml(q?.text ?? '')}</b>\n<i>${escapeHtml(q?.placeholder ?? '')}</i>`;
  return {
    text,
    keyboard: q?.required ? [CANCEL_ROW] : [[{ text: '건너뛰기', callback_data: SKIP }], CANCEL_ROW],
  };
}

/**
 * '2:30' / '2시간 30분' / '2h30m' / '150' → 분. 해석할 수 없으면 null.
 * 숫자 하나만 오면 분으로 본다(회고 화면이 분 단위로 저장하므로).
 */
export function parseScreenTime(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\s*[:.]\s*(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(?:(\d{1,2})\s*(?:시간|h))?\s*(?:(\d{1,3})\s*(?:분|m))?$/i);
  if (m && (m[1] || m[2])) return (Number(m[1] ?? 0)) * 60 + Number(m[2] ?? 0);
  m = s.match(/^(\d{1,4})$/);
  if (m) return Number(m[1]);
  return null;
}

export interface ReflectionInputResult {
  session: ReflectionSession;
  /** 입력이 유효하지 않아 같은 단계를 다시 물어야 할 때의 안내. */
  error?: string;
  /** 모든 단계를 마쳐 저장해도 되는 상태. */
  done: boolean;
}

/**
 * 한 단계의 입력을 적용하고 다음 단계로 넘긴다.
 * `raw` 는 사용자가 보낸 평문이거나, 버튼 콜백 값('skip' | 'yes' | 'no' | 'satN').
 */
export function applyReflectionInput(s: ReflectionSession, raw: string): ReflectionInputResult {
  const step = currentStep(s);
  if (!step) return { session: s, done: true };

  const next = { ...s, answers: { ...s.answers } };
  const value = raw.trim();
  const skipped = value === 'skip';

  if (step === 'resolution') {
    if (value !== 'yes' && value !== 'no') {
      return { session: s, error: '버튼으로 골라주세요.', done: false };
    }
    next.resolutionPracticed = value === 'yes';
  } else if (step === 'satisfaction') {
    if (!skipped) {
      const m = value.match(/^sat(\d{1,2})$/) ?? value.match(/^(\d{1,2})$/);
      const v = m ? Number(m[1]) : NaN;
      if (!Number.isFinite(v) || v < 1 || v > 10) {
        return { session: s, error: '1~10 사이 숫자로 골라주세요.', done: false };
      }
      next.daySatisfaction = v;
    }
  } else if (step === 'screenTime') {
    if (!skipped) {
      const mins = parseScreenTime(value);
      if (mins === null || mins > 24 * 60) {
        return { session: s, error: '<code>2:30</code> 이나 <code>150</code>(분) 처럼 보내주세요.', done: false };
      }
      next.screenTimeMinutes = mins;
    }
  } else {
    const q = DEFAULT_REFLECTION_QUESTIONS.find((x) => x.id === step);
    if (skipped) {
      if (q?.required) return { session: s, error: '이 질문은 건너뛸 수 없어요.', done: false };
    } else {
      if (!value) return { session: s, error: '한 줄이라도 적어주세요.', done: false };
      next.answers[step] = value.slice(0, 1000);
    }
  }

  next.stepIndex = s.stepIndex + 1;
  return { session: next, done: next.stepIndex >= next.steps.length };
}

/** 저장 직후 사용자에게 보여줄 요약. */
export function reflectionSummary(s: ReflectionSession): string {
  const lines = [`📝 <b>${formatDateLabel(s.date)} 회고를 저장했어요.</b>`, ''];
  for (const q of DEFAULT_REFLECTION_QUESTIONS) {
    const a = s.answers[q.id];
    if (a) lines.push(`· ${escapeHtml(q.text)}\n  ${escapeHtml(a)}`);
  }
  if (s.daySatisfaction !== undefined) lines.push(`· 오늘 만족도: ${s.daySatisfaction}/10`);
  if (s.screenTimeMinutes !== undefined) {
    lines.push(`· 스마트폰: ${Math.floor(s.screenTimeMinutes / 60)}시간 ${s.screenTimeMinutes % 60}분`);
  }
  return lines.join('\n');
}

// ── 알림 설정 ───────────────────────────────────────────────────────────────
// UserSettingsDoc.notifications 중 봇에서 켜고 끌 수 있는 것들 (신앙 알림은 앱에서만).
export const NOTIF_KEYS = ['habitReminder', 'reflectionReminder', 'morningBrief', 'progressWeekly'] as const;
export type NotifKey = (typeof NOTIF_KEYS)[number];

export const NOTIF_LABELS: Record<NotifKey, string> = {
  habitReminder:      '습관 리마인더 (9·13·19·21시)',
  reflectionReminder: '저녁 회고 알림 (22시)',
  morningBrief:       '모닝 브리프 (6시)',
  progressWeekly:     '주간 진척 요약 (일 20시)',
};

export function isNotifKey(v: unknown): v is NotifKey {
  return typeof v === 'string' && (NOTIF_KEYS as readonly string[]).includes(v);
}

export function buildSettingsMessage(
  notif: Partial<Record<NotifKey, boolean>> | undefined,
  username: string | null,
): { text: string; keyboard: InlineKeyboard } {
  // 미설정은 on 으로 본다 — 서버 스케줄러들이 `=== false` 로만 끄기 때문.
  const on = (k: NotifKey) => notif?.[k] !== false;

  const text = [
    '⚙️ <b>알림 설정</b>',
    `연결된 계정: ${username ? `@${escapeHtml(username)}` : '연결됨'}`,
    '',
    '알림은 텔레그램으로만 발송돼요. 버튼을 눌러 켜고 끌 수 있어요.',
  ].join('\n');

  const keyboard: InlineKeyboard = NOTIF_KEYS.map((k) => [{
    text: `${on(k) ? '🔔' : '🔕'} ${NOTIF_LABELS[k]}`,
    callback_data: encodeCallback({ ns: 'n', action: 'toggle', key: k }),
  }]);

  return { text, keyboard };
}
