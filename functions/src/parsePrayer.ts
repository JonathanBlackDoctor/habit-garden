/**
 * parsePrayerBulk — 무더기 기도제목 텍스트를 AI로 사람별·항목별 정리
 * callable function. 저장은 하지 않고 파싱 결과만 반환 (검토는 클라이언트).
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requestGemini, isModelNotFound, isRateLimit, throwIfRateLimit, GEMINI_MODEL, GEMINI_SMART_MODEL } from './geminiUtil';
import { fallbackParsePrayerText } from '../../shared/prayerBulkFallback';

const REGION = 'asia-northeast3';
const BULK_MODELS = [GEMINI_MODEL, 'gemini-2.5-flash-lite', GEMINI_SMART_MODEL] as const;

const SYS_INSTRUCTION = `당신은 한국어 기도 요청 텍스트를 정리하는 도우미다.
- 통일되지 않은 덩어리 텍스트를 "사람(또는 대상) 단위"로 묶는다.
- 한 사람이 여러 기도제목을 가지면 절대 나누지 말고 하나의 항목으로 합친다.
  · title: 그 사람의 이름과 핵심을 담은 한 줄 요약(예: "영희 어머니 수술·영희 취업").
  · bodyLines: 그 사람의 모든 개별 기도제목을 반드시 문자열 배열에 한 제목당 한 요소씩 넣는다. 줄바꿈이 필요한 곳마다 배열 요소를 나눈다. 원문의 기도 내용을 빠짐없이 보존한다. 단일 기도제목도 배열에 1개 요소로 담는다.
  · target: 그 기도의 대상(요청한 사람/누구를 위한 기도인지) 이름. 작성자 본인을 위한 것이면 "나 자신". 불명확하면 빈 문자열.
- 사람이 특정되지 않는 공동체·주제 기도(예: 교회 부흥)는 그 주제 하나를 한 항목으로, target은 그 공동체명(예: "교회 공동체").
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
        required: ['title', 'priority', 'bodyLines'],
        properties: {
          title:      { type: 'string' },
          bodyLines:  { type: 'array', items: { type: 'string' } },
          target:     { type: 'string' },
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
    if (!apiKey) {
      console.error('parsePrayerBulk: GEMINI_API_KEY missing; using text fallback');
      return { items: fallbackParsePrayerText(rawText), fallback: true };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = `아래 텍스트를 사람(대상) 단위로 묶어 정리하라. 한 사람의 여러 제목은 한 항목으로 합쳐라:
"""
${rawText}
"""`;

    // 모델 1개가 할당량 초과·폐기·일시 장애를 겪어도 다른 모델로 계속 시도한다.
    let lastError: unknown;
    for (const modelId of BULK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelId,
          systemInstruction: SYS_INSTRUCTION,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA as any,
          },
        });
        const res = await requestGemini('prayer-bulk-parser', modelId, () => model.generateContent(prompt), {
          retryRateLimit: false,
        });
        const responseText = res.response.text().trim();
        const parsed = JSON.parse(responseText.replace(/^\u0060{3}(?:json)?\s*|\u0060{3}$/g, '').trim());
        const items = Array.isArray(parsed?.items) ? parsed.items : [];

        // 가벼운 정규화 + 방어
        const cleaned = items
          .filter((it: any) => it && typeof it.title === 'string' && it.title.trim())
          .slice(0, 100)
          .map((it: any) => ({
            title: it.title.trim().slice(0, 60),
            // 배열을 프로그램에서 직접 LF로 연결해 AI가 한 줄로 뭉치는 일을 방지한다.
            body: (Array.isArray(it.bodyLines)
              ? it.bodyLines.filter((line: unknown): line is string => typeof line === 'string')
                  .map((line: string) => line.trim().replace(/^[-•]\s*/, ''))
                  .filter(Boolean).map((line: string) => '- ' + line).join('\n')
              : (typeof it.body === 'string' ? it.body.trim() : '')).slice(0, 8000),
            target: typeof it.target === 'string' ? it.target.trim().slice(0, 40) : '',
            priority: ['high', 'mid', 'low'].includes(it.priority) ? it.priority : 'mid',
            confidence: typeof it.confidence === 'number' ? Math.max(0, Math.min(1, it.confidence)) : undefined,
          }));


        if (cleaned.length === 0) throw new Error('Empty AI prayer items');
        return { items: cleaned, fallback: false };
      } catch (e) {
        lastError = e;
        const status = Number((e as any)?.status);
        const retryable = isRateLimit(e) || isModelNotFound(e)
          || [500, 502, 503, 504].includes(status)
          || e instanceof SyntaxError
          || (e instanceof Error && e.message === 'Empty AI prayer items');
        console.warn('parsePrayerBulk model failed', {
          modelId, status: Number.isFinite(status) ? status : null, retryable,
        });
        if (!retryable) break;
      }
    }
    console.error('parsePrayerBulk: AI unavailable; returning reviewable text fallback', {
      status: Number((lastError as any)?.status) || null,
    });
    return { items: fallbackParsePrayerText(rawText), fallback: true };
  });


/**
 * 과거 무더기 AI 기도제목의 줄바꿈만 복구한다.
 * 서버는 원본을 고치거나 저장하지 않는다. 응답 검증 및 Firestore 반영은 클라이언트가 한다.
 */
const REPAIR_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'lines'],
        properties: {
          id: { type: 'string' },
          lines: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

export const repairPrayerBodies = functions
  .region(REGION)
  .runWith({ secrets: ['GEMINI_API_KEY'], timeoutSeconds: 180 })
  .https
  .onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const profSnap = await admin.firestore().doc(`userProfiles/${context.auth.uid}`).get();
    if (!profSnap.exists || profSnap.data()?.status !== 'approved') {
      throw new functions.https.HttpsError('permission-denied', 'Not approved');
    }

    const entries: unknown[] = Array.isArray(data?.items) ? data.items : [];
    if (!entries.length || entries.length > 20) {
      throw new functions.https.HttpsError('invalid-argument', '1~20개의 항목을 입력하세요.');
    }
    const items = entries.map((entry: any) => ({
      id: typeof entry?.id === 'string' ? entry.id : '',
      body: typeof entry?.body === 'string' ? entry.body : '',
    }));
    if (items.some(({ id, body }) => !id || id.length > 128 || !body.trim() || body.length > 800)
        || new Set(items.map(({ id }) => id)).size !== items.length
        || items.reduce((sum, it) => sum + it.body.length, 0) > 8000) {
      throw new functions.https.HttpsError('invalid-argument', '잘못된 본문 또는 입력 길이입니다.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new functions.https.HttpsError('internal', 'GEMINI_API_KEY not set');
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: [
        '당신은 기존 기도제목 텍스트의 줄바꿈만 복구한다.',
        '입력 items마다 같은 id를 유지하고, 독립된 기도 요청마다 lines 배열 요소 하나를 출력한다.',
        '각 요소의 문자와 문장부호, 순서, 하이픈·숫자·불릿을 원문 그대로 유지하라.',
        '절대로 요약·의역·첨삭·추가·삭제하지 마라. 공백이나 줄바꿈 위치만 바꿀 수 있다.',
        '독립된 기도 요청이 분명하지 않으면 원문 전체를 lines의 유일한 요소로 반환하라.',
        'JSON 스키마만 반환하라.',
      ].join('\n'),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: REPAIR_RESPONSE_SCHEMA as any,
      },
    });

    try {
      const response = await requestGemini('prayer-item-parser', GEMINI_MODEL, () =>
        model.generateContent(JSON.stringify({ items })));
      const parsed = JSON.parse(response.response.text().replace(/```json|```/g, '').trim());
      const resultItems: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
      const byId = new Map<string, string[]>();
      for (const it of resultItems) {
        if (typeof it?.id !== 'string' || !Array.isArray(it?.lines)) continue;
        if (it.lines.every((line: unknown) => typeof line === 'string')) {
          byId.set(it.id, it.lines);
        }
      }
      const compact = (s: string) => s.replace(/\s/g, '');
      return {
        items: items.map(({ id, body }) => {
          const lines = byId.get(id)?.map((line) => line.trim()).filter(Boolean) ?? [];
          const joined = lines.join('\n');
          // 공백을 제외한 모든 원본 문자가 정확히 동일할 때만 수정을 허용한다.
          if (lines.length < 2 || compact(body) !== compact(joined)) {
            return { id, body: null };
          }
          return { id, body: joined };
        }),
      };
    } catch (error) {
      console.error('repairPrayerBodies error', error);
      throwIfRateLimit(error);
      throw new functions.https.HttpsError('internal', '기존 기도제목 줄바꿈 복구에 실패했습니다.');
    }
  });
