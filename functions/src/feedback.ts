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
import { callGeminiWithRetry, throwIfRateLimit, GEMINI_MODEL } from './geminiUtil';
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

작성 규칙:
- 각 항목은 반드시 [데이터 인용] → [짧은 해석] → [구체 행동/시사점] 의 흐름으로 1~3문장 작성.
- "잘했어요" 같은 평가 어휘 대신, 숫자·습관명·회고 표현을 직접 인용하라(예: "수면 4점, 에너지 5점").
- 추천 행동은 "언제·무엇을·얼마나"가 들어가야 한다(예: "오늘 22:30 이전 취침, 7시간 확보").
- conditionAnalysis 는 수면/에너지/기분 세 축을 모두 다루고, 어떤 축이 다른 축을 끌어내렸는지 인과를 한 줄로 짚어라.
- goodPoints/toFix 각 항목 길이는 80~140자, recommendations 각 항목 100~160자, conditionAnalysis 는 300~500자, momentum 은 100~180자.
`;

    const schema = {
      type: 'object',
      required: ['oneLineSummary','goodPoints','toFix','recommendations','momentum','conditionAnalysis'],
      properties: {
        oneLineSummary:    { type: 'string', maxLength: 200 },
        goodPoints:        { type: 'array', items: { type: 'string', maxLength: 200 }, maxItems: 4 },
        toFix:             { type: 'array', items: { type: 'string', maxLength: 200 }, maxItems: 4 },
        recommendations:   { type: 'array', items: { type: 'string', maxLength: 220 }, maxItems: 4 },
        momentum:          { type: 'string', maxLength: 240 },
        conditionAnalysis: { type: 'string', maxLength: 600 },
      },
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new functions.https.HttpsError('internal', 'GEMINI_API_KEY not set');

    const sysInstr = `당신은 본인 1인의 일일 데이터를 깊이 분석하는 코치다. 한국어로 응답한다.

기본 원칙:
- 모든 진술은 정량 데이터(점수·습관 달성 여부·회고 문장)를 직접 인용한 뒤 해석한다.
- 과장된 칭찬·공허한 위로·이모지·느낌표는 쓰지 않는다. 단, 사실에 근거한 진전/연속성(스트릭, 추세 개선)은 한 줄로 인정한다.
- 추천 행동은 "언제·무엇을·얼마나"가 모두 들어가도록 구체적·측정 가능해야 한다.

깊이 규칙:
- 각 항목은 한 문장으로 끝내지 말고, 인용 → 해석 → 시사점/행동 의 3단 흐름을 한 단락으로 풀어쓴다.
- 단순 나열("수면 부족, 집중 저하") 대신 인과 관계를 명시한다("수면 4점이 에너지 5점을 끌어내려 오후 집중 습관이 미달성으로 이어졌다").
- conditionAnalysis 는 세 축(수면/에너지/기분) 모두를 다루고, 회고 문장의 표현을 1회 이상 그대로 인용한다.

출력 형식:
- 반드시 지정된 JSON 스키마로만 응답한다. 다른 설명·마크다운·코드펜스 금지.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: sysInstr });

    let result;
    try {
      const chat = model.startChat();
      const res  = await callGeminiWithRetry(() => chat.sendMessage(prompt));
      const text = res.response.text().trim();
      const clean = text.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      throwIfRateLimit(e);
      // 폴백은 저장하지 않는다 → 일 5회 상한 미소진, 기존 피드백 보존.
      const existing = daySnap.data()?.aiFeedback;
      if (existing) return existing;
      return {
        oneLineSummary:    '피드백을 생성하지 못했습니다.',
        goodPoints:        [],
        toFix:             [],
        recommendations:   ['잠시 후 다시 시도해보세요.'],
        momentum:          '',
        conditionAnalysis: '',
        retryCount,
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
