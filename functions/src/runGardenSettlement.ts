/**
 * runGardenSettlementNow — '지금 정산 실행' callable.
 *
 * 04:00 KST 스케줄 정산(dailyReset→processDailyGarden)이 누락/지연됐을 때,
 * 사용자가 자기 정원의 오늘 게임일 정산을 즉시 돌려 '어젯밤 정원 소식' 요약을 바로 만든다.
 * processDailyGarden 의 멱등성 가드(lastDailyGardenDate)가 같은 게임일 재실행을 막으므로
 * 여러 번 눌러도 포인트·생기·성장이 중복 적용되지 않는다(이미 정산된 경우 기존 요약을 그대로 반환).
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { format, subDays, parseISO } from 'date-fns';
import { processDailyGarden } from './gardenAutogrow';
import type { ProgressDoc } from '../../shared/types/firestore';

const db = admin.firestore();
const REGION = 'asia-northeast3';

/** 현재 게임일(YYYY-MM-DD, 04:00 KST 경계) — gardenAutogrow.gameDayKST 와 동일 알고리즘. */
function gameDayKST(): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const RESET_HOUR_MS = 4 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const nowKST = Date.now() + KST_OFFSET_MS;
  const ms = nowKST % DAY_MS;
  const adj = ms >= RESET_HOUR_MS ? nowKST : nowKST - DAY_MS;
  const d = new Date(adj);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export const runGardenSettlementNow = functions
  .region(REGION)
  .https
  .onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = context.auth.uid;
    const profSnap = await db.doc(`userProfiles/${uid}`).get();
    if (!profSnap.exists || profSnap.data()?.status !== 'approved') {
      throw new functions.https.HttpsError('permission-denied', 'Not approved');
    }

    const gameDay = gameDayKST();
    const yesterday = format(subDays(parseISO(gameDay), 1), 'yyyy-MM-dd');

    // 어제 성공 여부 (scored 체크의 60% 이상 달성) — dailyReset 의 스트릭 정산과 동일 기준.
    const checks = await db.collection(`users/${uid}/days/${yesterday}/habitChecks`).get();
    const scored = checks.docs.filter((d) => d.data().score !== null);
    const total = scored.length;
    const achieved = scored.filter((d) => d.data().achieved).length;
    const success = total > 0 && achieved / total >= 0.6;

    // 보호된 날(휴가/freeze 토큰) — 소모 없이 평가만 (정원 시듦·죽음 보호).
    const prog = (await db.doc(`users/${uid}/progress/main`).get()).data() as ProgressDoc | undefined;
    const protectedDay =
      (!!prog?.vacationUntil && prog.vacationUntil >= yesterday) ||
      (prog?.freezeProtectedDate === yesterday);

    const alreadySettled = prog?.gardenStats?.lastDailyGardenDate === gameDay;
    await processDailyGarden(uid, success, protectedDay);

    const after = (await db.doc(`users/${uid}/progress/main`).get()).data() as ProgressDoc | undefined;
    const recap = after?.gardenStats?.lastDailyRecap ?? null;
    const recapIsToday = recap?.gameDay === gameDay;

    return {
      ran: !alreadySettled,           // 이번 호출이 실제로 정산을 돌렸는지 (false = 이미 오늘 정산됨)
      gameDay,
      yesterday,
      success,
      protectedDay,
      hasRecap: recapIsToday,         // 오늘 게임일 요약이 만들어졌는지
      recap: recapIsToday ? recap : null,
    };
  });
