/**
 * generateFeedback — 어제 데이터 기반 AI 피드백 생성
 * callable function. 일 5회 상한.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { subDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { HabitDoc, HabitCheckDoc, DayDoc } from '../../shared/types/firestore';

const db = admin.firestore();
const REGION = 'asia-northeast3';
const KST = 'Asia/Seoul';

export const generateFeedback = functions
  .region(REGION)
  .runWith({ secrets: ['GEMINI_API_KEY'] })
  .https
  .onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = context.auth.uid;
    const profSnap = await db.doc(`userProfiles/${uid}`).get();
    if (!profSnap.exists || profSnap.data()?.status !== 'approved') {
      throw new functions.https.HttpsError('permission-denied', 'Not approved');
    }

    const yesterday = format(subDays(toZonedTime(new Date(), KST), 1), 'yyyy-MM-dd');
    const today     = format(toZonedTime(new Date(), KST), 'yyyy-MM-dd');
    const targetDate = data?.date ?? yesterday;

    // 일 5회 상한 확인
    const dayRef  = db.doc(`users/${uid}/days/${today}`);
    const daySnap = await dayRef.get();
    const retryCount = daySnap.data()?.aiFeedback?.retryCount ?? 0;
    if (retryCount >= 5) {
      throw new functions.https.HttpsError('resource-exhausted', '일 5회 상한');
    }

    // 데이터 수집
    const [checksSnap, habitsSnap, targetDaySnap] = await Promise.all([
      db.collection(`users/${uid}/days/${targetDate}/habitChecks`).get(),
      db.collection(`users/${uid}/habits`).get(),
      db.doc(`users/${uid}/days/${targetDate}`).get(),
    ]);

    const habitsMap: Record<string, HabitDoc> = {};
    habitsSnap.docs.forEach((d) => { habitsMap[d.id] = d.data() as HabitDoc; });
    const dayData = targetDaySnap.data() as DayDoc | undefined;

    const habitSummary = checksSnap.docs.map((d) => {
      const c = d.data() as HabitCheckDoc;
      const h = habitsMap[c.habitId];
      return `${h?.title ?? c.habitId}: ${c.score ?? 'pass'} (달성: ${c.achieved})`;
    }).join('\n');

    const reflection = dayData?.reflection
      ? Object.values(dayData.reflection.answers).join(' / ')
      : '없음';

    const prompt = `
어제(${targetDate}) 기록 요약:
dayScore: ${dayData?.dayScore ?? 'N/A'}/100
컨디션: 수면${dayData?.condition?.sleepScore ?? 'N/A'} 에너지${dayData?.condition?.energyScore ?? 'N/A'} 기분${dayData?.condition?.moodScore ?? 'N/A'}
회고: ${reflection}

습관 체크:
${habitSummary}

위 데이터를 분석하여 아래 JSON 스키마로만 응답하라.
`;

    const schema = {
      type: 'object',
      required: ['oneLineSummary','goodPoints','toFix','recommendations','momentum','conditionAnalysis'],
      properties: {
        oneLineSummary:    { type: 'string', maxLength: 80 },
        goodPoints:        { type: 'array', items: { type: 'string' }, maxItems: 3 },
        toFix:             { type: 'array', items: { type: 'string' }, maxItems: 3 },
        recommendations:   { type: 'array', items: { type: 'string' }, maxItems: 3 },
        momentum:          { type: 'string', maxLength: 80 },
        conditionAnalysis: { type: 'string', maxLength: 200 },
      },
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new functions.https.HttpsError('internal', 'GEMINI_API_KEY not set');

    const sysInstr = `당신은 본인 1인의 일일 데이터를 분석하는 코치다. 한국어로 응답한다.
정량 데이터에 근거한 객관적 진술을 우선한다. 과장된 칭찬·공허한 위로·이모지·느낌표는 쓰지 않는다.
단, 진전과 연속성(스트릭, 추세 개선)은 사실에 근거해 한 줄로 인정하고 다음 행동을 이어가도록 동기를 부여한다.
추천 행동은 구체적이고 측정 가능해야 한다. 출력은 반드시 지정된 JSON 스키마를 따른다.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: sysInstr });

    let result;
    try {
      const chat = model.startChat();
      const res  = await chat.sendMessage(prompt);
      const text = res.response.text().trim();
      const clean = text.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch {
      result = {
        oneLineSummary:    '피드백을 생성하지 못했습니다.',
        goodPoints:        [],
        toFix:             [],
        recommendations:   ['내일 다시 시도해보세요.'],
        momentum:          '',
        conditionAnalysis: '',
      };
    }

    const feedback = {
      ...result,
      generatedAt: FieldValue.serverTimestamp(),
      retryCount:  retryCount + 1,
    };

    await db.doc(`users/${uid}/days/${today}`).set(
      { aiFeedback: feedback, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return feedback;
  });
