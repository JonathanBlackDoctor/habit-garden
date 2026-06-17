/**
 * applicationAward — 말씀 적용(큐티·설교·묵상) 실천 게임화 트리거
 *
 *  A. applicationChecks onWrite (체크 생성/삭제):
 *     1. 실천 포인트 적립 (하루 상한 적용) — prayerAward 와 동일한 멱등 구조
 *     2. application 문서 갱신 (practiceCount, practicedDates, streak, lastPracticedAt)
 *        — 오늘 최초 1회만(applicationCountedIds 영구 게이트)
 *  B. applications onUpdate (status → completed):
 *     완료 보너스 포인트 + 정원 자동 성장
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  APPLICATION_POINT_EARN,
  APPLICATION_DAILY_CHECK_CAP,
  SPRINGWATER_EARN,
  type ApplicationDoc,
  type DayDoc,
} from '../../shared/types/firestore';
import { grantSpringWater } from './gardenAutogrow';
import { applyLevelUps } from './levelEngine';

const db = admin.firestore();
const REGION = 'asia-northeast3';

function prevDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── A. 실천 체크/해제 ────────────────────────────────────────
export const applicationAward = functions
  .region(REGION)
  .firestore
  .document('users/{uid}/days/{date}/applicationChecks/{appId}')
  .onWrite(async (change, context) => {
    const { uid, date, appId } = context.params as { uid: string; date: string; appId: string };

    const existedBefore = change.before.exists;
    const existsAfter = change.after.exists;
    if (existedBefore === existsAfter) return; // 생성/삭제 전이가 아니면 무시
    const isCheck = existsAfter;

    const dayRef = db.doc(`users/${uid}/days/${date}`);
    let pointsDelta = 0;
    let firstCountToday = false;

    await db.runTransaction(async (tx) => {
      const day = (await tx.get(dayRef)).data() as DayDoc | undefined;
      const awarded = day?.applicationCheckAwardedIds ?? [];
      const counted = day?.applicationCountedIds ?? [];
      const isAwarded = awarded.includes(appId);

      if (isCheck) {
        const patch: any = { updatedAt: FieldValue.serverTimestamp() };
        if (!isAwarded) {
          const earnedPrev = Math.min(awarded.length * APPLICATION_POINT_EARN.PRACTICE_CHECK, APPLICATION_DAILY_CHECK_CAP);
          const earnedNow = Math.min((awarded.length + 1) * APPLICATION_POINT_EARN.PRACTICE_CHECK, APPLICATION_DAILY_CHECK_CAP);
          pointsDelta = earnedNow - earnedPrev;
          patch.applicationCheckAwardedIds = FieldValue.arrayUnion(appId);
        }
        firstCountToday = !counted.includes(appId);
        if (firstCountToday) patch.applicationCountedIds = FieldValue.arrayUnion(appId);
        tx.set(dayRef, patch, { merge: true });
      } else if (isAwarded) {
        const earnedPrev = Math.min(awarded.length * APPLICATION_POINT_EARN.PRACTICE_CHECK, APPLICATION_DAILY_CHECK_CAP);
        const earnedNow = Math.min((awarded.length - 1) * APPLICATION_POINT_EARN.PRACTICE_CHECK, APPLICATION_DAILY_CHECK_CAP);
        pointsDelta = earnedNow - earnedPrev; // 음수
        tx.set(dayRef, {
          applicationCheckAwardedIds: FieldValue.arrayRemove(appId),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });

    if (isCheck) {
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
      if (pointsDelta > 0) {
        await creditPoints(uid, pointsDelta, 'application_check', `${date}/${appId}`);
        await grantSpringWater(uid, SPRINGWATER_EARN.APPLICATION_CHECK);  // 말씀 적용 실천 → 샘물
      }
    } else if (pointsDelta < 0) {
      // 해제 — 적립됐던 포인트만 삭감. practiceCount/streak 은 되돌리지 않는다(영구 기록).
      await creditPoints(uid, pointsDelta, 'application_uncheck', `${date}/${appId}`);
    }
  });

// ── B. 적용 완료 보너스 ──────────────────────────────────────
export const applicationCompleteAward = functions
  .region(REGION)
  .firestore
  .document('users/{uid}/applications/{appId}')
  .onUpdate(async (change, context) => {
    const { uid } = context.params as { uid: string };
    const before = change.before.data() as ApplicationDoc;
    const after = change.after.data() as ApplicationDoc;
    if (before.status === 'completed' || after.status !== 'completed') return;

    await creditPoints(uid, APPLICATION_POINT_EARN.COMPLETE, 'application_complete', after.id);
    await grantSpringWater(uid, SPRINGWATER_EARN.APPLICATION_COMPLETE);  // 말씀 적용 완료 → 샘물
  });

// ── 헬퍼 ───────────────────────────────────────────────────
async function creditPoints(uid: string, delta: number, reason: string, refId?: string): Promise<void> {
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
  await applyLevelUps(uid);
}
