/**
 * suggestPrayerVerse — 기도제목에 어울리는 성경 구절(개역개정) 추천
 * callable function. 결과는 클라이언트가 검토 후 PrayerDoc.verse 에 저장한다.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callGeminiWithRetry, throwIfRateLimit, GEMINI_MODEL } from './geminiUtil';

const REGION = 'asia-northeast3';

const SYS_INSTRUCTION = `당신은 한국어 기도제목에 어울리는 성경 구절을 추천하는 도우미다.
- 반드시 잘 알려진 구절만 고른다. 확신이 없으면 시편 등 널리 알려진 위로·간구 구절을 보수적으로 선택한다.
- text는 개역개정 본문을 그대로 쓴다. 본문을 창작하거나 바꿔 쓰지 않는다.
- reference는 "시편 46:10" 또는 "빌립보서 4:6-7" 형식의 한국어 책 이름으로 쓴다.
- reason은 이 기도제목과 구절의 연결을 한 줄(40자 이내)로 적는다.
- 출력은 반드시 JSON 스키마만.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['reference', 'text', 'reason'],
  properties: {
    reference: { type: 'string' },
    text:      { type: 'string' },
    reason:    { type: 'string' },
  },
};

const REF_PATTERN = /^[가-힣0-9]+ ?\d+:\d+(-\d+)?$/;

export const suggestPrayerVerse = functions
  .region(REGION)
  .runWith({ secrets: ['GEMINI_API_KEY'], timeoutSeconds: 60 })
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

    const title: string = (data?.title ?? '').toString().trim();
    const body: string = (data?.body ?? '').toString().trim();
    if (!title) {
      throw new functions.https.HttpsError('invalid-argument', 'title이 비어 있습니다.');
    }
    if (title.length + body.length > 1500) {
      throw new functions.https.HttpsError('invalid-argument', '내용이 너무 깁니다.');
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

    const prompt = `다음 기도제목에 어울리는 성경 구절 하나를 추천하라.
기도제목: ${title}${body ? `\n상세: ${body}` : ''}`;

    try {
      const res = await callGeminiWithRetry(() => model.generateContent(prompt));
      const text = res.response.text().trim();
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      const reference = (parsed?.reference ?? '').toString().trim();
      const verseText = (parsed?.text ?? '').toString().trim();
      const reason = (parsed?.reason ?? '').toString().trim().slice(0, 80);

      if (!REF_PATTERN.test(reference) || !verseText || verseText.length > 300) {
        throw new Error(`invalid verse output: ${reference}`);
      }
      return { reference, text: verseText, reason: reason || undefined };
    } catch (e) {
      console.error('suggestPrayerVerse error', e);
      throwIfRateLimit(e);
      throw new functions.https.HttpsError('internal', '말씀 추천에 실패했습니다. 다시 시도해주세요.');
    }
  });
