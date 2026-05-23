/**
 * morningBrief — 매일 06:00 KST.
 * 각 승인 사용자에게 개인화된 모닝 브리프를 생성한다.
 *  1. 최근 7일 dayScore·어제 점수·스트릭·핵심 습관 수집
 *  2. Gemini 로 한두 문장 격려/코칭 생성 (실패 시 규칙 기반 fallback)
 *  3. 오늘 DayDoc.morningBrief 에 저장
 *  4. FCM 푸시 발송
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { callGeminiWithRetry, GEMINI_MODEL } from './geminiUtil';
import type { HabitDoc, DayDoc, ProgressDoc, NotificationTokenDoc } from '../../shared/types/firestore';

const db = admin.firestore();
const REGION = 'asia-northeast3';
const KST = 'Asia/Seoul';

export const morningBrief = functions
  .region(REGION)
  .runWith({ secrets: ['GEMINI_API_KEY'] })
  .pubsub
  .schedule('0 6 * * *')
  .timeZone(KST)
  .onRun(async () => {
    const now = toZonedTime(new Date(), KST);
    const today = format(now, 'yyyy-MM-dd');
    const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');
    const recentDates: string[] = [];
    for (let i = 1; i <= 7; i++) recentDates.push(format(subDays(now, i), 'yyyy-MM-dd'));

    const profilesSnap = await db.collection('userProfiles').where('status', '==', 'approved').get();
    await Promise.all(profilesSnap.docs.map((d) => processUser(d.id, today, yesterday, recentDates)));
    console.log(`morningBrief complete: today=${today}, users=${profilesSnap.size}`);
    return null;
  });

async function processUser(uid: string, today: string, yesterday: string, recentDates: string[]) {
  try {
    const [habitsSnap, progSnap, ...daySnaps] = await Promise.all([
      db.collection(`users/${uid}/habits`).get(),
      db.doc(`users/${uid}/progress/main`).get(),
      ...recentDates.map((d) => db.doc(`users/${uid}/days/${d}`).get()),
    ]);

    const habits = habitsSnap.docs.map((h) => h.data() as HabitDoc).filter((h) => h.active);
    if (habits.length === 0) return;

    const prog = progSnap.exists ? (progSnap.data() as ProgressDoc) : null;
    const streak = prog?.globalStreak ?? 0;

    const recentScores = daySnaps
      .map((s) => (s.exists ? (s.data() as DayDoc).dayScore ?? 0 : 0));
    const yesterdayScore = recentScores[0] ?? 0;
    const avg = recentScores.length ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : 0;

    const top3 = [...habits].sort((a, b) => b.weight - a.weight).slice(0, 3);

    const message = await buildMessage({ avg, yesterdayScore, streak, topTitles: top3.map((h) => h.title) });

    const brief = {
      message,
      priorityHabits: top3.map((h) => ({ id: h.id, title: h.title })),
      yesterdayScore,
      streak,
      generatedAt: FieldValue.serverTimestamp(),
    };

    await db.doc(`users/${uid}/days/${today}`).set(
      { date: today, morningBrief: brief, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    // 푸시
    const tokenSnap = await db.collection(`users/${uid}/notifications`).get();
    const tokens = tokenSnap.docs.map((d) => (d.data() as NotificationTokenDoc).token).filter(Boolean);
    if (tokens.length > 0) {
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: '☀️ 오늘의 브리프',
          body: top3.map((h) => h.title).join(' · '),
        },
        data: { date: today, action: 'morning_brief' },
        webpush: { fcmOptions: { link: '/habit-garden/' } },
      });
    }
  } catch (e) {
    console.error(`morningBrief failed for uid=${uid}:`, e);
  }
}

interface BriefCtx {
  avg: number;
  yesterdayScore: number;
  streak: number;
  topTitles: string[];
}

async function buildMessage(ctx: BriefCtx): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const fallback = fallbackMessage(ctx);
  if (!apiKey) return fallback;

  try {
    const sysInstr = `당신은 한국어로 응답하는 1인 자기관리 코치다.
과장된 칭찬·공허한 위로·이모지·느낌표 남발은 피한다. 데이터에 근거해 따뜻하고 구체적으로 말한다.`;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: sysInstr });
    const chat = model.startChat();
    const prompt = `사용자의 오늘 아침 데이터:
- 최근 7일 평균 점수: ${ctx.avg}점
- 어제 점수: ${ctx.yesterdayScore}점
- 현재 연속일(스트릭): ${ctx.streak}일
- 오늘 핵심 습관: ${ctx.topTitles.join(', ')}

이 사용자를 위한 모닝 브리프를 1-2문장(70자 이내)으로 작성하라.
반드시 다음 JSON 스키마로만 응답: {"message":"…70자 이내…"}`;
    const res = await callGeminiWithRetry(() => chat.sendMessage(prompt));
    const text = res.response.text().trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    return typeof parsed.message === 'string' && parsed.message.trim() ? parsed.message.trim() : fallback;
  } catch (e) {
    console.error('morningBrief Gemini error:', e);
    return fallback;
  }
}

function fallbackMessage(ctx: BriefCtx): string {
  if (ctx.streak >= 7) return `${ctx.streak}일째 이어지고 있어요. 오늘은 ${ctx.topTitles[0] ?? '핵심 습관'}부터 가볍게 시작해봐요.`;
  if (ctx.yesterdayScore >= 70) return `어제 흐름이 좋았어요. 오늘도 ${ctx.topTitles[0] ?? '한 가지'}만 챙기면 충분합니다.`;
  if (ctx.yesterdayScore < 40) return `어제는 조금 아쉬웠죠. 오늘은 ${ctx.topTitles[0] ?? '하나'}만 해내도 다시 출발이에요.`;
  return `새 하루예요. 오늘 ${ctx.topTitles.slice(0, 2).join(', ') || '핵심 습관'}에 집중해봐요.`;
}
