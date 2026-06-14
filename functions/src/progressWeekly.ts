/**
 * progressWeekly — 매주 일요일 20:00 KST.
 * 진척 화면을 하단 탭에서 '더보기'로 옮긴 뒤, 한 주의 성과(평균 점수·스트릭·달성한 날)를
 * 주 1회 푸시로 환기해 사용자가 진척 현황을 다시 들여다보도록 유도한다.
 *  1. 지난 7일 dayScore 집계 + 현재 스트릭/레벨 수집
 *  2. 활동이 없으면 건너뜀 (스팸 방지)
 *  3. 규칙 기반 한 줄 요약으로 FCM 푸시 발송 (link → 진척 화면)
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { format, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { DayDoc, ProgressDoc, NotificationTokenDoc } from '../../shared/types/firestore';

const db = admin.firestore();
const REGION = 'asia-northeast3';
const KST = 'Asia/Seoul';

export const progressWeekly = functions
  .region(REGION)
  .pubsub
  .schedule('0 20 * * 0')          // 일요일 20:00 KST
  .timeZone(KST)
  .onRun(async () => {
    const now = toZonedTime(new Date(), KST);
    const recentDates: string[] = [];
    for (let i = 1; i <= 7; i++) recentDates.push(format(subDays(now, i), 'yyyy-MM-dd'));

    const profilesSnap = await db.collection('userProfiles').where('status', '==', 'approved').get();
    await Promise.all(profilesSnap.docs.map((d) => processUser(d.id, recentDates)));
    console.log(`progressWeekly complete: users=${profilesSnap.size}`);
    return null;
  });

async function processUser(uid: string, recentDates: string[]): Promise<void> {
  try {
    const [progSnap, ...daySnaps] = await Promise.all([
      db.doc(`users/${uid}/progress/main`).get(),
      ...recentDates.map((d) => db.doc(`users/${uid}/days/${d}`).get()),
    ]);

    const prog = progSnap.exists ? (progSnap.data() as ProgressDoc) : null;
    const streak = prog?.globalStreak ?? 0;
    const level = prog?.level ?? 1;

    const scores = daySnaps.map((s) => (s.exists ? (s.data() as DayDoc).dayScore ?? 0 : 0));
    const activeDays = scores.filter((v) => v > 0).length;
    const achievedDays = scores.filter((v) => v >= 50).length;

    // 한 주 동안 아무 기록이 없으면 보내지 않는다 (스팸 방지).
    if (activeDays === 0) return;

    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const tokenSnap = await db.collection(`users/${uid}/notifications`).get();
    const tokens = tokenSnap.docs.map((d) => (d.data() as NotificationTokenDoc).token).filter(Boolean);
    if (tokens.length === 0) return;

    const body = buildBody({ avg, achievedDays, streak, level });

    await admin.messaging().sendEachForMulticast({
      tokens,
      // data-only: 표시는 서비스워커가 전담한다(중복 알림 방지).
      data: {
        title: '📊 이번 주 진척 돌아보기',
        body,
        action: 'progress_weekly',
        link: '/habit-garden/#/progress',
      },
      webpush: {
        fcmOptions: { link: '/habit-garden/#/progress' },
        headers: { Urgency: 'high' },
      },
    });

    await db.doc(`users/${uid}/progress/main`).set({
      _lastProgressWeeklyAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.error(`progressWeekly failed for uid=${uid}:`, e);
  }
}

interface WeeklyCtx {
  avg: number;
  achievedDays: number;
  streak: number;
  level: number;
}

function buildBody(ctx: WeeklyCtx): string {
  const head = `이번 주 평균 ${ctx.avg}점 · 달성 ${ctx.achievedDays}/7일`;
  const tail =
    ctx.streak >= 7 ? `🔥 ${ctx.streak}일 연속 — 흐름이 좋아요` :
    ctx.achievedDays >= 5 ? '꾸준한 한 주였어요' :
    ctx.achievedDays >= 1 ? '다음 주 한 걸음 더 가볍게' :
    '이번 주도 다시 출발해봐요';
  return `${head} · ${tail}`;
}
