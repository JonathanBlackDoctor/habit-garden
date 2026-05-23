/**
 * findDuplicatePrayers — 활성 기도제목에서 "사실상 같은 사람·같은 주제"의 중복 그룹을 찾는다 (A3).
 * callable. 저장/병합은 하지 않고 그룹 후보만 반환 (병합은 클라이언트에서 확인 후).
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callGeminiWithRetry, throwIfRateLimit, GEMINI_MODEL } from './geminiUtil';
import type { PrayerDoc } from '../../shared/types/firestore';

const REGION = 'asia-northeast3';
const MAX_ITEMS = 200;

const SYS_INSTRUCTION = `당신은 한국어 기도제목 목록에서 중복을 찾는 도우미다.
- "같은 사람의 같은 주제"이거나 의미가 충분히 겹치는 항목들만 한 그룹으로 묶는다.
- 서로 다른 사람이거나 다른 주제이면 절대 묶지 않는다. 애매하면 묶지 않는다.
- 각 그룹은 반드시 2개 이상의 id를 포함한다.
- reason은 왜 중복인지 한 줄 한국어로.
- 출력은 반드시 JSON 스키마만.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['groups'],
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        required: ['ids', 'reason'],
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
      },
    },
  },
};

export const findDuplicatePrayers = functions
  .region(REGION)
  .runWith({ secrets: ['GEMINI_API_KEY'] })
  .https
  .onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const db = admin.firestore();
    const uid = context.auth.uid;
    const profSnap = await db.doc(`userProfiles/${uid}`).get();
    if (!profSnap.exists || profSnap.data()?.status !== 'approved') {
      throw new functions.https.HttpsError('permission-denied', 'Not approved');
    }

    const snap = await db.collection(`users/${uid}/prayers`).where('status', '==', 'active').get();
    const items = snap.docs.slice(0, MAX_ITEMS).map((d) => {
      const p = d.data() as PrayerDoc;
      return { id: d.id, personName: p.personName ?? '', title: p.title ?? '', body: p.body ?? '' };
    });
    if (items.length < 2) return { groups: [] };

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

    const list = items
      .map((it) => `- [${it.id}] (${it.personName || '?'}) ${it.title}${it.body ? ' / ' + it.body : ''}`)
      .join('\n');

    try {
      const chat = model.startChat();
      const res = await callGeminiWithRetry(() => chat.sendMessage(`다음 활성 기도제목들에서 중복 그룹을 찾아라:\n${list}`));
      const text = res.response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);

      const validIds = new Set(items.map((i) => i.id));
      const groups = (Array.isArray(parsed?.groups) ? parsed.groups : [])
        .map((g: any) => ({
          ids: (Array.isArray(g?.ids) ? g.ids : []).filter((id: unknown) => typeof id === 'string' && validIds.has(id)),
          reason: typeof g?.reason === 'string' ? g.reason.slice(0, 120) : '',
        }))
        .filter((g: any) => g.ids.length >= 2)
        .slice(0, 20);

      return { groups };
    } catch (e) {
      console.error('findDuplicatePrayers error', e);
      throwIfRateLimit(e);
      throw new functions.https.HttpsError('internal', '중복 분석에 실패했습니다.');
    }
  });
