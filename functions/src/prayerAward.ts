/**
 * prayerAward — 기도 통계 트리거
 *  A. prayerChecks onWrite(생성/삭제):
 *     1. prayers 문서 갱신 (lastPrayedAt, prayCount, streak) — prayerCountedIds 영구 게이트
 *     2. 오늘 목록 전부 완료 시 prayerStreak/prayerBestStreak/lastPrayerDate 갱신
 *        (prayerListCompleted 게이트로 하루 1회)
 *  B. prayers onUpdate (status → answered): totalPrayersAnswered 증가
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { PrayerDoc, DayDoc, ProgressDoc } from '../../shared/types/firestore';

const db = admin.firestore();
const REGION = 'asia-northeast3';

function prevDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── A. 기도 체크/해제 트리거 ─────────────────────────────────
export const prayerAward = functions
  .region(REGION)
  .firestore
  .document('users/{uid}/days/{date}/prayerChecks/{prayerId}')
  .onWrite(async (change, context) => {
    const { uid, date, prayerId } = context.params as { uid: string; date: string; prayerId: string };

    const existedBefore = change.before.exists;
    const existsAfter = change.after.exists;
    if (existedBefore === existsAfter) return; // 생성/삭제 전이가 아니면(단순 업데이트) 무시
    if (!existsAfter) return;                  // 해제(삭제)는 통계를 되돌리지 않음

    // prayCount·스트릭은 prayerCountedIds(영구 집합)로 게이트해 체크↔해제 반복 시 폭증을 막는다.
    const dayRef = db.doc(`users/${uid}/days/${date}`);
    let firstCountToday = false;

    await db.runTransaction(async (tx) => {
      const day = (await tx.get(dayRef)).data() as
        | (DayDoc & { prayerCountedIds?: string[] })
        | undefined;
      const counted = day?.prayerCountedIds ?? [];
      firstCountToday = !counted.includes(prayerId);
      if (firstCountToday) {
        tx.set(dayRef, {
          prayerCountedIds: FieldValue.arrayUnion(prayerId),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });

    // 1. prayer 문서 갱신 (per-prayer streak) — 오늘 최초 1회만(영구 게이트)
    if (firstCountToday) {
      const prayerRef = db.doc(`users/${uid}/prayers/${prayerId}`);
      const prayerSnap = await prayerRef.get();
      if (prayerSnap.exists) {
        const prayer = prayerSnap.data() as PrayerDoc;
        let newStreak = 1;
        const last = prayer.lastPrayedAt as any;
        if (last && typeof last.toDate === 'function') {
          const lastDateStr = last.toDate().toISOString().slice(0, 10);
          // 마지막 기도가 어제 이후이거나 같은 날 범위면 연속으로 간주
          if (lastDateStr >= prevDate(date)) newStreak = (prayer.streak ?? 0) + 1;
        }
        await prayerRef.update({
          lastPrayedAt: FieldValue.serverTimestamp(),
          prayCount: FieldValue.increment(1),
          streak: newStreak,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    // 2. 오늘 목록 전부 완료? — 스트릭 갱신은 1회만(prayerListCompleted 게이트).
    await checkDailyListComplete(uid, date);
  });

async function checkDailyListComplete(uid: string, date: string) {
  const dayRef = db.doc(`users/${uid}/days/${date}`);
  const daySnap = await dayRef.get();
  const day = daySnap.data() as (DayDoc & { prayerListCompleted?: boolean }) | undefined;
  if (!day) return;
  if (day.prayerListCompleted) return; // 이미 처리됨

  // 오늘 목록 = prayerPlan(있으면) 또는 활성 고정+로테이션. plan이 없으면 스킵(완료 판정 모호).
  const plan = day.prayerPlan;
  if (!plan) return;
  const listIds = Array.from(new Set([...(plan.pinnedIds ?? []), ...(plan.rotationIds ?? [])]));
  if (listIds.length === 0) return;

  const checksSnap = await db.collection(`users/${uid}/days/${date}/prayerChecks`).get();
  const checkedSet = new Set(checksSnap.docs.map((d) => d.id));
  const allDone = listIds.every((id) => checkedSet.has(id));
  if (!allDone) return;

  await dayRef.set({ prayerListCompleted: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  // prayerStreak 갱신
  const progressRef = db.doc(`users/${uid}/progress/main`);
  const pSnap = await progressRef.get();
  const p = pSnap.exists ? (pSnap.data() as ProgressDoc) : null;
  const last = p?.lastPrayerDate;
  const newStreak = last === prevDate(date) ? (p?.prayerStreak ?? 0) + 1 : 1;
  await progressRef.set({
    prayerStreak: newStreak,
    prayerBestStreak: Math.max(p?.prayerBestStreak ?? 0, newStreak),
    lastPrayerDate: date,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

// ── B. 응답 기록 트리거 ─────────────────────────────────────
export const prayerAnsweredAward = functions
  .region(REGION)
  .firestore
  .document('users/{uid}/prayers/{prayerId}')
  .onUpdate(async (change, context) => {
    const { uid } = context.params as { uid: string };

    const before = change.before.data() as PrayerDoc;
    const after  = change.after.data() as PrayerDoc;
    if (before.status === 'answered' || after.status !== 'answered') return;

    const progressRef = db.doc(`users/${uid}/progress/main`);
    await progressRef.set({
      totalPrayersAnswered: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
