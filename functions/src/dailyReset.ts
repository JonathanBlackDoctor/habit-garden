/**
 * dailyReset — 매일 04:00 KST 실행
 *  1. 오늘 DayDoc 생성 (없으면)
 *  2. 어제 DayDoc finalized = true
 *  3. 어제 globalStreak 정산 (성공 못한 날이면 리셋)
 *  4. AI 피드백 생성 (generateFeedback 호출)
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { subDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const db = admin.firestore();
const ALLOWED_UID = 'XMgQWlM1wtM62hIheTH4sKGDNuC2';
const KST = 'Asia/Seoul';
const REGION = 'asia-northeast3';

function todayKST(): string {
  const now = toZonedTime(new Date(), KST);
  return format(now, 'yyyy-MM-dd');
}

function yesterdayKST(): string {
  const now = toZonedTime(new Date(), KST);
  return format(subDays(now, 1), 'yyyy-MM-dd');
}

export const dailyReset = functions
  .region(REGION)
  .pubsub
  .schedule('0 4 * * *')            // 04:00 UTC+9 → 04:00 KST (Firebase uses UTC, adjust: 0 19 * * * for UTC-5hr offset)
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const uid       = ALLOWED_UID;
    const today     = todayKST();
    const yesterday = yesterdayKST();

    // 1. 오늘 DayDoc 생성
    const todayRef = db.doc(`users/${uid}/days/${today}`);
    const todaySnap = await todayRef.get();
    if (!todaySnap.exists) {
      await todayRef.set({
        date:      today,
        condition: {},
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // 2. 어제 finalize
    const ydayRef  = db.doc(`users/${uid}/days/${yesterday}`);
    const ydaySnap = await ydayRef.get();
    if (ydaySnap.exists && !ydaySnap.data()?.finalized) {
      await ydayRef.update({ finalized: true, updatedAt: FieldValue.serverTimestamp() });
    }

    // 3. 스트릭 정산 — 어제 성공 못 했으면 globalStreak 리셋
    if (ydaySnap.exists) {
      const checks = await db
        .collection(`users/${uid}/days/${yesterday}/habitChecks`)
        .get();

      const total    = checks.size;
      const achieved = checks.docs.filter((d) => d.data().achieved).length;
      const success  = total > 0 && achieved / total >= 0.6;

      if (!success) {
        const progressRef = db.doc(`users/${uid}/progress/main`);
        const pSnap = await progressRef.get();
        const current = pSnap.exists ? (pSnap.data()?.globalStreak ?? 0) : 0;
        if (current > 0) {
          await progressRef.set({
            globalStreak: 0,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
    }

    console.log(`dailyReset complete: today=${today}, yesterday=${yesterday}`);
  });
