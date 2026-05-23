/**
 * parsePrayerBulk — 무더기 기도제목 텍스트를 AI로 사람별·항목별 정리
 * callable function. 저장은 하지 않고 파싱 결과만 반환 (검토는 클라이언트).
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const REGION = 'asia-northeast3';

const SYS_INSTRUCTION = `당신은 한국어 기도 요청 텍스트를 정리하는 도우미다.
- 통일되지 않은 덩어리 텍스트를 "사람별·항목별"로 분리한다.
- 한 사람이 여러 기도제목을 가질 수 있다 → 항목마다 별도 카드.
- 대상자 이름을 추출한다. 불명확하면 personName=""로 두고 비워둔다.
- knownPeople 목록과 이름이 같거나 유사하면 그 표기를 그대로 쓴다(중복 매칭).
- category는 self/family/church/ministry/friend/other 중 보수적으로 추정.
- priority는 단서가 명확할 때만 high/low, 평소엔 mid.
- title은 12~20자 내외 핵심 요약, body에는 원문 표현을 보존.
- 추측으로 내용을 지어내지 않는다. 출력은 반드시 JSON 스키마만.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['personName', 'category', 'title', 'priority'],
        properties: {
          personName: { type: 'string' },
          category:   { type: 'string', enum: ['self', 'family', 'church', 'ministry', 'friend', 'other'] },
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
  .runWith({ secrets: ['GEMINI_API_KEY'] })
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
    const knownPeople: string[] = Array.isArray(data?.knownPeople)
      ? data.knownPeople.filter((x: unknown) => typeof x === 'string').slice(0, 200)
      : [];

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new functions.https.HttpsError('internal', 'GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYS_INSTRUCTION,
      generationConfig: {
        responseMimeType: 'application/json',
        // 타입 정의가 enum/Schema를 강하게 요구해 any 캐스팅
        responseSchema: RESPONSE_SCHEMA as any,
      },
    });

    const prompt = `knownPeople: ${JSON.stringify(knownPeople)}

아래 텍스트를 정리하라:
"""
${rawText}
"""`;

    try {
      const chat = model.startChat();
      const res  = await chat.sendMessage(prompt);
      const text = res.response.text().trim();
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      // 가벼운 정규화 + 방어
      const cleaned = items
        .filter((it: any) => it && typeof it.title === 'string' && it.title.trim())
        .slice(0, 100)
        .map((it: any) => ({
          personName: typeof it.personName === 'string' ? it.personName.trim() : '',
          category: ['self', 'family', 'church', 'ministry', 'friend', 'other'].includes(it.category)
            ? it.category : 'other',
          title: it.title.trim().slice(0, 60),
          body: typeof it.body === 'string' ? it.body.trim().slice(0, 400) : '',
          priority: ['high', 'mid', 'low'].includes(it.priority) ? it.priority : 'mid',
          confidence: typeof it.confidence === 'number' ? Math.max(0, Math.min(1, it.confidence)) : undefined,
        }));

      return { items: cleaned };
    } catch (e) {
      console.error('parsePrayerBulk error', e);
      throw new functions.https.HttpsError('internal', 'AI 정리에 실패했습니다.');
    }
  });
