/**
 * dayScoreEngine — Firestore onWrite 트리거
 * 습관 체크(habitChecks) 변경 시:
 *  1. days/{date}.dayScore (가중평균 0~100) 갱신 — 히트맵·브리핑·AI 코치가 사용
 *  2. 기록 습관의 달성 비율이 SUCCESS_THRESHOLD 이상이면 '성공한 날' 처리
 *     → days/{date}.successAwarded 멱등 게이트 후 globalStreak +1 / globalBestStreak 갱신
 *     (실패한 날의 스트릭 리셋은 다음날 04:00 dailyReset이 정산한다)
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { HabitDoc, HabitCheckDoc, ProgressDoc } from '../../shared/types/firestore';
import { SUCCESS_THRESHOLD } from '../../shared/lib/daySuccess';

const db = admin.firestore();
const REGION = 'asia-northeast3';

// ── habitChecks onWrite ─────────────────────────────────────────────────────
export const dayScoreEngine = functions
  .region(REGION)
  .firestore
  .document('users/{uid}/days/{date}/habitChecks/{habitId}')
  .onWrite(async (_change, context) => {
    const { uid, date } = context.params;
    await updateDayScore(uid, date);
  });

async function updateDayScore(uid: string, date: string) {
  // 오늘의 모든 habitChecks를 읽어 가중평균 계산
  const [checksSnap, habitsSnap] = await Promise.all([
    db.collection(`users/${uid}/days/${date}/habitChecks`).get(),
    db.collection(`users/${uid}/habits`).get(),
  ]);
  const habitsMap: Record<string, HabitDoc> = {};
  habitsSnap.docs.forEach((d) => { habitsMap[d.id] = d.data() as HabitDoc; });

  let numerator = 0, denominator = 0;
  let achievedCount = 0, totalCount = 0;

  checksSnap.docs.forEach((d) => {
    const c    = d.data() as HabitCheckDoc;
    const h    = habitsMap[c.habitId];
    if (!h) return;
    totalCount++;
    if (c.achieved) achievedCount++;
    if (c.score === null) return;
    const norm = h.scoreMode === 'scaled' ? (c.score - 1) / 4 : c.score;
    numerator   += norm * h.weight;
    denominator += h.weight;
  });

  const dayScore = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
  const successRatio = totalCount > 0 ? achievedCount / totalCount : 0;
  const isSuccessDay = successRatio >= SUCCESS_THRESHOLD;

  await db.doc(`users/${uid}/days/${date}`).set(
    { dayScore, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  if (isSuccessDay) {
    await handleSuccessDay(uid, date);
  }
}

async function handleSuccessDay(uid: string, date: string) {
  const dayRef = db.doc(`users/${uid}/days/${date}`);

  // 멱등 게이트: '성공한 날' 스트릭 증가는 하루에 한 번만.
  // 습관 체크↔해제·점수 변경으로 트리거가 재발생해도 globalStreak 폭증이 없다.
  const firstSuccessToday = await db.runTransaction(async (tx) => {
    const day = (await tx.get(dayRef)).data() ?? {};
    if (day.successAwarded) return false;
    tx.set(dayRef, { successAwarded: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  if (!firstSuccessToday) return;

  const progressRef = db.doc(`users/${uid}/progress/main`);
  const snap = await progressRef.get();
  const progress = snap.exists ? (snap.data() as ProgressDoc) : null;
  const lastStreak = progress?.globalStreak ?? 0;
  const newStreak  = lastStreak + 1;

  await progressRef.set({
    globalStreak:     newStreak,
    globalBestStreak: Math.max(progress?.globalBestStreak ?? 0, newStreak),
    updatedAt:         FieldValue.serverTimestamp(),
  }, { merge: true });
}
