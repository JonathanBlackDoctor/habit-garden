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
import { callGeminiWithRetry, throwIfRateLimit } from './geminiUtil';
import type { HabitDoc, HabitCheckDoc, DayDoc } from '../../shared/types/firestore';

const db = admin.firestore();
const REGION = 'asia-northeast3';
const KST = 'Asia/Seoul';

type Mode = 'daily' | 'crisis' | 'weekly';

export const aiCoach = functions
  .region(REGION)
  .runWith({ secrets: ['GEMINI_API_KEY'] })
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

원칙:
- 모든 진술은 주어진 데이터(점수·달성 비율·회고 문장)를 직접 인용한 뒤 해석한다.
- 과장된 칭찬·공허한 위로·이모지·느낌표는 쓰지 않는다.
- 단순 한 줄 결론 대신, [관찰] → [해석/인과] → [구체 행동] 의 흐름을 짧은 단락으로 풀어쓴다.
- 행동 제안은 "언제·무엇을·얼마나"가 들어가야 한다.
- 반드시 지정된 JSON 스키마로만 응답한다. 코드펜스·설명 금지.`;

    if (mode === 'daily') {
      prompt = `최근 ${days}일 dayScore: ${dayScoreSummary}
최근 회고 일부: ${reflectionSummary || '없음'}
오늘 진행: ${todayAchieved}/${todayTotal}

오늘을 위한 코칭 한마디를 2~3문장(120~180자)으로 작성하라.
- 첫 문장: 최근 점수 추세나 회고 표현을 직접 인용.
- 둘째 문장: 그 데이터가 오늘 어떤 의미인지(인과·시사점) 해석.
- (선택) 셋째 문장: 오늘 당장 할 수 있는 1가지 구체 행동.
tone 은 격려(encourage)/슬쩍 자극(nudge)/축하(celebrate) 중 데이터에 맞춰 선택.`;
      schemaHint = '{"message":"…2~3문장 120~180자…","tone":"encourage|nudge|celebrate"}';
    } else if (mode === 'crisis') {
      const wkLow = recentDays.filter((d) => (d.dayScore ?? 0) < 50).length;
      prompt = `최근 ${days}일 중 ${wkLow}일이 50점 미만.
오늘 ${todayAchieved}/${todayTotal} 진행. 아직 오후이며 핵심 습관이 미체크다.

비난 없이 부드럽게 다가가는 2~3문장(140~200자) 메시지를 작성하라.
- 첫 문장: 지금 상황을 사실 그대로 짧게 짚는다(예: "오늘 ${todayAchieved}/${todayTotal} 진행 중").
- 둘째 문장: 부담을 덜어주는 해석("완벽이 아니라 하나라도 한 걸음").
- 셋째 문장: 지금 30초 안에 할 수 있는 가장 작은 1개 행동을 구체적으로 제안.`;
      schemaHint = '{"message":"…2~3문장 140~200자…","tone":"gentle"}';
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

한 주 패턴을 분석해 세 필드를 각 2~3문장(150~250자)으로 작성하라.
(1) strengths: 어떤 습관·어떤 점수가 어떻게 좋았는지 숫자를 인용해 짚고, 그게 왜 의미 있는지 한 줄 해석.
(2) pattern: 요일·시간대·습관 간 상관 등 구체적 패턴을 데이터와 함께 제시(예: "주중 dayScore 평균 72 vs 주말 58").
(3) recommendation: 다음 주에 시도할 1가지를 "언제·무엇을·얼마나"로 구체화하고, 왜 그게 효과적인지 한 줄 근거.`;
      schemaHint = '{"strengths":"…2~3문장…","pattern":"…2~3문장…","recommendation":"…2~3문장…"}';
    }

    const finalPrompt = `${prompt}\n\n반드시 다음 JSON 스키마로만 응답: ${schemaHint}`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new functions.https.HttpsError('internal', 'GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: sysInstr });
    const chat = model.startChat();

    let parsed: any;
    let isFallback = false;
    try {
      const res = await callGeminiWithRetry(() => chat.sendMessage(finalPrompt));
      const text = res.response.text().trim().replace(/```json|```/g, '').trim();
      parsed = JSON.parse(text);
    } catch (e) {
      throwIfRateLimit(e);
      isFallback = true;
      parsed = mode === 'weekly'
        ? { strengths: '꾸준함', pattern: '데이터 부족', recommendation: '내일도 1개부터' }
        : { message: '오늘도 한 걸음만.', tone: 'encourage' };
    }

    const payload = {
      ...parsed,
      mode,
      generatedAt: FieldValue.serverTimestamp(),
    };

    // 폴백 응답은 캐시에 굳히지 않는다 (할당량 회복 후 다음 호출에서 실제 응답 생성).
    if (!isFallback) {
      await db.doc(`users/${uid}/coach/${cacheKey}`).set(payload);
    }
    return payload;
  });
