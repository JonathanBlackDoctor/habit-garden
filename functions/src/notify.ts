/**
 * sendPush — 모든 스케줄드 알림이 공유하는 FCM 발송 헬퍼.
 *  1) data-only 멀티캐스트 발송 (표시는 서비스워커가 전담)
 *  2) 무효 토큰 자동 정리 — 등록 해지/잘못된 토큰은 Firestore 에서 제거 (기능 #1)
 *  3) 전달 트래킹 — 일자·타입별 sent/failed 카운트 집계 (기능 #7)
 *
 * 호출부는 토큰 문자열 대신 notifications 컬렉션의 문서 스냅샷을 그대로 넘긴다
 * (무효 토큰 삭제를 위해 문서 ref 가 필요).
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { NotificationTokenDoc, NotificationType } from '../../shared/types/firestore';

const db = admin.firestore();
const KST = 'Asia/Seoul';

// 더 이상 유효하지 않아 즉시 삭제해도 되는 토큰 에러 코드.
// (일시적 오류인 unavailable/internal 등은 보존해 다음 발송에서 재시도)
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

type TokenDocSnap = FirebaseFirestore.QueryDocumentSnapshot;

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

  // (2) 전달 트래킹 — 일자·타입별 집계
  const date = format(toZonedTime(new Date(), KST), 'yyyy-MM-dd');
  await db.doc(`users/${uid}/notifStats/${date}`).set({
    date,
    sent:   { [opts.type]: FieldValue.increment(resp.successCount) },
    failed: { [opts.type]: FieldValue.increment(resp.failureCount) },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch((e) => console.error(`notifStats write error uid=${uid}:`, e));
}
