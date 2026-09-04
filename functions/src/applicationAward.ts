/**
 * applicationAward — 말씀 적용(큐티·설교·묵상) 실천 통계 트리거
 *
 *  applicationChecks onWrite (체크 생성):
 *  application 문서 갱신 (practiceCount, practicedDates, streak, lastPracticedAt)
 *  — 오늘 최초 1회만(applicationCountedIds 영구 게이트). 해제는 되돌리지 않는다(영구 기록).
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { ApplicationDoc, DayDoc } from '../../shared/types/firestore';

const db = admin.firestore();
const REGION = 'asia-northeast3';

function prevDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const applicationAward = functions
  .region(REGION)
  .firestore
  .document('users/{uid}/days/{date}/applicationChecks/{appId}')
  .onWrite(async (change, context) => {
    const { uid, date, appId } = context.params as { uid: string; date: string; appId: string };

    const existedBefore = change.before.exists;
    const existsAfter = change.after.exists;
    if (existedBefore === existsAfter) return; // 생성/삭제 전이가 아니면 무시
    if (!existsAfter) return;                  // 해제(삭제)는 통계를 되돌리지 않음

    const dayRef = db.doc(`users/${uid}/days/${date}`);
    let firstCountToday = false;

    await db.runTransaction(async (tx) => {
      const day = (await tx.get(dayRef)).data() as
        | (DayDoc & { applicationCountedIds?: string[] })
        | undefined;
      const counted = day?.applicationCountedIds ?? [];
      firstCountToday = !counted.includes(appId);
      if (firstCountToday) {
        tx.set(dayRef, {
          applicationCountedIds: FieldValue.arrayUnion(appId),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });

    // application 문서 갱신 — 오늘 최초 1회(영구 게이트)
    if (firstCountToday) {
      const appRef = db.doc(`users/${uid}/applications/${appId}`);
      const appSnap = await appRef.get();
      if (appSnap.exists) {
        const app = appSnap.data() as ApplicationDoc;
        let newStreak = 1;
        const last = app.lastPracticedAt as any;
        if (last && typeof last.toDate === 'function') {
          const lastDateStr = last.toDate().toISOString().slice(0, 10);
          if (lastDateStr >= prevDate(date)) newStreak = (app.streak ?? 0) + 1;
        }
        await appRef.update({
          practicedDates: FieldValue.arrayUnion(date),
          practiceCount: FieldValue.increment(1),
          streak: newStreak,
          lastPracticedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  });
