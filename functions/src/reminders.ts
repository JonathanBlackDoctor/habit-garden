/**
 * Phase 3-2 — 시간대별 스마트 리마인더.
 * KST 기준 09:00, 13:00, 19:00, 21:00 매시간 트리거.
 * 미체크 핵심 습관이 있을 때만 발송. 하루 3회 throttle.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { HabitDoc, HabitCheckDoc, ProgressDoc, NotificationTokenDoc } from '../../shared/types/firestore';

const db = admin.firestore();
const REGION = 'asia-northeast3';
const KST = 'Asia/Seoul';
const MAX_PER_DAY = 3;

// 매시간 정각 트리거 → KST 시간에 따라 분기. 모든 사용자 순회.
export const sendScheduledReminder = functions
  .region(REGION)
  .pubsub
  .schedule('0 * * * *')
  .timeZone(KST)
  .onRun(async () => {
    const now = toZonedTime(new Date(), KST);
    const hour = now.getHours();
    if (![9, 13, 19, 21].includes(hour)) return null;
    const today = format(now, 'yyyy-MM-dd');

    // 승인된 사용자만 대상으로 처리 (비용 최소화)
    const profilesSnap = await db.collection('userProfiles').where('status', '==', 'approved').get();
    await Promise.all(profilesSnap.docs.map((doc) => processUser(doc.id, hour, today)));
    return null;
  });

async function processUser(uid: string, hour: number, today: string): Promise<void> {
  const progSnap = await db.doc(`users/${uid}/progress/main`).get();
  if (!progSnap.exists) return;
  const prog = progSnap.data() as ProgressDoc;
  const lastReminderToday = countTodayReminders(prog, today);
  if (lastReminderToday >= MAX_PER_DAY) return;

  const [habitsSnap, checksSnap] = await Promise.all([
    db.collection(`users/${uid}/habits`).get(),
    db.collection(`users/${uid}/days/${today}/habitChecks`).get(),
  ]);
  const habits = habitsSnap.docs.map((d) => d.data() as HabitDoc).filter((h) => h.active);
  const checks: Record<string, HabitCheckDoc> = {};
  checksSnap.docs.forEach((d) => { checks[d.id] = d.data() as HabitCheckDoc; });

  const todForHour: Record<number, HabitDoc['timeOfDay']> = {
    9: 'morning',
    13: 'afternoon',
    19: 'evening',
    21: 'night',
  };
  const tod = todForHour[hour];
  const target = habits.filter((h) => h.timeOfDay === tod);
  const unchecked = target.filter((h) => !checks[h.id]);
  if (unchecked.length === 0) return;

  const tokenSnap = await db.collection(`users/${uid}/notifications`).get();
  const tokens = tokenSnap.docs.map((d) => (d.data() as NotificationTokenDoc).token).filter(Boolean);
  if (tokens.length === 0) return;

  const title = buildTitle(hour, unchecked.length);
  const body  = `${unchecked.slice(0, 2).map((h) => h.title).join(', ')}${unchecked.length > 2 ? ` 외 ${unchecked.length - 2}개` : ''}`;

  try {
    await admin.messaging().sendEachForMulticast({
      tokens,
      // data-only: 표시는 서비스워커가 전담한다(중복 알림/액션버튼 누락 방지).
      data: {
        title,
        body,
        tod: tod ?? 'anytime',
        date: today,
        action: 'habit_reminder',
        habitIds: unchecked.map((h) => h.id).join(','),
        link: '/habit-garden/#/habits',
      },
      webpush: {
        fcmOptions: { link: '/habit-garden/#/habits' },
        headers: { Urgency: 'high' },
      },
    });
  } catch (e) {
    console.error(`FCM send error for ${uid}:`, e);
  }

  await db.doc(`users/${uid}/progress/main`).set({
    lastReminderAt: FieldValue.serverTimestamp(),
    _todayReminderCount: { date: today, count: lastReminderToday + 1 },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

function countTodayReminders(prog: ProgressDoc, today: string): number {
  const meta = (prog as any)._todayReminderCount;
  if (!meta || meta.date !== today) return 0;
  return meta.count ?? 0;
}

function buildTitle(hour: number, count: number): string {
  if (hour <= 9)  return `☀️ 아침 습관 ${count}개 남았어요`;
  if (hour <= 13) return `🥗 점심 시간 — ${count}개 체크`;
  if (hour <= 19) return `🌆 저녁 습관 ${count}개`;
  return `🌙 자기 전 ${count}개만 더`;
}
