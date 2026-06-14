/**
 * parseApplication — 큐티·설교·묵상 노트 텍스트를 AI로 정리
 * callable function. 저장은 하지 않고 정리 결과만 반환 (검토·선택은 클라이언트).
 *   입력: rawText(정리·요약 노트)
 *   출력: reference(본문), insight(깨달은 말씀 한두 줄),
 *         applications(서로 다른 구체적 적용점 여러 개 — 사용자가 골라 쓰도록),
 *         targetDays(추천 실천 목표일)
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callGeminiWithRetry, throwIfRateLimit, GEMINI_MODEL } from './geminiUtil';

const REGION = 'asia-northeast3';

const SYS_INSTRUCTION = `당신은 한국어 큐티·설교·말씀묵상 노트를 정리하는 신앙 도우미다.
사용자가 붙여넣은 노트(요약·필기 덩어리)를 읽고 다음을 추출한다.
- reference: 다룬 성경 본문. 명시돼 있으면 "책 장:절" 형식으로(예: "요한복음 3:16"). 없으면 빈 문자열.
- insight: 이 말씀에서 깨달은 핵심을 한두 문장으로. 노트에 근거해 요약하되 새로 지어내지 않는다.
- applications: 삶에서 실천할 "구체적 적용점"을 3~5개 제시한다.
  · 서로 겹치지 않게 다양한 각도(관계·습관·마음·시간·섬김 등)로.
  · 각 항목은 측정·실행 가능한 한 문장의 행동(예: "매일 아침 가족에게 먼저 한마디 격려하기").
  · 노트의 메시지에 충실하되, 사용자가 골라 쓸 수 있도록 선택지를 풍성하게.
- targetDays: 이 적용을 며칠간 꾸준히 실천하면 좋을지 추천(7~21 사이 정수, 기본 7).
추측으로 본문·내용을 지어내지 않는다. 출력은 반드시 JSON 스키마만.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['applications'],
  properties: {
    reference:   { type: 'string' },
    insight:     { type: 'string' },
    applications: { type: 'array', items: { type: 'string' } },
    targetDays:  { type: 'number' },
  },
};

export const parseApplication = functions
  .region(REGION)
  .runWith({ secrets: ['GEMINI_API_KEY'], timeoutSeconds: 120 })
  .https
  .onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const db = admin.firestore();
    const profSnap = await db.doc(`userProfiles/${context.auth.uid}`).get();
    if (!profSnap.exists || profSnap.data()?.status !== 'approved') {
      throw new functions.https.HttpsError('permission-denied', 'Not approved');
    }

    const rawText: string = (data?.rawText ?? '').toString().trim();
    if (!rawText) {
      throw new functions.https.HttpsError('invalid-argument', 'rawText가 비어 있습니다.');
    }
    if (rawText.length > 8000) {
      throw new functions.https.HttpsError('invalid-argument', '텍스트가 너무 깁니다 (최대 8000자).');
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new functions.https.HttpsError('internal', 'GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYS_INSTRUCTION,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA as any,
      },
    });

    const prompt = `아래 노트를 읽고 본문·깨달음·다양한 적용점·추천 실천일수를 정리하라:
"""
${rawText}
"""`;

    try {
      const chat = model.startChat();
      const res  = await callGeminiWithRetry(() => chat.sendMessage(prompt));
      const text = res.response.text().trim();
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      const applications: string[] = Array.isArray(parsed?.applications)
        ? parsed.applications
            .filter((a: any) => typeof a === 'string' && a.trim())
            .slice(0, 6)
            .map((a: string) => a.trim().slice(0, 200))
        : [];

      const targetDaysRaw = typeof parsed?.targetDays === 'number' ? Math.round(parsed.targetDays) : 7;
      const targetDays = Math.max(1, Math.min(60, targetDaysRaw || 7));

      return {
        reference: typeof parsed?.reference === 'string' ? parsed.reference.trim().slice(0, 80) : '',
        insight: typeof parsed?.insight === 'string' ? parsed.insight.trim().slice(0, 400) : '',
        applications,
        targetDays,
      };
    } catch (e) {
      console.error('parseApplication error', e);
      throwIfRateLimit(e);
      throw new functions.https.HttpsError('internal', 'AI 정리에 실패했습니다.');
    }
  });
