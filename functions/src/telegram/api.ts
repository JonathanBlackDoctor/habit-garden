/**
 * 텔레그램 Bot API 얇은 클라이언트.
 * Node 20 전역 fetch 를 쓰므로 새 의존성이 없다.
 *
 * 모든 메시지는 parse_mode:'HTML' 로 보낸다. 사용자 데이터(습관 제목·회고 답변)는
 * 호출부에서 shared/lib/telegram 의 escapeHtml 을 통과시켜야 한다.
 */
import type { InlineKeyboard } from '../../../shared/lib/telegram';

// 기본값은 실제 텔레그램. 에뮬레이터 통합 테스트에서만 로컬 목 서버로 돌린다.
const API_BASE = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number | string; type?: string };
  from?: TelegramUser;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/** 사용자가 봇을 차단했거나 대화를 지운 경우 — 연결 정보를 정리해야 한다. */
export class TelegramForbiddenError extends Error {}

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN not set');
  return t;
}

async function call<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string; error_code?: number };
  if (!json.ok) {
    if (json.error_code === 403) throw new TelegramForbiddenError(json.description ?? 'forbidden');
    throw new Error(`telegram ${method} failed (${json.error_code}): ${json.description}`);
  }
  return json.result as T;
}

const markup = (keyboard?: InlineKeyboard) =>
  keyboard && keyboard.length > 0 ? { reply_markup: { inline_keyboard: keyboard } } : {};

export function sendMessage(
  chatId: string | number,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<TelegramMessage> {
  return call<TelegramMessage>('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...markup(keyboard),
  });
}

/**
 * 메시지를 제자리에서 갈아끼운다. 습관 목록↔점수 선택을 한 메시지로 오가게 해
 * 대화창이 지저분해지지 않게 하는 것이 봇 UX 의 핵심이다.
 * 내용이 같아 텔레그램이 거절하는 'message is not modified' 는 정상 흐름이라 삼킨다.
 */
export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  try {
    await call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...markup(keyboard),
    });
  } catch (e) {
    if (/message is not modified/i.test(String((e as Error).message))) return;
    throw e;
  }
}

/**
 * 콜백 버튼의 로딩 스피너를 멈춘다. 텔레그램은 응답이 없으면 클라이언트에 계속
 * 로딩을 표시하므로, 모든 callback_query 는 결과와 무관하게 한 번 응답해야 한다.
 */
export async function answerCallbackQuery(
  id: string,
  text?: string,
  showAlert = false,
): Promise<void> {
  await call('answerCallbackQuery', { callback_query_id: id, text, show_alert: showAlert }).catch((e) => {
    console.error('answerCallbackQuery failed:', e);
  });
}

/** 텔레그램 명령 이름은 [a-z0-9_]{1,32} 만 허용 — 한글 명령은 메뉴에 등록할 수 없다. */
export const BOT_COMMANDS: Array<{ command: string; description: string }> = [
  { command: 'today',    description: '오늘 습관 체크하기' },
  { command: 'reflect',  description: '저녁 회고 쓰기' },
  { command: 'coach',    description: 'AI 코치 한마디' },
  { command: 'weekly',   description: '이번 주 인사이트' },
  { command: 'settings', description: '알림·연결 상태 보기' },
  { command: 'cancel',   description: '작성 중인 회고 취소' },
  { command: 'unlink',   description: '계정 연결 해제' },
  { command: 'help',     description: '사용법 보기' },
];

export function setMyCommands(): Promise<unknown> {
  return call('setMyCommands', { commands: BOT_COMMANDS, language_code: 'ko' });
}

export function setWebhook(url: string, secret: string): Promise<unknown> {
  return call('setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
}

export function getWebhookInfo(): Promise<Record<string, unknown>> {
  return call('getWebhookInfo', {});
}

export function getMe(): Promise<TelegramUser> {
  return call<TelegramUser>('getMe', {});
}
