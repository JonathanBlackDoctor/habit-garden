/**
 * 앱에서 호출하는 텔레그램 연동 callable 들.
 *  - createTelegramLinkCode: 1회용 연결 코드 발급 (승인 사용자)
 *  - unlinkTelegram:         연결 해제
 *
 * 연결 문서 자체는 클라이언트가 쓸 수 없다(firestore.rules). 반드시 이 경로로만 바뀐다.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { TELEGRAM_LINK_CODE_TTL_MIN } from '../../../shared/types/firestore';
import { issueLinkCode, unlinkAccount, getChatIdForUid } from './store';
import { sendMessage } from './api';

const db = admin.firestore();
const REGION = 'asia-northeast3';

async function requireApproved(context: functions.https.CallableContext): Promise<string> {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  }
  const uid = context.auth.uid;
  const snap = await db.doc(`userProfiles/${uid}`).get();
  if (!snap.exists || snap.data()?.status !== 'approved') {
    throw new functions.https.HttpsError('permission-denied', 'Not approved');
  }
  return uid;
}

export const createTelegramLinkCode = functions
  .region(REGION)
  .https.onCall(async (_data, context) => {
    const uid = await requireApproved(context);
    const { code, expiresAtMs } = await issueLinkCode(uid);
    return { code, expiresAtMs, ttlMinutes: TELEGRAM_LINK_CODE_TTL_MIN };
  });

export const unlinkTelegram = functions
  .region(REGION)
  .runWith({ secrets: ['TELEGRAM_BOT_TOKEN'] })
  .https.onCall(async (_data, context) => {
    const uid = await requireApproved(context);
    const chatId = await getChatIdForUid(uid);
    const removed = await unlinkAccount({ uid });

    // 봇 쪽에도 상태를 알려준다. 실패해도 해제 자체는 이미 끝났다.
    if (chatId) {
      await sendMessage(chatId, '앱에서 연결을 해제했어요. 알림은 다시 앱 푸시로 갑니다.')
        .catch((e) => console.error('unlink notice failed:', e));
    }
    return { ok: removed };
  });
