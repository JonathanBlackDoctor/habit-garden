import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '@/lib/firebase';
import {
  getPrayerTextRepairPatch, isSafePrayerLineBreakRepair, normalizePrayerText,
  restoreInlinePrayerBullets,
} from './prayerText';

// V1(이스케이프 개행 복구) 완료 여부와 별개로 과거 bulk_ai 본문을 다시 검사한다.
const MIGRATION_FLAG = 'prayerTextLineBreaksV2';
const repairedUids = new Set<string>();
let started = false;

interface RepairCandidate {
  ref: ReturnType<typeof doc>;
  id: string;
  body: string;
}

async function repairPrayerTexts(uid: string) {
  if (repairedUids.has(uid)) return;
  repairedUids.add(uid);

  try {
    const settingsRef = doc(db, 'users', uid, 'settings', 'main');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.data()?.[MIGRATION_FLAG] === true) return;

    const snap = await getDocs(collection(db, 'users', uid, 'prayers'));
    const repairs: Array<{ ref: ReturnType<typeof doc>; patch: Record<string, unknown> }> = [];
    const candidates: RepairCandidate[] = [];

    for (const prayer of snap.docs) {
      const data = prayer.data();
      const patch: Record<string, unknown> = getPrayerTextRepairPatch(data);
      const body = typeof data.body === 'string'
        ? normalizePrayerText(data.body) : '';

      // 과거 AI 무더기 등록의 한 줄 불릿은 의미 추측 없이 개행만 복구한다.
      if (data.source === 'bulk_ai' && body) {
        const withBreaks = restoreInlinePrayerBullets(body);
        if (withBreaks !== data.body) patch.body = withBreaks;
        // 구분 불명확한 한 줄 기도제목만 AI에 보내고, 글자 보존을 검증한다.
        if (!withBreaks.includes('\n') && withBreaks.length >= 25 && withBreaks.length <= 800) {
          candidates.push({ ref: prayer.ref, id: prayer.id, body: withBreaks });
        }
      }
      if (Object.keys(patch).length > 0) repairs.push({ ref: prayer.ref, patch });
    }

    // 기계적으로 확실한 개행 변환은 기존 문서에 즉시 반영한다.
    for (let i = 0; i < repairs.length; i += 400) {
      const batch = writeBatch(db);
      for (const { ref, patch } of repairs.slice(i, i + 400)) {
        batch.update(ref, { ...patch, updatedAt: serverTimestamp() });
      }
      await batch.commit();
    }

    const callable = httpsCallable<
      { items: Array<{ id: string; body: string }> },
      { items: Array<{ id: string; body: string | null }> }
    >(functions, 'repairPrayerBodies');

    // 모델 호출은 적은 수로 묶어 수행하며, 오류 시 V2 완료 표시를 남기지 않는다.
    for (let i = 0; i < candidates.length;) {
      const batch: RepairCandidate[] = [];
      let characters = 0;
      while (i < candidates.length && batch.length < 10
        && characters + candidates[i].body.length <= 7000) {
        batch.push(candidates[i]);
        characters += candidates[i].body.length;
        i++;
      }
      if (batch.length === 0) { i++; continue; }

      const result = await callable({
        items: batch.map(({ id, body }) => ({ id, body })),
      });
      const byId = new Map((result.data.items ?? []).map((item) => [item.id, item.body]));
      for (const candidate of batch) {
        const next = byId.get(candidate.id);
        if (!next || !isSafePrayerLineBreakRepair(candidate.body, next)) continue;
        // 사용자가 복구 중 직접 수정했으면 최신 내용을 덮어쓰지 않는다.
        await runTransaction(db, async (transaction) => {
          const latest = await transaction.get(candidate.ref);
          if (!latest.exists()) return;
          if (latest.data()?.body !== candidate.body) return;
          transaction.update(candidate.ref, {
            body: next,
            updatedAt: serverTimestamp(),
          });
        });
      }
    }

    await setDoc(
      settingsRef,
      { [MIGRATION_FLAG]: true, updatedAt: serverTimestamp() },
      { merge: true },
    );
    if (repairs.length || candidates.length) {
      console.info('[prayers] legacy line-break migration finished', {
        formatted: repairs.length, aiChecked: candidates.length,
      });
    }
  } catch (error) {
    repairedUids.delete(uid);
    console.warn('[prayers] legacy line-break repair skipped; will retry next visit:', error);
  }
}

/** 로그인 후 기존 기도제목 줄바꿈을 한 번 복구한다. */
export function startPrayerTextMigration() {
  if (started) return;
  started = true;

  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    void repairPrayerTexts(user.uid);
  });
}
