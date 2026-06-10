/**
 * suggestPrayerVerse — 기도제목에 어울리는 성경 구절(개역개정) 추천
 * callable function. 결과는 클라이언트가 검토 후 PrayerDoc.verse 에 저장한다.
 *
 * 입력:
 *  - 단건: { title, body? }                          → { reference, text, reason }
 *  - 일괄: { items: [{ id, title, body? }] } (≤20개) → { items: [{ id, reference, text, reason }] }
 *    여러 건을 한 번의 Gemini 호출로 처리해 레이트리밋 부담을 줄인다.
 *
 * 무료 티어 쿼터는 "프로젝트+모델" 단위로 분리된다. 다른 AI 기능들
 * (aiCoach·morningBrief 등)이 전부 GEMINI_MODEL(gemini-2.5-flash)을 쓰며
 * 일일 쿼터를 소진하므로, 말씀 추천은 그와 겹치지 않는 모델 체인을
 * 순서대로 시도한다. 체인이 전부 레이트리밋이면 키워드 기반의
 * 기본 말씀을 돌려줘 버튼이 항상 동작하게 한다.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { isRateLimit, isModelNotFound } from './geminiUtil';

const REGION = 'asia-northeast3';
/** 쿼터 버킷이 서로(그리고 GEMINI_MODEL과) 분리된 무료 티어 모델 체인 */
const VERSE_MODELS = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3-flash'];
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

/** 체인의 모델을 순서대로 시도. 레이트리밋·모델 없음이면 다음 모델로 넘어간다. */
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
  let lastErr: unknown = null;
  for (const modelId of VERSE_MODELS) {
    try {
      return await build(modelId).generateContent(prompt);
    } catch (e) {
      if (!isRateLimit(e) && !isModelNotFound(e)) throw e;
      console.warn(`suggestPrayerVerse: ${modelId} unavailable, trying next —`, String((e as any)?.message ?? e));
      lastErr = e;
    }
  }
  throw lastErr;
}

// ── AI 불가 시 기본 말씀(개역개정) — 키워드 매칭 → 없으면 일반 구절 순환 ──
interface FallbackEntry { keywords?: RegExp; reference: string; text: string; reason: string }

const KEYWORD_VERSES: FallbackEntry[] = [
  {
    keywords: /건강|치유|병|수술|아프|회복|투병|쾌유/,
    reference: '야고보서 5:15',
    text: '믿음의 기도는 병든 자를 구원하리니 주께서 그를 일으키시리라 혹시 죄를 범하였을지라도 사하심을 받으리라',
    reason: '치유를 구하는 믿음의 기도를 격려하는 말씀',
  },
  {
    keywords: /두려|무서|담대|용기/,
    reference: '이사야 41:10',
    text: '두려워하지 말라 내가 너와 함께 함이라 놀라지 말라 나는 네 하나님이 됨이라 내가 너를 굳세게 하리라 참으로 너를 도와 주리라 참으로 나의 의로운 오른손으로 너를 붙들리라',
    reason: '두려움 앞에서 함께하시는 하나님의 약속',
  },
  {
    keywords: /진로|결정|선택|인도|지혜|방향|길/,
    reference: '잠언 3:5-6',
    text: '너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라 너는 범사에 그를 인정하라 그리하면 네 길을 지도하시리라',
    reason: '길을 구할 때 인도하심을 약속하는 말씀',
  },
  {
    keywords: /감사/,
    reference: '데살로니가전서 5:16-18',
    text: '항상 기뻐하라 쉬지 말고 기도하라 범사에 감사하라 이것이 그리스도 예수 안에서 너희를 향하신 하나님의 뜻이니라',
    reason: '감사와 기도를 향한 하나님의 뜻',
  },
  {
    keywords: /지치|피곤|쉼|휴식|번아웃|힘들/,
    reference: '마태복음 11:28',
    text: '수고하고 무거운 짐 진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라',
    reason: '지친 마음에 쉼을 주시는 초대의 말씀',
  },
  {
    keywords: /시작|도전|새로|이사|이직|출발/,
    reference: '여호수아 1:9',
    text: '내가 네게 명령한 것이 아니냐 강하고 담대하라 두려워하지 말며 놀라지 말라 네가 어디로 가든지 네 하나님 여호와가 너와 함께 하느니라',
    reason: '새로운 걸음에 담대함을 주는 말씀',
  },
  {
    keywords: /직장|일자리|사업|취업|시험|학업|합격|공부/,
    reference: '마태복음 6:33',
    text: '그런즉 너희는 먼저 그의 나라와 그의 의를 구하라 그리하면 이 모든 것을 너희에게 더하시리라',
    reason: '우선순위를 하나님 나라에 둘 때의 약속',
  },
  {
    keywords: /염려|걱정|불안|평안|마음/,
    reference: '빌립보서 4:6-7',
    text: '아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로, 너희 구할 것을 감사함으로 하나님께 아뢰라 그리하면 모든 지각에 뛰어난 하나님의 평강이 그리스도 예수 안에서 너희 마음과 생각을 지키시리라',
    reason: '염려 대신 기도로 맡길 때 평강을 약속해요',
  },
];

const GENERAL_VERSES: FallbackEntry[] = [
  {
    reference: '시편 23:1',
    text: '여호와는 나의 목자시니 내게 부족함이 없으리로다',
    reason: '언제나 돌보시는 목자 되신 하나님',
  },
  {
    reference: '시편 46:1',
    text: '하나님은 우리의 피난처시요 힘이시니 환난 중에 만날 큰 도움이시라',
    reason: '환난 중의 피난처가 되시는 하나님',
  },
  {
    reference: '로마서 8:28',
    text: '우리가 알거니와 하나님을 사랑하는 자 곧 그의 뜻대로 부르심을 입은 자들에게는 모든 것이 합력하여 선을 이루느니라',
    reason: '모든 것이 합력하여 선을 이루는 약속',
  },
  {
    reference: '시편 121:1-2',
    text: '내가 산을 향하여 눈을 들리라 나의 도움이 어디서 올까 나의 도움은 천지를 지으신 여호와에게서로다',
    reason: '도움이 여호와께로부터 옴을 고백하는 말씀',
  },
];

function fallbackVerse(title: string, body: string, salt = 0): { reference: string; text: string; reason: string } {
  const haystack = `${title} ${body}`;
  const hit = KEYWORD_VERSES.find((v) => v.keywords!.test(haystack));
  const { reference, text, reason } = hit ?? GENERAL_VERSES[(haystack.length + salt) % GENERAL_VERSES.length];
  return { reference, text, reason };
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
        if (isRateLimit(e)) {
          // 모든 모델이 쿼터 초과 — 기본 말씀이라도 연결해 기능이 멈추지 않게
          return { items: items.map((it, i) => ({ id: it.id, ...fallbackVerse(it.title, it.body, i) })) };
        }
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
      if (isRateLimit(e)) return fallbackVerse(title, body);
      throw new functions.https.HttpsError('internal', '말씀 추천에 실패했습니다. 다시 시도해주세요.');
    }
  });
