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
import { shouldBecomeDormant, type RotationInput } from '../../shared/prayerRotation';
import type { PrayerDoc } from '../../shared/types/firestore';

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
        const dormantCount = await processDormantTransitions(uid);  // 잊혀짐 자동 전이 (설계 §5)
        if (dormantCount > 0) console.log(`dormant transition: uid=${uid}, n=${dormantCount}`);
      } catch (e) {
        console.error(`dailyReset failed for uid=${uid}:`, e);
      }
    }

    console.log(`dailyReset complete: today=${today}, yesterday=${yesterday}, users=${profilesSnap.size}`);
  });

function tsToMs(ts: unknown): number | undefined {
  return ts && typeof (ts as any).toMillis === 'function' ? (ts as any).toMillis() : undefined;
}

/** 활성 기도제목 중 망각 임계를 넘긴 항목을 dormant로 전이 (pinned 제외) */
async function processDormantTransitions(uid: string): Promise<number> {
  const snap = await db.collection(`users/${uid}/prayers`).where('status', '==', 'active').get();
  if (snap.empty) return 0;

  const nowMs = Date.now();
  let count = 0;
  const batch = db.batch();
  for (const docSnap of snap.docs) {
    const p = docSnap.data() as PrayerDoc;
    if (p.pinned) continue;
    const input: RotationInput = {
      id: p.id,
      priority: p.priority,
      pinned: p.pinned,
      rotationDays: p.rotationDays,
      receivedAtMs: tsToMs(p.receivedAt) ?? nowMs,
      lastPrayedAtMs: tsToMs(p.lastPrayedAt),
    };
    if (shouldBecomeDormant(input, nowMs)) {
      batch.update(docSnap.ref, {
        status: 'dormant',
        dormantSince: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      count++;
    }
  }
  if (count > 0) await batch.commit();
  return count;
}

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
        await progressRef.set({
          globalStreak: 0,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  }
  return success;
}
