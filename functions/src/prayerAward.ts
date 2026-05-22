/**
 * prayerAward — 기도 게임화 트리거 (설계 §7)
 *  A. prayerChecks onCreate:
 *     1. prayers 문서 갱신 (lastPrayedAt, prayCount, streak)
 *     2. 기도 체크 포인트 적립 (하루 상한 적용)
 *     3. 오늘 목록 전부 완료 시 완료 보너스 + prayerStreak 갱신 + 배지
 *  B. prayers onUpdate (status → answered):
 *     응답 포인트 + totalPrayersAnswered + 첫 응답 배지
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  PRAYER_POINT_EARN,
  PRAYER_DAILY_CHECK_CAP,
  BADGE_DEFS,
  type PrayerDoc,
  type DayDoc,
  type ProgressDoc,
} from '../../shared/types/firestore';

const db = admin.firestore();
const ALLOWED_UID = 'XMgQWlM1wtM62hIheTH4sKGDNuC2';
const REGION = 'asia-northeast3';

function prevDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── A. 기도 체크 트리거 ─────────────────────────────────────
export const prayerAward = functions
  .region(REGION)
  .firestore
  .document('users/{uid}/days/{date}/prayerChecks/{prayerId}')
  .onCreate(async (_snap, context) => {
    const { uid, date, prayerId } = context.params as { uid: string; date: string; prayerId: string };
    if (uid !== ALLOWED_UID) return;

    // 1. prayer 문서 갱신 (per-prayer streak)
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

    // 2. 체크 포인트 (하루 상한 적용)
    const checksSnap = await db.collection(`users/${uid}/days/${date}/prayerChecks`).get();
    const n = checksSnap.size;
    const earnedNow = Math.min(n * PRAYER_POINT_EARN.PRAYER_CHECK, PRAYER_DAILY_CHECK_CAP);
    const earnedPrev = Math.min((n - 1) * PRAYER_POINT_EARN.PRAYER_CHECK, PRAYER_DAILY_CHECK_CAP);
    const delta = earnedNow - earnedPrev;
    if (delta > 0) {
      await creditPoints(uid, delta, 'prayer_check', `${date}/${prayerId}`);
    }

    // 3. 오늘 목록 전부 완료?
    await checkDailyListComplete(uid, date, checksSnap.docs.map((d) => d.id));
  });

async function checkDailyListComplete(uid: string, date: string, checkedIds: string[]) {
  const dayRef = db.doc(`users/${uid}/days/${date}`);
  const daySnap = await dayRef.get();
  const day = daySnap.data() as (DayDoc & { prayerListCompleted?: boolean }) | undefined;
  if (!day) return;
  if (day.prayerListCompleted) return; // 이미 보너스 지급

  // 오늘 목록 = prayerPlan(있으면) 또는 활성 고정+로테이션. plan이 없으면 스킵(완료 판정 모호).
  const plan = day.prayerPlan;
  if (!plan) return;
  const listIds = Array.from(new Set([...(plan.pinnedIds ?? []), ...(plan.rotationIds ?? [])]));
  if (listIds.length === 0) return;

  const checkedSet = new Set(checkedIds);
  const allDone = listIds.every((id) => checkedSet.has(id));
  if (!allDone) return;

  // 완료 보너스
  await dayRef.set({ prayerListCompleted: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await creditPoints(uid, PRAYER_POINT_EARN.DAILY_LIST_COMPLETE, 'prayer_list_complete', date);

  // prayerStreak 갱신
  const progressRef = db.doc(`users/${uid}/progress`);
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

  // 스트릭 마일스톤 포인트
  if (newStreak === 7)  await creditPoints(uid, PRAYER_POINT_EARN.PRAYER_STREAK_7, 'prayer_streak_7');
  if (newStreak === 30) await creditPoints(uid, PRAYER_POINT_EARN.PRAYER_STREAK_30, 'prayer_streak_30');

  // 배지
  await grantPrayerStreakBadges(uid, newStreak);
}

// ── B. 응답 기록 트리거 ─────────────────────────────────────
export const prayerAnsweredAward = functions
  .region(REGION)
  .firestore
  .document('users/{uid}/prayers/{prayerId}')
  .onUpdate(async (change, context) => {
    const { uid } = context.params as { uid: string };
    if (uid !== ALLOWED_UID) return;

    const before = change.before.data() as PrayerDoc;
    const after  = change.after.data() as PrayerDoc;
    if (before.status === 'answered' || after.status !== 'answered') return;

    await creditPoints(uid, PRAYER_POINT_EARN.PRAYER_ANSWERED, 'prayer_answered', after.id);

    const progressRef = db.doc(`users/${uid}/progress`);
    await progressRef.set({
      totalPrayersAnswered: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // 첫 응답 배지
    const badgeRef = db.doc(`users/${uid}/badges/pray_answered_1`);
    if (!(await badgeRef.get()).exists) {
      const def = BADGE_DEFS.find((b) => b.id === 'pray_answered_1');
      if (def) await badgeRef.set({
        badgeId: def.id, title: def.title, tier: def.tier,
        earnedAt: FieldValue.serverTimestamp(),
      });
    }
  });

// ── 헬퍼 ───────────────────────────────────────────────────
async function creditPoints(uid: string, delta: number, reason: string, refId?: string) {
  const batch = db.batch();
  const ledgerRef = db.collection(`users/${uid}/pointLedger`).doc();
  batch.set(ledgerRef, {
    delta, reason, refId: refId ?? null, createdAt: FieldValue.serverTimestamp(),
  });
  const progressRef = db.doc(`users/${uid}/progress`);
  batch.set(progressRef, {
    totalPoints:     FieldValue.increment(delta),
    spendablePoints: FieldValue.increment(delta),
    xpInLevel:       FieldValue.increment(delta),
    updatedAt:        FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

async function grantPrayerStreakBadges(uid: string, streak: number) {
  const map: Array<{ id: string; min: number }> = [
    { id: 'pray_streak_7',   min: 7 },
    { id: 'pray_streak_30',  min: 30 },
    { id: 'pray_streak_100', min: 100 },
  ];
  for (const { id, min } of map) {
    if (streak < min) continue;
    const ref = db.doc(`users/${uid}/badges/${id}`);
    if ((await ref.get()).exists) continue;
    const def = BADGE_DEFS.find((b) => b.id === id);
    if (!def) continue;
    await ref.set({
      badgeId: def.id, title: def.title, tier: def.tier,
      earnedAt: FieldValue.serverTimestamp(),
    });
  }
}
