/**
 * flushReminderQueue — 스누즈된 리마인더 재발송 (B-2).
 * 5분마다 승인 사용자의 reminderQueue 를 점검해, reSendAt 이 지난 항목을
 * (오늘자 & 아직 미체크인 경우) FCM 으로 다시 보내고 큐에서 제거한다.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { HabitDoc, HabitCheckDoc, UserSettingsDoc } from '../../shared/types/firestore';
import { sendPush } from './notify';

const db = admin.firestore();
const REGION = 'asia-northeast3';
const KST = 'Asia/Seoul';

export const flushReminderQueue = functions
  .region(REGION)
  .pubsub
  .schedule('*/5 * * * *')
  .timeZone(KST)
  .onRun(async () => {
    const today = format(toZonedTime(new Date(), KST), 'yyyy-MM-dd');
    const nowMs = Date.now();

    const profilesSnap = await db.collection('userProfiles').where('status', '==', 'approved').get();
    await Promise.all(profilesSnap.docs.map((d) => processUser(d.id, today, nowMs)));
    return null;
  });

async function processUser(uid: string, today: string, nowMs: number): Promise<void> {
  const queueSnap = await db.collection(`users/${uid}/reminderQueue`).get();
  if (queueSnap.empty) return;

  const due = queueSnap.docs.filter((doc) => {
    const ts = doc.data().reSendAt;
    return ts && typeof ts.toMillis === 'function' && ts.toMillis() <= nowMs;
  });
  if (due.length === 0) return;

  // 처리한 큐 항목은 무조건 제거 (재발송 여부와 무관)
  const batch = db.batch();
  due.forEach((d) => batch.delete(d.ref));

  // 오늘자 & 아직 미체크인 습관만 재발송 대상
  const sameDay = due.filter((d) => (d.data().date ?? today) === today);
  const habitIds = sameDay.map((d) => d.id);

  if (habitIds.length > 0) {
    const [habitDocs, checkDocs] = await Promise.all([
      Promise.all(habitIds.map((id) => db.doc(`users/${uid}/habits/${id}`).get())),
      Promise.all(habitIds.map((id) => db.doc(`users/${uid}/days/${today}/habitChecks/${id}`).get())),
    ]);

    const pending: string[] = [];
    const titles: string[] = [];
    habitDocs.forEach((h, i) => {
      if (!h.exists) return;
      const habit = h.data() as HabitDoc;
      if (!habit.active) return;
      const check = checkDocs[i].exists ? (checkDocs[i].data() as HabitCheckDoc) : null;
      if (check && check.score !== null && check.score !== undefined) return; // 이미 체크됨
      pending.push(h.id);
      titles.push(habit.title);
    });

    // 습관 리마인더가 꺼져 있으면 재발송하지 않는다 (큐 항목은 아래에서 정리됨)
    const settingsSnap = await db.doc(`users/${uid}/settings/main`).get();
    const habitOff = (settingsSnap.data() as UserSettingsDoc | undefined)?.notifications?.habitReminder === false;

    if (pending.length > 0 && !habitOff) {
      const tokenSnap = await db.collection(`users/${uid}/notifications`).get();
      if (!tokenSnap.empty) {
        await sendPush(uid, tokenSnap.docs, {
          title: `⏰ 다시 알림 — ${pending.length}개`,
          body: `${titles.slice(0, 2).join(', ')}${pending.length > 2 ? ` 외 ${pending.length - 2}개` : ''}`,
          date: today,
          habitIds: pending.join(','),
        }, { link: '/habit-garden/#/habits', type: 'habit_reminder' });
      }
    }
  }

  await batch.commit();
}
