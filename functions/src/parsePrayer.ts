/**
 * parsePrayerBulk — 무더기 기도제목 텍스트를 AI로 사람별·항목별 정리
 * callable function. 저장은 하지 않고 파싱 결과만 반환 (검토는 클라이언트).
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callGeminiWithRetry, throwIfRateLimit, GEMINI_MODEL } from './geminiUtil';

const REGION = 'asia-northeast3';

const SYS_INSTRUCTION = `당신은 한국어 기도 요청 텍스트를 정리하는 도우미다.
- 통일되지 않은 덩어리 텍스트를 "사람(또는 대상) 단위"로 묶는다.
- 한 사람이 여러 기도제목을 가지면 절대 나누지 말고 하나의 항목으로 합친다.
  · title: 그 사람의 이름과 핵심을 담은 한 줄 요약(예: "영희 어머니 수술·영희 취업").
  · body: 그 사람의 모든 기도제목을 한 줄에 하나씩 "- " 로 나열해 원문 표현을 보존.
- 사람이 특정되지 않는 공동체·주제 기도(예: 교회 부흥)는 그 주제 하나를 한 항목으로.
- priority는 단서가 명확할 때만 high/low, 평소엔 mid.
- 추측으로 내용을 지어내지 않는다. 출력은 반드시 JSON 스키마만.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'priority'],
        properties: {
          title:      { type: 'string' },
          body:       { type: 'string' },
          priority:   { type: 'string', enum: ['high', 'mid', 'low'] },
          confidence: { type: 'number' },
        },
      },
    },
  },
};

export const parsePrayerBulk = functions
  .region(REGION)
  .runWith({ secrets: ['GEMINI_API_KEY'], timeoutSeconds: 300 })
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
        // 타입 정의가 enum/Schema를 강하게 요구해 any 캐스팅
        responseSchema: RESPONSE_SCHEMA as any,
      },
    });

    const prompt = `아래 텍스트를 사람(대상) 단위로 묶어 정리하라. 한 사람의 여러 제목은 한 항목으로 합쳐라:
"""
${rawText}
"""`;

    try {
      const chat = model.startChat();
      const res  = await callGeminiWithRetry(() => chat.sendMessage(prompt));
      const text = res.response.text().trim();
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      // 가벼운 정규화 + 방어
      const cleaned = items
        .filter((it: any) => it && typeof it.title === 'string' && it.title.trim())
        .slice(0, 100)
        .map((it: any) => ({
          title: it.title.trim().slice(0, 60),
          body: typeof it.body === 'string' ? it.body.trim().slice(0, 600) : '',
          priority: ['high', 'mid', 'low'].includes(it.priority) ? it.priority : 'mid',
          confidence: typeof it.confidence === 'number' ? Math.max(0, Math.min(1, it.confidence)) : undefined,
        }));

      return { items: cleaned };
    } catch (e) {
      console.error('parsePrayerBulk error', e);
      throwIfRateLimit(e);
      throw new functions.https.HttpsError('internal', 'AI 정리에 실패했습니다.');
    }
  });
