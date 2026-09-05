/**
 * 봇의 습관 체크 — 앱과 같은 문서에 같은 형태로 쓴다.
 *
 * dayScore·스트릭은 여기서 계산하지 않는다. habitChecks 쓰기가 기존
 * dayScoreEngine(onWrite) 트리거를 깨우고, 그쪽이 정산을 전담한다.
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  HabitDoc, HabitCheckDoc, DayDoc, ProgressDoc,
} from '../../../shared/types/firestore';
import {
  visibleHabits, isAchieved, buildHabitListMessage, buildScorePicker,
  type InlineKeyboard,
} from '../../../shared/lib/telegram';

const db = admin.firestore();

export interface DayView {
  habits: HabitDoc[];
  checks: Record<string, HabitCheckDoc>;
  streak: number;
  dayScore: number | null;
}

export async function loadDayView(uid: string, date: string): Promise<DayView> {
  const [habitsSnap, checksSnap, daySnap, progSnap] = await Promise.all([
    db.collection(`users/${uid}/habits`).get(),
    db.collection(`users/${uid}/days/${date}/habitChecks`).get(),
    db.doc(`users/${uid}/days/${date}`).get(),
    db.doc(`users/${uid}/progress/main`).get(),
  ]);

  const checks: Record<string, HabitCheckDoc> = {};
  checksSnap.docs.forEach((d) => { checks[d.id] = d.data() as HabitCheckDoc; });

  return {
    habits: visibleHabits(habitsSnap.docs.map((d) => d.data() as HabitDoc)),
    checks,
    streak: (progSnap.data() as ProgressDoc | undefined)?.globalStreak ?? 0,
    dayScore: (daySnap.data() as DayDoc | undefined)?.dayScore ?? null,
  };
}

export async function renderHabitList(
  uid: string,
  date: string,
): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const v = await loadDayView(uid, date);
  return buildHabitListMessage({ date, ...v });
}

export async function renderScorePicker(
  uid: string,
  date: string,
  habitId: string,
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  const [habitSnap, checkSnap] = await Promise.all([
    db.doc(`users/${uid}/habits/${habitId}`).get(),
    db.doc(`users/${uid}/days/${date}/habitChecks/${habitId}`).get(),
  ]);
  if (!habitSnap.exists) return null;
  const habit = habitSnap.data() as HabitDoc;
  const check = checkSnap.exists ? (checkSnap.data() as HabitCheckDoc) : undefined;
  return buildScorePicker(habit, date, check);
}

/**
 * 체크 저장. 웹앱 useSaveHabitCheck 와 동일한 문서 형태 —
 * { habitId, score, achieved, checkedAt } (건너뛰기는 score: null).
 */
export async function saveCheck(
  uid: string,
  date: string,
  habitId: string,
  score: number | null,
): Promise<{ ok: boolean; toast: string }> {
  const habitSnap = await db.doc(`users/${uid}/habits/${habitId}`).get();
  if (!habitSnap.exists) return { ok: false, toast: '없는 습관이에요' };
  const habit = habitSnap.data() as HabitDoc;

  const achieved = isAchieved(habit, score);
  const doc: HabitCheckDoc = {
    habitId,
    score,
    achieved,
    checkedAt: FieldValue.serverTimestamp() as any,
  };
  await db.doc(`users/${uid}/days/${date}/habitChecks/${habitId}`).set(doc);

  if (score === null) return { ok: true, toast: '건너뜀' };
  return { ok: true, toast: achieved ? '달성!' : '기록됨 · 시도 인정' };
}

/** 기록 삭제 — 웹앱 useClearHabitCheck 과 동일하게 문서를 지워 '미기록'으로 되돌린다. */
export async function clearCheck(uid: string, date: string, habitId: string): Promise<void> {
  await db.doc(`users/${uid}/days/${date}/habitChecks/${habitId}`).delete().catch(() => undefined);
}
