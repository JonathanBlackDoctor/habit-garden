/**
 * dailyReset — 매일 04:00 KST 실행
 *  1. 오늘 DayDoc 생성 (없으면)
 *  2. 어제 DayDoc finalized = true
 *  3. 어제 globalStreak 정산 (성공 못한 날이면 리셋)
 *  4. AI 피드백 생성 (generateFeedback 호출)
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { subDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { processDailyGarden } from './gardenAutogrow';
import { selectTodayPrayers, shouldBecomeDormant, type RotationInput } from '../../shared/prayerRotation';
import type { PrayerDoc, TodayTodoDoc } from '../../shared/types/firestore';

const db = admin.firestore();
const KST = 'Asia/Seoul';
const REGION = 'asia-northeast3';

function todayKST(): string {
  const now = toZonedTime(new Date(), KST);
  return format(now, 'yyyy-MM-dd');
}

function yesterdayKST(): string {
  const now = toZonedTime(new Date(), KST);
  return format(subDays(now, 1), 'yyyy-MM-dd');
}

export const dailyReset = functions
  .region(REGION)
  .pubsub
  .schedule('0 4 * * *')            // 04:00 UTC+9 → 04:00 KST (Firebase uses UTC, adjust: 0 19 * * * for UTC-5hr offset)
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const today     = todayKST();
    const yesterday = yesterdayKST();

    // 승인된 사용자만 순회
    const profilesSnap = await db.collection('userProfiles').where('status', '==', 'approved').get();
    for (const profileDoc of profilesSnap.docs) {
      const uid = profileDoc.id;
      try {
        const { success, protected: protectedDay } = await processUserDay(uid, today, yesterday);
        await processDailyGarden(uid, success, protectedDay);  // 정원 트레잇·생기·시들기·보너스 시드
        const dormantCount = await processDormantTransitions(uid);  // 잊혀짐 자동 전이 (설계 §5)
        if (dormantCount > 0) console.log(`dormant transition: uid=${uid}, n=${dormantCount}`);
        await generatePrayerPlan(uid, today, Date.now());  // 오늘의 기도 목록 사전 계산 (권위 있는 plan)
      } catch (e) {
        console.error(`dailyReset failed for uid=${uid}:`, e);
      }
    }

    console.log(`dailyReset complete: today=${today}, yesterday=${yesterday}, users=${profilesSnap.size}`);
  });

function tsToMs(ts: unknown): number | undefined {
  return ts && typeof (ts as any).toMillis === 'function' ? (ts as any).toMillis() : undefined;
}

/** 활성 기도제목 중 망각 임계를 넘긴 항목을 dormant로 전이 (pinned 제외) */
async function processDormantTransitions(uid: string): Promise<number> {
  const snap = await db.collection(`users/${uid}/prayers`).where('status', '==', 'active').get();
  if (snap.empty) return 0;

  const nowMs = Date.now();
  let count = 0;
  const batch = db.batch();
  for (const docSnap of snap.docs) {
    const p = docSnap.data() as PrayerDoc;
    if (p.pinned) continue;
    const input: RotationInput = {
      id: p.id,
      priority: p.priority,
      pinned: p.pinned,
      rotationDays: p.rotationDays,
      receivedAtMs: tsToMs(p.receivedAt) ?? nowMs,
      lastPrayedAtMs: tsToMs(p.lastPrayedAt),
    };
    if (shouldBecomeDormant(input, nowMs)) {
      batch.update(docSnap.ref, {
        status: 'dormant',
        dormantSince: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      count++;
    }
  }
  if (count > 0) await batch.commit();
  return count;
}

/**
 * 오늘의 기도 목록(prayerPlan)을 서버에서 미리 계산해 DayDoc 에 저장한다.
 * prayerAward.checkDailyListComplete 가 의존하는 '권위 있는' 목록으로,
 * 사용자가 기도 탭을 열지 않은 날에도 목록 완료 보너스·스트릭이 동작하게 한다.
 * 활성 기도제목이 없으면 쓰지 않는다(비신앙 사용자 불필요 쓰기 방지).
 * 클라이언트 useTodayPrayers 는 plan 이 있으면 그대로 따르고 덮어쓰지 않는다(fromPlan).
 */
async function generatePrayerPlan(uid: string, today: string, nowMs: number): Promise<void> {
  const snap = await db.collection(`users/${uid}/prayers`).where('status', '==', 'active').get();
  if (snap.empty) return;
  const inputs: RotationInput[] = snap.docs.map((docSnap) => {
    const p = docSnap.data() as PrayerDoc;
    return {
      id: p.id,
      priority: p.priority,
      pinned: p.pinned,
      rotationDays: p.rotationDays,
      receivedAtMs: tsToMs(p.receivedAt) ?? nowMs,
      lastPrayedAtMs: tsToMs(p.lastPrayedAt),
    };
  });
  const { pinnedIds, rotationIds } = selectTodayPrayers(inputs, nowMs);
  await db.doc(`users/${uid}/days/${today}`).set({
    prayerPlan: { pinnedIds, rotationIds, generatedAt: FieldValue.serverTimestamp() },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function processUserDay(
  uid: string,
  today: string,
  yesterday: string,
): Promise<{ success: boolean; protected: boolean }> {
  // 1. 오늘 DayDoc 생성
  const todayRef = db.doc(`users/${uid}/days/${today}`);
  const todaySnap = await todayRef.get();
  if (!todaySnap.exists) {
    await todayRef.set({
      date:      today,
      condition: {},
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // 1-1. 전날 미완료 '오늘 할 일' 이월 (체크 안 한 항목이 사라지지 않게 다음 날로 넘김)
  await carryOverTodos(uid, today, yesterday, todaySnap.data()?.todosCarriedOver);

  // 2. 어제 finalize
  const ydayRef  = db.doc(`users/${uid}/days/${yesterday}`);
  const ydaySnap = await ydayRef.get();
  if (ydaySnap.exists && !ydaySnap.data()?.finalized) {
    await ydayRef.update({ finalized: true, updatedAt: FieldValue.serverTimestamp() });
  }

  // 3. 스트릭 정산 — 어제 성공 못 했으면 globalStreak 리셋
  let success = false;
  let protectedDay = false;
  if (ydaySnap.exists) {
    const checks = await db
      .collection(`users/${uid}/days/${yesterday}/habitChecks`)
      .get();

    // 의도적 건너뛰기(score=null)는 분모에서 제외 — 스트릭 보호
    const scored   = checks.docs.filter((d) => d.data().score !== null);
    const total    = scored.length;
    const achieved = scored.filter((d) => d.data().achieved).length;
    success  = total > 0 && achieved / total >= 0.6;

    if (!success) {
      const progressRef = db.doc(`users/${uid}/progress/main`);
      const pSnap = await progressRef.get();
      const data = pSnap.exists ? pSnap.data() : undefined;
      const current = data?.globalStreak ?? 0;
      if (current > 0) {
        // 스트릭 보호 (휴가/아픔/그레이스/freeze 토큰) 적용 — 보호 시 리셋하지 않음
        protectedDay = await tryConsumeStreakProtection(uid, yesterday, data);
        if (!protectedDay) {
          await progressRef.set({
            globalStreak: 0,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      } else {
        // 스트릭이 0이라 리셋할 건 없지만, 정원 보호를 위해 커버 여부만(소모 없이) 평가
        protectedDay = isDayProtected(yesterday, data);
      }
    }
  }
  return { success, protected: protectedDay };
}

/**
 * 전날(yesterday) 미완료 '오늘 할 일'을 오늘(today)로 이월한다.
 *  - 완료(done=true) 항목은 가져오지 않는다.
 *  - 전날 문서는 기록 보존을 위해 건드리지 않고, 오늘로 새 문서를 복사한다.
 *  - todosCarriedOver 플래그로 하루 1회만 실행(멱등). dailyReset이 매일 돌며
 *    yesterday→today 로 사슬처럼 이월하므로 며칠 비워도 누락 없이 이어진다.
 */
async function carryOverTodos(
  uid: string,
  today: string,
  yesterday: string,
  alreadyCarried: boolean | undefined,
): Promise<void> {
  if (alreadyCarried) return;

  const todayCol = db.collection(`users/${uid}/days/${today}/todayTodos`);
  const ydaySnap = await db.collection(`users/${uid}/days/${yesterday}/todayTodos`).get();
  const pending = ydaySnap.docs.filter((d) => !(d.data() as TodayTodoDoc).done);

  const batch = db.batch();
  for (const d of pending) {
    const prev = d.data() as TodayTodoDoc;
    const ref = todayCol.doc();
    batch.set(ref, {
      id: ref.id,
      title: prev.title,
      done: false,
      carriedFrom: yesterday,
      ...(prev.linkedLongTodoId ? { linkedLongTodoId: prev.linkedLongTodoId } : {}),
    });
  }
  batch.set(
    db.doc(`users/${uid}/days/${today}`),
    { todosCarriedOver: true, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  await batch.commit();
}

/** 소모 없이 해당 날짜가 휴가/freeze 토큰으로 보호되는지만 판단 (정원 보호 평가용). */
function isDayProtected(date: string, prog: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!prog) return false;
  if (prog.vacationUntil && prog.vacationUntil >= date) return true;
  if (prog.freezeProtectedDate && prog.freezeProtectedDate === date) return true;
  return false;
}

/**
 * 어제(date)가 성공일이 아닐 때 스트릭을 끊지 않고 보호할 수 있는지 판단·소모.
 *  1) vacationUntil 이 date 이상이면 보호 (소모 없음 — 휴가 기간)
 *  2) 주간 그레이스(주 1회) 미사용이면 소모 후 보호
 * 보호되면 true 반환 → 호출부에서 globalStreak 리셋 생략.
 */
async function tryConsumeStreakProtection(
  uid: string,
  date: string,
  prog: FirebaseFirestore.DocumentData | undefined,
): Promise<boolean> {
  if (!prog) return false;
  const progressRef = db.doc(`users/${uid}/progress/main`);

  // 0) freeze 토큰으로 이미 보호한 날 (토큰 사용 시 소모 완료 — 여기선 인정만)
  if (prog.freezeProtectedDate && prog.freezeProtectedDate === date) {
    return true;
  }

  // 1) 휴가/아픔 모드 — vacationUntil 이 보호 대상일 이상
  if (prog.vacationUntil && prog.vacationUntil >= date) {
    return true;
  }

  // 2) 주간 그레이스 (주 1회)
  const weekStart = getWeekStart(date);
  const grace = prog.graceUsed;
  const usedThisWeek = grace && grace.weekStart === weekStart ? (grace.daysUsed ?? 0) : 0;
  if (usedThisWeek < 1) {
    await progressRef.set({
      graceUsed: { weekStart, daysUsed: usedThisWeek + 1 },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  }

  return false;
}

// 주의 시작(월요일) 'YYYY-MM-DD' 반환
function getWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();             // 0=일 … 6=토
  const diff = day === 0 ? -6 : 1 - day; // 월요일로 보정
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
