/**
 * 봇 명령·버튼 처리. 웹훅이 인증(연결·승인)을 끝낸 뒤 여기로 넘긴다.
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserSettingsDoc } from '../../../shared/types/firestore';
import {
  plannerDateKST, habitTimeOfDayKST, parseCallback, escapeHtml, buildSettingsMessage,
  normalizeHabitListContext,
  type NotifKey, type HabitListContext,
} from '../../../shared/lib/telegram';
import { runAICoach, type Mode } from '../aiCoach';
import {
  sendMessage, editMessageText, answerCallbackQuery, BOT_COMMANDS, QUICK_REPLY_KEYBOARD,
} from './api';
import type { TelegramMessage, TelegramCallbackQuery } from './api';
import {
  renderHabitList, renderScorePicker, saveCheck, clearCheck, snoozeHabitChecks,
} from './habitCheck';
import { startReflection, handleReflectionInput, cancelReflection } from './reflection';
import { unlinkAccount } from './store';

const db = admin.firestore();

export interface Session {
  uid: string;
  chatId: string;
  username: string | null;
}

// 텔레그램 명령 메뉴는 영문만 허용하지만(-> api.BOT_COMMANDS), 한글로 치는 게 자연스러우니
// 평문 한글 키워드도 같은 명령으로 받아준다.
const KOREAN_ALIASES: Record<string, string> = {
  '오늘': 'today', '습관': 'today', '체크': 'today',
  '지금': 'now', '지금 체크': 'now', '✅ 지금 체크': 'now',
  '남은 습관': 'today', '⏳ 남은 습관': 'today',
  '회고': 'reflect',
  '📝 회고': 'reflect',
  '코치': 'coach',
  '주간': 'weekly',
  '설정': 'settings',
  '⚙️ 설정': 'settings',
  '메뉴': 'menu',
  '취소': 'cancel',
  '도움말': 'help',
};

const HELP = [
  '🌱 <b>습관 정원 봇</b>',
  '앱을 열지 않고도 습관 체크·회고·코치를 쓸 수 있어요.',
  '',
  ...BOT_COMMANDS.map((c) => `/${c.command} — ${c.description}`),
  '',
  '<i>아래 빠른 메뉴와 시간대 버튼으로 입력 없이 사용할 수 있어요.</i>',
].join('\n');

/** '/today@botname arg' → { command: 'today', arg: 'arg' } */
export function parseCommand(text: string): { command: string; arg: string } | null {
  const trimmed = text.trim();
  const m = trimmed.match(/^\/([A-Za-z0-9_]+)(?:@\S+)?\s*(.*)$/s);
  if (m) return { command: m[1].toLowerCase(), arg: m[2].trim() };

  const alias = KOREAN_ALIASES[trimmed];
  return alias ? { command: alias, arg: '' } : null;
}

// ── 메시지 ──────────────────────────────────────────────────────────────────
export async function handleMessage(s: Session, msg: TelegramMessage): Promise<void> {
  const text = (msg.text ?? '').trim();
  if (!text) return;

  const parsed = parseCommand(text);

  // 회고 진행 중이면 명령이 아닌 평문은 전부 답변으로 본다.
  if (!parsed && await handleReflectionInput(s.uid, s.chatId, text)) return;

  if (!parsed) {
    await sendMessage(s.chatId, ['무슨 뜻인지 모르겠어요.', '', HELP].join('\n'));
    return;
  }

  switch (parsed.command) {
    case 'start':
    case 'help':
    case 'menu':
      await sendMessage(s.chatId, HELP, undefined, QUICK_REPLY_KEYBOARD);
      return;

    case 'now':
      await sendToday(s, { filter: habitTimeOfDayKST(), pendingOnly: true, page: 0 });
      return;

    case 'today':
      await sendToday(s, { filter: 'all', pendingOnly: true, page: 0 });
      return;

    case 'reflect':
      await startReflection(s.uid, s.chatId, plannerDateKST());
      return;

    case 'cancel':
      if (!await cancelReflection(s.uid, s.chatId)) {
        await sendMessage(s.chatId, '취소할 작업이 없어요.');
      }
      return;

    case 'coach':
      await sendCoach(s, 'daily');
      return;

    case 'weekly':
      await sendCoach(s, 'weekly');
      return;

    case 'settings':
      await sendSettings(s);
      return;

    case 'unlink':
      await unlinkAccount({ uid: s.uid, chatId: s.chatId });
      await sendMessage(s.chatId, '연결을 해제했어요. 알림은 다시 앱 푸시로 갑니다.\n다시 연결하려면 앱에서 코드를 받아 <code>/start 코드</code> 를 보내주세요.');
      return;

    default:
      // 회고 중이라면 '/'로 시작하는 답변도 그대로 답으로 받아준다.
      if (await handleReflectionInput(s.uid, s.chatId, text)) return;
      await sendMessage(s.chatId, ['모르는 명령이에요.', '', HELP].join('\n'));
  }
}

async function sendToday(s: Session, context: HabitListContext): Promise<void> {
  const date = plannerDateKST();
  const { text, keyboard } = await renderHabitList(s.uid, date, context);
  await sendMessage(s.chatId, text, keyboard);
}

async function sendSettings(s: Session): Promise<void> {
  const snap = await db.doc(`users/${s.uid}/settings/main`).get();
  const notif = (snap.data() as UserSettingsDoc | undefined)?.notifications;
  const { text, keyboard } = buildSettingsMessage(notif, s.username);
  await sendMessage(s.chatId, text, keyboard);
}

/**
 * Gemini 응답은 수 초~수십 초 걸린다. 먼저 자리를 잡는 메시지를 보내고
 * 결과가 오면 그 메시지를 갈아끼워, 사용자가 멈춘 것처럼 느끼지 않게 한다.
 */
async function sendCoach(s: Session, mode: Mode): Promise<void> {
  const placeholder = await sendMessage(s.chatId, '🤔 데이터를 보는 중이에요…');
  try {
    const r = await runAICoach(s.uid, mode);
    const text = mode === 'weekly'
      ? [
          '📊 <b>이번 주 인사이트</b>', '',
          `<b>잘한 점</b>\n${escapeHtml(String(r.strengths ?? ''))}`, '',
          `<b>패턴</b>\n${escapeHtml(String(r.pattern ?? ''))}`, '',
          `<b>다음 주 제안</b>\n${escapeHtml(String(r.recommendation ?? ''))}`,
        ].join('\n')
      : `🧭 <b>오늘의 코치</b>\n\n${escapeHtml(String(r.message ?? ''))}`;
    await editMessageText(s.chatId, placeholder.message_id, text);
  } catch (e) {
    // geminiUtil 이 할당량 초과에 한국어 안내 문구를 담아 던진다 — 그대로 보여준다.
    const msg = (e as { message?: string })?.message ?? '';
    console.error(`aiCoach failed uid=${s.uid} mode=${mode}:`, e);
    await editMessageText(
      s.chatId,
      placeholder.message_id,
      msg.includes('AI') ? escapeHtml(msg) : '지금은 코치 응답을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
  }
}

// ── 버튼(callback_query) ────────────────────────────────────────────────────
export async function handleCallback(s: Session, q: TelegramCallbackQuery): Promise<void> {
  const cb = parseCallback(q.data);
  const messageId = q.message?.message_id;

  if (!cb) {
    await answerCallbackQuery(q.id, '더 이상 쓸 수 없는 버튼이에요.');
    return;
  }

  if (cb.ns === 't') {
    const today = plannerDateKST();
    // 어제 온 알림의 버튼을 오늘 누르면 엉뚱한 날짜에 기록된다. 봇은 오늘만 다룬다.
    if (cb.date !== today) {
      await answerCallbackQuery(q.id, '지난 날짜의 알림이에요. /today 로 새로 열어주세요.', true);
      return;
    }

    if (cb.action === 'snooze') {
      const count = await snoozeHabitChecks(s.uid, cb.date, cb.filter, cb.minutes);
      await answerCallbackQuery(
        q.id,
        count > 0 ? `${count}개를 ${cb.minutes === 30 ? '30분' : '2시간'} 뒤 다시 알려드릴게요.` : '남은 습관이 없어요.',
      );
      return;
    }

    if (cb.action === 'pause') {
      await db.doc(`users/${s.uid}/progress/main`).set({
        _todayHabitReminderPause: { date: cb.date },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      await answerCallbackQuery(q.id, '오늘 습관 알림을 멈췄어요.');
      return;
    }

    const context = normalizeHabitListContext(cb);

    if (cb.action === 'pick') {
      const view = await renderScorePicker(s.uid, cb.date, cb.habitId, context);
      await answerCallbackQuery(q.id);
      if (!view) { await sendMessage(s.chatId, '없는 습관이에요.'); return; }
      if (messageId) await editMessageText(s.chatId, messageId, view.text, view.keyboard);
      return;
    }

    if (cb.action === 'save' || cb.action === 'clear') {
      let toast = '기록 지움';
      if (cb.action === 'save') {
        const r = await saveCheck(s.uid, cb.date, cb.habitId, cb.score);
        toast = r.toast;
      } else {
        await clearCheck(s.uid, cb.date, cb.habitId);
      }
      await answerCallbackQuery(q.id, toast);
      const list = await renderHabitList(s.uid, cb.date, context);
      if (messageId) await editMessageText(s.chatId, messageId, list.text, list.keyboard);
      return;
    }

    // list — 새로고침
    await answerCallbackQuery(q.id);
    const list = await renderHabitList(s.uid, cb.date, context);
    if (messageId) await editMessageText(s.chatId, messageId, list.text, list.keyboard);
    return;
  }

  if (cb.ns === 'r') {
    if (cb.action === 'start') {
      await answerCallbackQuery(q.id);
      await startReflection(s.uid, s.chatId, plannerDateKST());
      return;
    }
    if (cb.action === 'cancel') {
      await answerCallbackQuery(q.id);
      if (!await cancelReflection(s.uid, s.chatId)) {
        await sendMessage(s.chatId, '취소할 작업이 없어요.');
      }
      return;
    }
    await answerCallbackQuery(q.id);
    if (!await handleReflectionInput(s.uid, s.chatId, cb.value)) {
      await sendMessage(s.chatId, '진행 중인 회고가 없어요. /reflect 로 시작해 주세요.');
    }
    return;
  }

  // 알림 on/off 토글
  await toggleNotification(s, cb.key, q.id, messageId);
}

async function toggleNotification(
  s: Session,
  key: NotifKey,
  queryId: string,
  messageId: number | undefined,
): Promise<void> {
  const ref = db.doc(`users/${s.uid}/settings/main`);
  const snap = await ref.get();
  const notif = { ...((snap.data() as UserSettingsDoc | undefined)?.notifications ?? {}) };
  const next = notif[key] === false;          // 미설정(=on) 이면 끄고, 꺼져 있으면 켠다
  notif[key] = next;

  await ref.set({ notifications: { [key]: next }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await answerCallbackQuery(queryId, next ? '알림 켬' : '알림 끔');

  const { text, keyboard } = buildSettingsMessage(notif, s.username);
  if (messageId) await editMessageText(s.chatId, messageId, text, keyboard);
}
