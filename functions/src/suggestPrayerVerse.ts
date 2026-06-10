/**
 * suggestPrayerVerse — 기도제목에 어울리는 성경 구절(개역개정) 추천
 * callable function. 결과는 클라이언트가 검토 후 PrayerDoc.verse 에 저장한다.
 *
 * 입력:
 *  - 단건: { title, body? }                          → { reference, text, reason }
 *  - 일괄: { items: [{ id, title, body? }] } (≤20개) → { items: [{ id, reference, text, reason }] }
 *    여러 건을 한 번의 Gemini 호출로 처리해 레이트리밋 부담을 줄인다.
 *
 * 무료 티어 쿼터는 모델별로 분리되므로, 주 모델이 레이트리밋이면
 * 보조 모델로 1회 폴백한 뒤에야 resource-exhausted 를 던진다.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callGeminiWithRetry, throwIfRateLimit, isRateLimit, GEMINI_MODEL } from './geminiUtil';

const REGION = 'asia-northeast3';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const MAX_BATCH = 20;

const SYS_INSTRUCTION = `당신은 한국어 기도제목에 어울리는 성경 구절을 추천하는 도우미다.
- 반드시 잘 알려진 구절만 고른다. 확신이 없으면 시편 등 널리 알려진 위로·간구 구절을 보수적으로 선택한다.
- text는 개역개정 본문을 그대로 쓴다. 본문을 창작하거나 바꿔 쓰지 않는다.
- reference는 "시편 46:10" 또는 "빌립보서 4:6-7" 형식의 한국어 책 이름으로 쓴다.
- reason은 이 기도제목과 구절의 연결을 한 줄(40자 이내)로 적는다.
- 출력은 반드시 JSON 스키마만.`;

const VERSE_PROPS = {
  reference: { type: 'string' },
  text:      { type: 'string' },
  reason:    { type: 'string' },
};

const SINGLE_SCHEMA = {
  type: 'object',
  required: ['reference', 'text', 'reason'],
  properties: VERSE_PROPS,
};

const BATCH_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'reference', 'text', 'reason'],
        properties: { id: { type: 'string' }, ...VERSE_PROPS },
      },
    },
  },
};

const REF_PATTERN = /^[가-힣0-9]+ ?\d+:\d+(-\d+)?$/;

/** 주 모델 호출(429 시 1회 재시도 포함) → 그래도 레이트리밋이면 보조 모델로 폴백 */
async function generateWithFallback(apiKey: string, schema: object, prompt: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const build = (modelId: string) =>
    genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: SYS_INSTRUCTION,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema as any,
      },
    });
  try {
    return await callGeminiWithRetry(() => build(GEMINI_MODEL).generateContent(prompt));
  } catch (e) {
    if (!isRateLimit(e)) throw e;
    console.warn(`suggestPrayerVerse: ${GEMINI_MODEL} rate-limited, falling back to ${FALLBACK_MODEL}`);
    return await build(FALLBACK_MODEL).generateContent(prompt);
  }
}

function parseJson(raw: string): any {
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

function cleanVerse(v: any): { reference: string; text: string; reason?: string } | null {
  const reference = (v?.reference ?? '').toString().trim();
  const text = (v?.text ?? '').toString().trim();
  const reason = (v?.reason ?? '').toString().trim().slice(0, 80);
  if (!REF_PATTERN.test(reference) || !text || text.length > 300) return null;
  return { reference, text, reason: reason || undefined };
}

export const suggestPrayerVerse = functions
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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new functions.https.HttpsError('internal', 'GEMINI_API_KEY not set');

    // ── 일괄 모드 ──────────────────────────────────────────
    if (Array.isArray(data?.items)) {
      const items = (data.items as any[])
        .map((it) => ({
          id: (it?.id ?? '').toString().trim(),
          title: (it?.title ?? '').toString().trim().slice(0, 200),
          body: (it?.body ?? '').toString().trim().slice(0, 400),
        }))
        .filter((it) => it.id && it.title)
        .slice(0, MAX_BATCH);
      if (items.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'items가 비어 있습니다.');
      }

      const list = items
        .map((it) => `- id: ${it.id}\n  기도제목: ${it.title}${it.body ? `\n  상세: ${it.body}` : ''}`)
        .join('\n');
      const prompt = `다음 기도제목 각각에 어울리는 성경 구절을 하나씩 추천하라.
응답의 id는 입력의 id를 그대로 사용한다.
${list}`;

      try {
        const res = await generateWithFallback(apiKey, BATCH_SCHEMA, prompt);
        const parsed = parseJson(res.response.text());
        const knownIds = new Set(items.map((it) => it.id));
        const out: Array<{ id: string; reference: string; text: string; reason?: string }> = [];
        for (const it of Array.isArray(parsed?.items) ? parsed.items : []) {
          const id = (it?.id ?? '').toString();
          if (!knownIds.has(id)) continue;
          const verse = cleanVerse(it);
          if (verse) out.push({ id, ...verse });
        }
        if (out.length === 0) throw new Error('no valid verses in batch output');
        return { items: out };
      } catch (e) {
        console.error('suggestPrayerVerse batch error', e);
        throwIfRateLimit(e);
        throw new functions.https.HttpsError('internal', '말씀 추천에 실패했습니다. 다시 시도해주세요.');
      }
    }

    // ── 단건 모드 ──────────────────────────────────────────
    const title: string = (data?.title ?? '').toString().trim();
    const body: string = (data?.body ?? '').toString().trim();
    if (!title) {
      throw new functions.https.HttpsError('invalid-argument', 'title이 비어 있습니다.');
    }
    if (title.length + body.length > 1500) {
      throw new functions.https.HttpsError('invalid-argument', '내용이 너무 깁니다.');
    }

    const prompt = `다음 기도제목에 어울리는 성경 구절 하나를 추천하라.
기도제목: ${title}${body ? `\n상세: ${body}` : ''}`;

    try {
      const res = await generateWithFallback(apiKey, SINGLE_SCHEMA, prompt);
      const verse = cleanVerse(parseJson(res.response.text()));
      if (!verse) throw new Error('invalid verse output');
      return verse;
    } catch (e) {
      console.error('suggestPrayerVerse error', e);
      throwIfRateLimit(e);
      throw new functions.https.HttpsError('internal', '말씀 추천에 실패했습니다. 다시 시도해주세요.');
    }
  });
