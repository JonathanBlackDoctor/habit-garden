/**
 * telegramWebhook — 텔레그램이 업데이트를 POST 하는 유일한 진입점.
 * 이 저장소의 첫 onRequest 함수다 (나머지는 onCall/pubsub/firestore 트리거).
 *
 * 공개 URL 이므로 신뢰 경계를 여기서 전부 세운다:
 *  1. X-Telegram-Bot-Api-Secret-Token 헤더 검증 (setWebhook 때 등록한 값)
 *  2. chatId → uid 연결 여부
 *  3. userProfiles.status === 'approved' 승인 게이트
 *  4. update_id 중복 처리 가드
 * 그리고 어떤 경우에도 200 을 돌려준다 — 비200 이면 텔레그램이 같은 업데이트를 계속 재전송한다.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { sendMessage, TelegramForbiddenError } from './api';
import type { TelegramUpdate } from './api';
import { isPrivateTelegramChat } from '../../../shared/lib/telegram';
import { getLinkByChatId, consumeLinkCode, linkAccount, claimUpdate, unlinkAccount } from './store';
import { handleMessage, handleCallback, parseCommand, type Session } from './handlers';

const db = admin.firestore();
const REGION = 'asia-northeast3';

const NEEDS_LINK = [
  '🌱 <b>습관 정원 봇</b>',
  '',
  '먼저 앱과 연결해야 해요.',
  '앱 → 더보기 → 알림 설정 → <b>텔레그램 연결</b> 에서 코드를 받아',
  '<code>/start 코드</code> 형식으로 보내주세요.',
].join('\n');

export const telegramWebhook = functions
  .region(REGION)
  .runWith({
    secrets: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'GEMINI_API_KEY'],
    timeoutSeconds: 120,
  })
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    const received = req.get('X-Telegram-Bot-Api-Secret-Token')?.trim();
    if (!expected || received !== expected) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      await route(req.body as TelegramUpdate);
    } catch (e) {
      // 여기서 500 을 내면 텔레그램이 무한 재전송한다. 로그만 남기고 200.
      console.error('telegramWebhook error:', e);
    }
    res.status(200).send('ok');
  });

async function route(update: TelegramUpdate): Promise<void> {
  const msg = update?.message;
  const query = update?.callback_query;
  const chat = msg?.chat ?? query?.message?.chat;
  if (!chat) return;

  const chatId = String(chat.id);
  const from = msg?.from ?? query?.from;
  if (from?.is_bot) return;

  // 그룹에 계정을 연결하면 다른 구성원도 버튼을 눌러 사용자의 습관·회고에 접근할 수 있다.
  // 봇은 개인 대화만 지원하며, private chat id와 발신자 id가 같은지도 함께 확인한다.
  if (!from || !isPrivateTelegramChat(chat, from.id)) {
    await safeSend(chatId, '보안을 위해 텔레그램 봇과의 개인 대화에서만 사용할 수 있어요.');
    return;
  }

  // 같은 업데이트가 두 번 처리되면 회고 단계가 두 칸씩 넘어간다.
  if (!(await claimUpdate(chatId, update.update_id))) {
    console.log(`skip duplicate update ${update.update_id} chat=${chatId}`);
    return;
  }

  const link = await getLinkByChatId(chatId);
  const parsed = msg?.text ? parseCommand(msg.text) : null;

  // `/start <코드>` 는 연결 전이든 후든(계정 갈아끼우기) 항상 여기서 처리한다.
  if (parsed?.command === 'start' && parsed.arg) {
    await handleStart(chatId, parsed.arg, from);
    return;
  }
  // 그 밖의 미연결 chat 은 안내만 하고 끝낸다.
  if (!link) {
    await safeSend(chatId, NEEDS_LINK);
    return;
  }

  // 저장된 연결 주체와 실제 발신자가 다르면 연결 정보를 신뢰하지 않는다.
  if (link.telegramUserId !== from.id) {
    await safeSend(chatId, '연결 정보를 확인할 수 없어요. 앱에서 연결을 해제한 뒤 다시 연결해 주세요.');
    return;
  }

  const profSnap = await db.doc(`userProfiles/${link.uid}`).get();
  if (!profSnap.exists || profSnap.data()?.status !== 'approved') {
    await safeSend(chatId, '아직 승인되지 않은 계정이에요. 관리자 승인 후 다시 시도해 주세요.');
    return;
  }

  const session: Session = { uid: link.uid, chatId, username: link.username ?? from?.username ?? null };

  try {
    if (query) await handleCallback(session, query);
    else if (msg) await handleMessage(session, msg);
  } catch (e) {
    if (e instanceof TelegramForbiddenError) {
      // 사용자가 봇을 차단했다 — 연결을 정리해 이후 알림이 헛돌지 않게 한다.
      console.log(`telegram blocked by user, unlinking chat=${chatId}`);
      await unlinkAccount({ chatId, uid: link.uid });
      return;
    }
    throw e;
  }
}

async function handleStart(
  chatId: string,
  code: string,
  from: { id: number; username?: string; first_name?: string } | undefined,
): Promise<void> {
  const result = await consumeLinkCode(code);
  if (!result.ok) {
    const reason = {
      unknown: '코드를 찾을 수 없어요.',
      expired: '코드가 만료됐어요.',
      used:    '이미 사용된 코드예요.',
    }[result.reason];
    await safeSend(chatId, `${reason} 앱에서 새 코드를 받아 다시 시도해 주세요.`);
    return;
  }

  const profSnap = await db.doc(`userProfiles/${result.uid}`).get();
  if (!profSnap.exists || profSnap.data()?.status !== 'approved') {
    await safeSend(chatId, '아직 승인되지 않은 계정이에요. 관리자 승인 후 다시 연결해 주세요.');
    return;
  }

  await linkAccount(result.uid, chatId, { id: from?.id ?? Number(chatId), username: from?.username, first_name: from?.first_name });
  await safeSend(chatId, [
    '✅ <b>연결됐어요.</b>',
    '',
    '이제 앱을 열지 않고도 여기서 습관을 체크할 수 있어요.',
    '리마인더·모닝 브리프도 이 대화로 옵니다.',
    '',
    '/today — 오늘 습관 체크',
    '/reflect — 저녁 회고',
    '/coach — AI 코치',
    '/settings — 알림 설정',
  ].join('\n'));
}

/** 미연결·오류 안내는 실패해도 웹훅 전체를 망치지 않게 삼킨다. */
async function safeSend(chatId: string, text: string): Promise<void> {
  await sendMessage(chatId, text).catch((e) => console.error(`sendMessage failed chat=${chatId}:`, e));
}
