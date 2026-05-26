/**
 * todoAward — 할 일(오늘 할 일) 게임화 트리거
 *  todayTodos onWrite:
 *    - done: false→true → 완료 포인트 적립 (하루 상한 적용)
 *    - done: true→false → 적립돼 있던 포인트 삭감
 *  미래 날짜(오늘 이후)의 할 일은 선완료 악용 방지를 위해 포인트를 지급하지 않는다.
 *  (클라이언트 연출만 나오고 서버 적립은 없음)
 *
 *  포인트는 days/{date}.todoAwardedIds(현재 적립 집합)로 멱등 정산한다.
 *  prayerAward 의 prayerCheckAwardedIds 방식과 동일.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { format, subHours } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  TODO_POINT_EARN,
  TODO_DAILY_CHECK_CAP,
  type TodayTodoDoc,
  type DayDoc,
} from '../../shared/types/firestore';
import { applyLevelUps } from './levelEngine';

const db = admin.firestore();
const REGION = 'asia-northeast3';
const KST = 'Asia/Seoul';

// 04:00 경계 기준 '오늘' (클라이언트 dayBoundary.plannerDate 와 동일 규칙)
function plannerToday(): string {
  const shifted = subHours(toZonedTime(new Date(), KST), 4);
  return format(shifted, 'yyyy-MM-dd');
}

export const todoAward = functions
  .region(REGION)
  .firestore
  .document('users/{uid}/days/{date}/todayTodos/{todoId}')
  .onWrite(async (change, context) => {
    const { uid, date, todoId } = context.params as { uid: string; date: string; todoId: string };

    const before = change.before.exists ? (change.before.data() as TodayTodoDoc) : null;
    const after = change.after.exists ? (change.after.data() as TodayTodoDoc) : null;

    const doneBefore = !!before?.done;
    const doneAfter = !!after?.done;
    if (doneBefore === doneAfter) return; // 완료 상태 전이가 아니면(생성·제목 수정·삭제) 무시

    // 미래 날짜의 할 일은 적립/삭감하지 않는다 (선완료 악용 방지)
    if (date > plannerToday()) return;

    const dayRef = db.doc(`users/${uid}/days/${date}`);
    let pointsDelta = 0;

    await db.runTransaction(async (tx) => {
      const day = (await tx.get(dayRef)).data() as
        | (DayDoc & { todoAwardedIds?: string[] })
        | undefined;
      const awarded = day?.todoAwardedIds ?? [];
      const isAwarded = awarded.includes(todoId);

      if (doneAfter && !isAwarded) {
        // 완료 — 하루 상한은 '적립된 할 일 수' 기준
        const earnedPrev = Math.min(awarded.length * TODO_POINT_EARN.TODO_CHECK, TODO_DAILY_CHECK_CAP);
        const earnedNow = Math.min((awarded.length + 1) * TODO_POINT_EARN.TODO_CHECK, TODO_DAILY_CHECK_CAP);
        pointsDelta = earnedNow - earnedPrev;
        tx.set(dayRef, {
          todoAwardedIds: FieldValue.arrayUnion(todoId),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } else if (!doneAfter && isAwarded) {
        // 완료 해제 — 적립돼 있던 경우만 삭감
        const earnedPrev = Math.min(awarded.length * TODO_POINT_EARN.TODO_CHECK, TODO_DAILY_CHECK_CAP);
        const earnedNow = Math.min((awarded.length - 1) * TODO_POINT_EARN.TODO_CHECK, TODO_DAILY_CHECK_CAP);
        pointsDelta = earnedNow - earnedPrev; // 음수
        tx.set(dayRef, {
          todoAwardedIds: FieldValue.arrayRemove(todoId),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });

    if (pointsDelta !== 0) {
      await creditPoints(uid, pointsDelta, doneAfter ? 'todo_check' : 'todo_uncheck', `${date}/${todoId}`);
    }
  });

async function creditPoints(uid: string, delta: number, reason: string, refId?: string) {
  const batch = db.batch();
  const ledgerRef = db.collection(`users/${uid}/pointLedger`).doc();
  batch.set(ledgerRef, {
    delta, reason, refId: refId ?? null, createdAt: FieldValue.serverTimestamp(),
  });
  const progressRef = db.doc(`users/${uid}/progress/main`);
  batch.set(progressRef, {
    totalPoints:     FieldValue.increment(delta),
    spendablePoints: FieldValue.increment(delta),
    xpInLevel:       FieldValue.increment(delta),
    updatedAt:        FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();

  // 할 일로 쌓인 XP도 레벨업·보상 검사 대상
  await applyLevelUps(uid);
}
