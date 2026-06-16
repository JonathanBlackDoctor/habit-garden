/**
 * generatePrayerWeekly — 매주 일요일 21:00 KST 실행 (A1).
 * 지난 7일의 기도 데이터를 집계하고 Gemini로 한 줄 격려를 생성해
 * users/{uid}/prayerWeekly/{weekId} 에 저장한다. 활동이 없으면 건너뛴다.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { subDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callGeminiWithRetry, GEMINI_MODEL } from './geminiUtil';
import type { PrayerDoc, UserSettingsDoc } from '../../shared/types/firestore';
import { sendPush } from './notify';

const db = admin.firestore();
const KST = 'Asia/Seoul';
const REGION = 'asia-northeast3';

export const generatePrayerWeekly = functions
  .region(REGION)
  .runWith({ secrets: ['GEMINI_API_KEY'], timeoutSeconds: 540 })
  .pubsub
  .schedule('0 21 * * 0')          // 일요일 21:00 KST
  .timeZone(KST)
  .onRun(async () => {
    const nowKst = toZonedTime(new Date(), KST);
    const profilesSnap = await db.collection('userProfiles').where('status', '==', 'approved').get();
    for (const prof of profilesSnap.docs) {
      try {
        await processUserWeekly(prof.id, nowKst);
      } catch (e) {
        console.error(`prayerWeekly failed uid=${prof.id}:`, e);
      }
    }
    console.log(`prayerWeekly complete: users=${profilesSnap.size}`);
  });

function toMs(ts: unknown): number | undefined {
  return ts && typeof (ts as any).toMillis === 'function' ? (ts as any).toMillis() : undefined;
}

async function processUserWeekly(uid: string, nowKst: Date): Promise<void> {
  // 1) 지난 7일 날짜 (KST)
  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(format(subDays(nowKst, i), 'yyyy-MM-dd'));
  const weekStartStr = days[days.length - 1];
  const weekStartDate = new Date(`${weekStartStr}T00:00:00+09:00`);
  const weekStartMs = weekStartDate.getTime();

  // 2) 체크 집계
  const checkCounts: Record<string, number> = {};
  let totalChecks = 0;
  for (const day of days) {
    const checks = await db.collection(`users/${uid}/days/${day}/prayerChecks`).get();
    checks.forEach((c) => {
      const pid = (c.data().prayerId as string) || c.id;
      checkCounts[pid] = (checkCounts[pid] ?? 0) + 1;
      totalChecks++;
    });
  }

  // 3) 지난 7일 응답 (index 불필요하도록 status만 쿼리 후 코드 필터)
  const answeredSnap = await db.collection(`users/${uid}/prayers`).where('status', '==', 'answered').get();
  const answeredItems = answeredSnap.docs
    .map((d) => d.data() as PrayerDoc)
    .filter((p) => (toMs(p.answeredAt) ?? 0) >= weekStartMs);

  // 활동이 전혀 없으면 회고를 만들지 않는다 (스팸 방지)
  if (totalChecks === 0 && answeredItems.length === 0) return;

  // 4) prayer 메타 → 모임 집계
  const ids = Object.keys(checkCounts);
  const prayerDocs = await Promise.all(ids.map((id) => db.doc(`users/${uid}/prayers/${id}`).get()));
  const byGroup: Record<string, number> = {};
  for (const ds of prayerDocs) {
    if (!ds.exists) continue;
    const p = ds.data() as PrayerDoc;
    const c = checkCounts[ds.id] ?? 0;
    const g = p.group || '개인';
    byGroup[g] = (byGroup[g] ?? 0) + c;
  }
  const topGroups = Object.entries(byGroup)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([group, count]) => ({ group, count }));
  const topGroup = topGroups[0]?.group ?? '개인';

  // 5) 잊혀가는 기도 (활성·고정 아님·7일 이상 미체크) 상위 3
  const activeSnap = await db.collection(`users/${uid}/prayers`).where('status', '==', 'active').get();
  const nowMs = Date.now();
  const forgottenWarning = activeSnap.docs
    .map((d) => d.data() as PrayerDoc)
    .filter((p) => !p.pinned)
    .map((p) => {
      const last = toMs(p.lastPrayedAt) ?? toMs(p.receivedAt) ?? nowMs;
      return { p, daysSince: Math.floor((nowMs - last) / 86400000) };
    })
    .filter((x) => x.daysSince >= 7)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 3)
    .map((x) => ({ title: x.p.title, daysSince: x.daysSince }));

  // 6) Gemini 한 줄 격려 (실패 시 기본 문구)
  let encouragement = '이번 주도 묵묵히 기도의 자리를 지켰어요. 그 걸음을 주님이 기억하십니다.';
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: `너는 따뜻한 영적 동반자다. 과장하거나 지어내지 말고, 주어진 데이터를 직접 인용해 한국어로 격려하라.
원칙:
- 숫자·인물명·영역명을 본문에서 1회 이상 그대로 인용한다.
- "잘하셨어요" 류의 평가 어휘 대신, 무엇이 어떻게 이어졌는지 사실로 묘사한다.
- 응답된 기도가 있으면 그 의미를 한 줄로 짚고, 잊혀가는 기도가 있으면 비난 없이 환기시킨다.
- 이모지·느낌표는 쓰지 않는다.`,
      });
      const prompt = `이번 주 기도 데이터:
- 총 기도 체크: ${totalChecks}회
- 가장 많이 기도한 모임: ${topGroup}
- 응답된 기도: ${answeredItems.length}건
- 잊혀가는 기도: ${forgottenWarning.length}건

위 데이터를 인용하며 1~2문장(60~120자)으로 간결하게 격려하라.
- 체크 횟수 또는 집중 모임을 한 번 짚고, 꾸준함이나 응답의 의미를 짧게 더한다.
- 잊혀가는 기도가 있으면 비난 없이 한 마디만 환기한다.
- 군더더기 없이 핵심만. 길게 늘이지 않는다.`;
      const res = await callGeminiWithRetry(() => model.generateContent(prompt));
      const t = res.response.text().trim();
      if (t) encouragement = t.slice(0, 160);
    } catch (e) {
      console.error('weekly gemini error', e);
    }
  }

  // 7) 저장
  await db.doc(`users/${uid}/prayerWeekly/${weekStartStr}`).set({
    id: weekStartStr,
    weekStart: admin.firestore.Timestamp.fromDate(weekStartDate),
    weekEnd: FieldValue.serverTimestamp(),
    totalChecks,
    topGroups,
    topGroup,
    answeredCount: answeredItems.length,
    answeredItems: answeredItems.slice(0, 5).map((p) => ({
      title: p.title,
      answerNote: p.answerNote ?? '',
    })),
    forgottenWarning,
    oneLineEncouragement: encouragement,
    generatedAt: FieldValue.serverTimestamp(),
  });

  // 8) 도착 푸시 — 회고는 인앱에 저장되므로 알림만 타입별 설정으로 게이트한다 (미설정=on)
  const settingsSnap = await db.doc(`users/${uid}/settings/main`).get();
  if ((settingsSnap.data() as UserSettingsDoc | undefined)?.notifications?.prayerWeekly === false) return;

  const tokenSnap = await db.collection(`users/${uid}/notifications`).get();
  if (!tokenSnap.empty) {
    await sendPush(uid, tokenSnap.docs, {
      title: '🙏 주간 기도 돌아보기가 도착했어요',
      body: encouragement.slice(0, 80),
    }, { link: '/habit-garden/#/prayers', type: 'prayer_weekly', urgency: 'normal' });
  }
}
