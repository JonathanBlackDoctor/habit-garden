/**
 * 알림 발송 공통 계층.
 *
 * notifyUser 가 채널을 고른다 — 텔레그램이 연결돼 있으면 텔레그램으로만 보내고
 * (사용자 선택: 웹푸시 완전 대체), 아니면 기존 FCM 경로를 쓴다.
 *
 * sendPush(FCM) 는 그대로 유지한다:
 *  1) data-only 멀티캐스트 발송 (표시는 서비스워커가 전담)
 *  2) 무효 토큰 자동 정리 — 등록 해지/잘못된 토큰은 Firestore 에서 제거
 *  3) 전달 트래킹 — 일자·타입별 sent/failed 카운트 집계
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { NotificationTokenDoc, NotificationType } from '../../shared/types/firestore';
import type { InlineKeyboard } from '../../shared/lib/telegram';
import { getChatIdForUid, unlinkAccount } from './telegram/store';
import { sendMessage, TelegramForbiddenError } from './telegram/api';

const db = admin.firestore();
const KST = 'Asia/Seoul';

// 더 이상 유효하지 않아 즉시 삭제해도 되는 토큰 에러 코드.
// (일시적 오류인 unavailable/internal 등은 보존해 다음 발송에서 재시도)
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

type TokenDocSnap = FirebaseFirestore.QueryDocumentSnapshot;

export interface NotifyOptions {
  link: string;
  type: NotificationType;
  urgency?: 'high' | 'normal';
  /**
   * 텔레그램으로 갈 때의 본문·버튼. 없으면 data.title/body 로 만든다.
   * 습관 리마인더처럼 그 자리에서 체크할 수 있는 알림은 여기에 키보드를 넘긴다.
   */
  telegram?: { text?: string; keyboard?: InlineKeyboard };
}

/**
 * 사용자에게 알림 하나를 보낸다. 채널 선택·토큰 조회·전달 집계를 모두 여기서 한다.
 * (호출부가 토큰을 미리 조회하던 시절엔 FCM 토큰이 없는 텔레그램 전용 사용자가
 *  알림을 통째로 놓쳤다 — 그래서 조회를 이 안으로 들여왔다.)
 */
export async function notifyUser(
  uid: string,
  data: Record<string, string>,
  opts: NotifyOptions,
): Promise<void> {
  const chatId = await getChatIdForUid(uid);
  if (chatId) {
    await sendTelegram(uid, chatId, data, opts);
    return;
  }

  const tokenSnap = await db.collection(`users/${uid}/notifications`).get();
  if (tokenSnap.empty) return;
  await sendPush(uid, tokenSnap.docs, data, opts);
}

async function sendTelegram(
  uid: string,
  chatId: string,
  data: Record<string, string>,
  opts: NotifyOptions,
): Promise<void> {
  const fallback = [data.title, data.body].filter(Boolean).join('\n');
  const text = opts.telegram?.text ?? fallback;
  if (!text) return;

  try {
    await sendMessage(chatId, text, opts.telegram?.keyboard);
    await trackDelivery(uid, opts.type, 1, 0);
  } catch (e) {
    if (e instanceof TelegramForbiddenError) {
      // 사용자가 봇을 차단했다 — 연결을 지워 다음부터는 FCM 으로 돌아간다.
      console.log(`telegram blocked, unlinking uid=${uid}`);
      await unlinkAccount({ uid, chatId });
      return;
    }
    console.error(`telegram notify failed uid=${uid} type=${opts.type}:`, e);
    await trackDelivery(uid, opts.type, 0, 1);
  }
}

export async function sendPush(
  uid: string,
  tokenDocs: TokenDocSnap[],
  data: Record<string, string>,
  opts: { link: string; type: NotificationType; urgency?: 'high' | 'normal' },
): Promise<void> {
  const entries = tokenDocs
    .map((d) => ({ ref: d.ref, token: (d.data() as NotificationTokenDoc).token }))
    .filter((e) => !!e.token);
  if (entries.length === 0) return;

  let resp: admin.messaging.BatchResponse;
  try {
    resp = await admin.messaging().sendEachForMulticast({
      tokens: entries.map((e) => e.token),
      // data-only 페이로드. action(=타입)·link 는 헬퍼가 일관되게 채운다.
      data: { ...data, action: opts.type, link: opts.link },
      webpush: {
        fcmOptions: { link: opts.link },
        headers: { Urgency: opts.urgency ?? 'high' },
      },
    });
  } catch (e) {
    console.error(`sendPush multicast error uid=${uid} type=${opts.type}:`, e);
    return;
  }

  // (1) 무효 토큰 정리
  const dead: FirebaseFirestore.DocumentReference[] = [];
  resp.responses.forEach((r, i) => {
    if (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code)) {
      dead.push(entries[i].ref);
    }
  });
  if (dead.length > 0) {
    await Promise.all(dead.map((ref) => ref.delete().catch(() => undefined)));
    console.log(`sendPush cleaned ${dead.length} dead token(s) uid=${uid} type=${opts.type}`);
  }

  // (2) 전달 트래킹
  await trackDelivery(uid, opts.type, resp.successCount, resp.failureCount);
}

/** 일자·타입별 발송 집계 — 앱의 알림 통계 카드가 채널과 무관하게 이 문서를 읽는다. */
async function trackDelivery(
  uid: string,
  type: NotificationType,
  sent: number,
  failed: number,
): Promise<void> {
  const date = format(toZonedTime(new Date(), KST), 'yyyy-MM-dd');
  await db.doc(`users/${uid}/notifStats/${date}`).set({
    date,
    sent:   { [type]: FieldValue.increment(sent) },
    failed: { [type]: FieldValue.increment(failed) },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch((e) => console.error(`notifStats write error uid=${uid}:`, e));
}
