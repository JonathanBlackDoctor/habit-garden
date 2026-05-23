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
import { processDailyGarden } from './gardenAutogrow';

const db = admin.firestore();
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
    const today     = todayKST();
    const yesterday = yesterdayKST();

    // 승인된 사용자만 순회
    const profilesSnap = await db.collection('userProfiles').where('status', '==', 'approved').get();
    for (const profileDoc of profilesSnap.docs) {
      const uid = profileDoc.id;
      try {
        const success = await processUserDay(uid, today, yesterday);
        await processDailyGarden(uid, success);  // 정원 트레잇·생기·시들기·보너스 시드
      } catch (e) {
        console.error(`dailyReset failed for uid=${uid}:`, e);
      }
    }

    console.log(`dailyReset complete: today=${today}, yesterday=${yesterday}, users=${profilesSnap.size}`);
  });

async function processUserDay(uid: string, today: string, yesterday: string): Promise<boolean> {
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
  let success = false;
  if (ydaySnap.exists) {
    const checks = await db
      .collection(`users/${uid}/days/${yesterday}/habitChecks`)
      .get();

    const total    = checks.size;
    const achieved = checks.docs.filter((d) => d.data().achieved).length;
    success  = total > 0 && achieved / total >= 0.6;

    if (!success) {
      const progressRef = db.doc(`users/${uid}/progress/main`);
      const pSnap = await progressRef.get();
      const current = pSnap.exists ? (pSnap.data()?.globalStreak ?? 0) : 0;
      if (current > 0) {
        // 스트릭 보호 (휴가/아픔/그레이스) 적용 — 보호 시 리셋하지 않음
        const protectedDay = await tryConsumeStreakProtection(uid, yesterday, pSnap.data());
        if (!protectedDay) {
          await progressRef.set({
            globalStreak: 0,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
    }
  }
  return success;
}

/**
 * 어제(date)가 성공일이 아닐 때 스트릭을 끊지 않고 보호할 수 있는지 판단·소모.
 *  1) vacationUntil 이 date 이상이면 보호 (소모 없음 — 휴가 기간)
 *  2) 주간 그레이스(주 1회) 미사용이면 소모 후 보호
 * 보호되면 true 반환 → 호출부에서 globalStreak 리셋 생략.
 */
async function tryConsumeStreakProtection(
  uid: string,
  date: string,
  prog: FirebaseFirestore.DocumentData | undefined,
): Promise<boolean> {
  if (!prog) return false;
  const progressRef = db.doc(`users/${uid}/progress/main`);

  // 1) 휴가/아픔 모드 — vacationUntil 이 보호 대상일 이상
  if (prog.vacationUntil && prog.vacationUntil >= date) {
    return true;
  }

  // 2) 주간 그레이스 (주 1회)
  const weekStart = getWeekStart(date);
  const grace = prog.graceUsed;
  const usedThisWeek = grace && grace.weekStart === weekStart ? (grace.daysUsed ?? 0) : 0;
  if (usedThisWeek < 1) {
    await progressRef.set({
      graceUsed: { weekStart, daysUsed: usedThisWeek + 1 },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  }

  return false;
}

// 주의 시작(월요일) 'YYYY-MM-DD' 반환
function getWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();             // 0=일 … 6=토
  const diff = day === 0 ? -6 : 1 - day; // 월요일로 보정
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
