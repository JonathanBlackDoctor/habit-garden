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
import type {
  HabitDoc, HabitCheckDoc, ProgressDoc, NotificationTokenDoc,
  UserSettingsDoc, DayDoc, PrayerDoc,
} from '../../shared/types/firestore';
import { PRAYER_ROTATION_DEFAULTS } from '../../shared/types/firestore';
import { daysSince, type RotationInput } from '../../shared/prayerRotation';

const db = admin.firestore();
const REGION = 'asia-northeast3';
const KST = 'Asia/Seoul';
const MAX_PER_DAY = 3;
const HABIT_HOURS = [9, 13, 19, 21];

// 매시간 정각 트리거 → KST 시간에 따라 분기. 모든 사용자 순회.
// 습관 리마인더는 고정 시간대(9/13/19/21), 기도 리마인더는 사용자 설정 시각에 발송.
export const sendScheduledReminder = functions
  .region(REGION)
  .pubsub
  .schedule('0 * * * *')
  .timeZone(KST)
  .onRun(async () => {
    const now = toZonedTime(new Date(), KST);
    const hour = now.getHours();
    const today = format(now, 'yyyy-MM-dd');

    // 승인된 사용자만 대상으로 처리 (비용 최소화)
    const profilesSnap = await db.collection('userProfiles').where('status', '==', 'approved').get();
    await Promise.all(profilesSnap.docs.map(async (doc) => {
      try {
        if (HABIT_HOURS.includes(hour)) await processUser(doc.id, hour, today);
        await processPrayerReminder(doc.id, hour, today);
      } catch (e) {
        console.error(`reminder failed uid=${doc.id}:`, e);
      }
    }));
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

/**
 * 기도 리마인더 — 사용자가 설정한 시각(KST)에 하루 1회.
 * dailyReset이 확정한 prayerPlan 기준으로 남은 기도 수를 안내하고,
 * 곧 잠들 기도가 있으면 한 줄 환기를 덧붙인다.
 */
async function processPrayerReminder(uid: string, hour: number, today: string): Promise<void> {
  const settingsSnap = await db.doc(`users/${uid}/settings/main`).get();
  const reminder = (settingsSnap.data() as UserSettingsDoc | undefined)?.prayerReminder;
  if (!reminder?.enabled || reminder.hour !== hour) return;

  // 하루 1회 가드 (습관 리마인더 상한과 별도)
  const progRef = db.doc(`users/${uid}/progress/main`);
  const progSnap = await progRef.get();
  const marker = (progSnap.data() as any)?._todayPrayerReminder;
  if (marker?.date === today) return;

  // 오늘 목록과 체크 현황
  const daySnap = await db.doc(`users/${uid}/days/${today}`).get();
  const plan = (daySnap.data() as DayDoc | undefined)?.prayerPlan;
  if (!plan) return;
  const listIds = Array.from(new Set([
    ...(plan.pinnedIds ?? []), ...(plan.rotationIds ?? []), ...(plan.extraIds ?? []),
  ]));
  if (listIds.length === 0) return;

  const checksSnap = await db.collection(`users/${uid}/days/${today}/prayerChecks`).get();
  const checked = new Set(checksSnap.docs.map((d) => d.id));
  const remaining = listIds.filter((id) => !checked.has(id)).length;
  if (remaining === 0) return; // 이미 다 기도함 — 보내지 않음

  const tokenSnap = await db.collection(`users/${uid}/notifications`).get();
  const tokens = tokenSnap.docs.map((d) => (d.data() as NotificationTokenDoc).token).filter(Boolean);
  if (tokens.length === 0) return;

  // 곧 잠들 기도 환기 (잠듦 임계 7일 전부터)
  const nowMs = Date.now();
  const activeSnap = await db.collection(`users/${uid}/prayers`).where('status', '==', 'active').get();
  const dormantSoon = activeSnap.docs
    .map((d) => d.data() as PrayerDoc)
    .filter((p) => {
      if (p.pinned) return false;
      const input: RotationInput = {
        id: p.id,
        priority: p.priority,
        pinned: p.pinned,
        rotationDays: p.rotationDays,
        receivedAtMs: (p.receivedAt as any)?.toMillis?.() ?? nowMs,
        lastPrayedAtMs: (p.lastPrayedAt as any)?.toMillis?.(),
      };
      return daysSince(input, nowMs) > PRAYER_ROTATION_DEFAULTS[p.priority].dormantThreshold - 7;
    }).length;

  let body = `남은 기도 ${remaining}개 — 조용히 머무는 시간을 가져보세요`;
  if (dormantSoon > 0) body += `\n잊혀가는 기도 ${dormantSoon}개가 곧 잠들어요`;

  try {
    await admin.messaging().sendEachForMulticast({
      tokens,
      data: {
        title: '🙏 오늘의 기도',
        body,
        date: today,
        action: 'prayer_reminder',
        link: '/habit-garden/#/prayers',
      },
      webpush: {
        fcmOptions: { link: '/habit-garden/#/prayers' },
        headers: { Urgency: 'high' },
      },
    });
  } catch (e) {
    console.error(`prayer reminder FCM error for ${uid}:`, e);
    return; // 발송 실패 시 마커를 남기지 않아 다음 시간대 재시도 여지를 둔다 — 아래 hour 일치 조건상 같은 날 재발송은 없음
  }

  await progRef.set({
    _todayPrayerReminder: { date: today },
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
