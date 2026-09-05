/**
 * 봇의 저녁 회고 — 여러 턴에 걸쳐 질문하고, 마지막에 앱과 같은 형태로 저장한다.
 * 단계 전이 로직은 shared/lib/telegram(순수 함수, vitest 로 검증)에 있고
 * 여기서는 Firestore 읽기·쓰기와 메시지 발송만 맡는다.
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { subDays, parseISO, format } from 'date-fns';
import type { DayDoc } from '../../../shared/types/firestore';
import {
  newReflectionSession, applyReflectionInput, reflectionPrompt, reflectionSummary,
  type ReflectionSession,
} from '../../../shared/lib/telegram';
import { getSession, saveSession, clearSession } from './store';
import { sendMessage } from './api';

const db = admin.firestore();

/** 어제 회고의 '내일의 다짐'. 있으면 회고 첫 질문으로 실천 여부를 묻는다. */
async function yesterdayResolution(uid: string, date: string): Promise<string | undefined> {
  const prev = format(subDays(parseISO(date), 1), 'yyyy-MM-dd');
  const snap = await db.doc(`users/${uid}/days/${prev}`).get();
  const r = (snap.data() as DayDoc | undefined)?.reflection?.answers?.q_tomorrow?.trim();
  return r || undefined;
}

/** /reflect — 새 회고 세션을 시작하고 첫 질문을 보낸다. */
export async function startReflection(uid: string, chatId: string, date: string): Promise<void> {
  const daySnap = await db.doc(`users/${uid}/days/${date}`).get();
  const already = !!(daySnap.data() as DayDoc | undefined)?.reflection?.completedAt;

  const session = newReflectionSession(date, await yesterdayResolution(uid, date));
  await saveSession(uid, session);

  if (already) {
    await sendMessage(chatId, '오늘 회고가 이미 있어요. 새로 쓰면 기존 내용을 덮어씁니다.');
  }
  const { text, keyboard } = reflectionPrompt(session);
  await sendMessage(chatId, text, keyboard);
}

/**
 * 진행 중인 회고에 답을 하나 적용한다.
 * @returns 처리했으면 true (진행 중인 세션이 없으면 false — 호출부가 다른 해석을 시도한다)
 */
export async function handleReflectionInput(
  uid: string,
  chatId: string,
  raw: string,
): Promise<boolean> {
  const session = await getSession(uid);
  if (!session) return false;

  const result = applyReflectionInput(session, raw);
  if (result.error) {
    await sendMessage(chatId, `⚠️ ${result.error}`);
    const { text, keyboard } = reflectionPrompt(session);
    await sendMessage(chatId, text, keyboard);
    return true;
  }

  if (!result.done) {
    await saveSession(uid, result.session);
    const { text, keyboard } = reflectionPrompt(result.session);
    await sendMessage(chatId, text, keyboard);
    return true;
  }

  await finishReflection(uid, chatId, result.session);
  return true;
}

/** 앱의 회고 화면(routes/Reflection.tsx)과 같은 형태로 days/{date} 에 merge 한다. */
async function finishReflection(uid: string, chatId: string, s: ReflectionSession): Promise<void> {
  const reflection: Record<string, unknown> = {
    answers: s.answers,
    completedAt: FieldValue.serverTimestamp(),
  };
  if (s.screenTimeMinutes !== undefined) reflection.screenTimeMinutes = s.screenTimeMinutes;
  if (s.daySatisfaction !== undefined) reflection.daySatisfaction = s.daySatisfaction;

  const day: Record<string, unknown> = {
    date: s.date,
    reflection,
    updatedAt: FieldValue.serverTimestamp(),
  };
  // 어제 다짐의 실천 여부 — 앱의 '오늘의 다짐 실천' 토글과 같은 필드
  if (s.resolutionPracticed !== undefined) day.resolutionPracticed = s.resolutionPracticed;

  await db.doc(`users/${uid}/days/${s.date}`).set(day, { merge: true });
  await clearSession(uid);
  await sendMessage(chatId, reflectionSummary(s));
}

/** /cancel — 진행 중이던 회고를 버린다. */
export async function cancelReflection(uid: string, chatId: string): Promise<boolean> {
  const session = await getSession(uid);
  if (!session) return false;
  await clearSession(uid);
  await sendMessage(chatId, '회고 작성을 그만뒀어요. 언제든 /reflect 로 다시 시작할 수 있어요.');
  return true;
}
