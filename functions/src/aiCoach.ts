/**
 * aiCoach — Gemini 기반 격려/위기/주간 인사이트 통합 callable.
 * mode: 'daily' | 'crisis' | 'weekly'
 * 캐시 키: users/{uid}/coach/{date}_{mode}
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { HabitDoc, HabitCheckDoc, DayDoc } from '../../shared/types/firestore';

const db = admin.firestore();
const REGION = 'asia-northeast3';
const KST = 'Asia/Seoul';

type Mode = 'daily' | 'crisis' | 'weekly';

export const aiCoach = functions
  .region(REGION)
  .https
  .onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid: string = context.auth.uid;
    const mode: Mode = (data?.mode ?? 'daily') as Mode;
    const today = format(toZonedTime(new Date(), KST), 'yyyy-MM-dd');
    const cacheKey = `${today}_${mode}`;

    // 캐시 확인 (crisis 는 캐시 없이 매번 생성)
    if (mode !== 'crisis') {
      const cached = await db.doc(`users/${uid}/coach/${cacheKey}`).get();
      if (cached.exists) return cached.data();
    }

    // 최근 N일 데이터 수집
    const days = mode === 'weekly' ? 7 : 5;
    const dateList: string[] = [];
    for (let i = 0; i < days; i++) dateList.push(format(subDays(toZonedTime(new Date(), KST), i), 'yyyy-MM-dd'));

    const [habitsSnap, ...daySnaps] = await Promise.all([
      db.collection(`users/${uid}/habits`).get(),
      ...dateList.map((d) => db.doc(`users/${uid}/days/${d}`).get()),
    ]);
    const habitsMap: Record<string, HabitDoc> = {};
    habitsSnap.docs.forEach((d) => { habitsMap[d.id] = d.data() as HabitDoc; });
    const recentDays = daySnaps.map((s) => s.data() as DayDoc | undefined).filter(Boolean) as DayDoc[];

    // 체크 데이터 수집
    const checks: Array<{ date: string; check: HabitCheckDoc; habit?: HabitDoc }> = [];
    await Promise.all(
      dateList.map(async (d) => {
        const snap = await db.collection(`users/${uid}/days/${d}/habitChecks`).get();
        snap.docs.forEach((doc) => {
          const c = doc.data() as HabitCheckDoc;
          checks.push({ date: d, check: c, habit: habitsMap[c.habitId] });
        });
      }),
    );

    // 회고 데이터
    const reflectionSnaps = await Promise.all(
      dateList.map((d) => db.doc(`users/${uid}/reflections/${d}`).get()),
    );
    const reflections = reflectionSnaps
      .map((s) => s.data())
      .filter(Boolean) as Array<{ date: string; entries: Array<{ habitId: string; mood: number; note?: string }> }>;

    // 프롬프트 빌드
    const dayScoreSummary = recentDays
      .map((d) => `${d.date}: ${d.dayScore ?? '-'}점`)
      .join(', ');
    const reflectionSummary = reflections
      .flatMap((r) => (r.entries ?? []).map((e) => `${e.mood}점${e.note ? ' "' + e.note + '"' : ''}`))
      .slice(0, 5)
      .join(', ');
    const todayChecks = checks.filter((c) => c.date === today);
    const todayAchieved = todayChecks.filter((c) => c.check.achieved).length;
    const todayTotal = Object.keys(habitsMap).length;

    let prompt = '';
    let schemaHint = '';
    let sysInstr = `당신은 한국어로 응답하는 1인 자기관리 코치다.
과장된 칭찬·공허한 위로·이모지·느낌표는 피한다. 데이터 사실에 근거해 짧고 구체적으로 말한다.`;

    if (mode === 'daily') {
      prompt = `최근 ${days}일 dayScore: ${dayScoreSummary}
최근 회고 일부: ${reflectionSummary || '없음'}
오늘 진행: ${todayAchieved}/${todayTotal}
한 줄(30자 이내)로 오늘을 위한 격려 또는 짧은 코칭 한 마디를 작성하라.`;
      schemaHint = '{"message":"…30자 이내…","tone":"encourage|nudge|celebrate"}';
    } else if (mode === 'crisis') {
      const wkLow = recentDays.filter((d) => (d.dayScore ?? 0) < 50).length;
      prompt = `최근 ${days}일 중 ${wkLow}일이 50점 미만.
오늘 ${todayAchieved}/${todayTotal} 진행. 아직 오후이며 핵심 습관이 미체크다.
부드럽게(비난 없이) "지금이라도 1개만 해보자"고 유도하는 1-2문장(60자 이내) 응답을 만들어라.`;
      schemaHint = '{"message":"…1-2문장…","tone":"gentle"}';
    } else {
      // weekly
      const habitStats = Object.values(habitsMap).map((h) => {
        const myChecks = checks.filter((c) => c.check.habitId === h.id);
        const ach = myChecks.filter((c) => c.check.achieved).length;
        return `${h.title}: ${ach}/${myChecks.length}`;
      }).join('\n');
      prompt = `최근 7일 dayScore: ${dayScoreSummary}
습관별 달성:
${habitStats}
회고 요약: ${reflectionSummary || '없음'}

이 사용자의 한 주 패턴을 분석해 (1) 잘된 부분 한 줄 (2) 패턴(요일/시간대) 한 줄 (3) 다음 주 1가지 추천 — 각 80자 이내로 작성하라.`;
      schemaHint = '{"strengths":"…","pattern":"…","recommendation":"…"}';
    }

    const finalPrompt = `${prompt}\n\n반드시 다음 JSON 스키마로만 응답: ${schemaHint}`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new functions.https.HttpsError('internal', 'GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const chat = model.startChat({ systemInstruction: sysInstr });

    let parsed: any;
    try {
      const res = await chat.sendMessage(finalPrompt);
      const text = res.response.text().trim().replace(/```json|```/g, '').trim();
      parsed = JSON.parse(text);
    } catch {
      parsed = mode === 'weekly'
        ? { strengths: '꾸준함', pattern: '데이터 부족', recommendation: '내일도 1개부터' }
        : { message: '오늘도 한 걸음만.', tone: 'encourage' };
    }

    const payload = {
      ...parsed,
      mode,
      generatedAt: FieldValue.serverTimestamp(),
    };

    await db.doc(`users/${uid}/coach/${cacheKey}`).set(payload);
    return payload;
  });
