import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getPrayerTextRepairPatch } from './prayerText';

const MIGRATION_FLAG = 'prayerTextLineBreaksV1';
const repairedUids = new Set<string>();
let started = false;

async function repairPrayerTexts(uid: string) {
  if (repairedUids.has(uid)) return;
  repairedUids.add(uid);

  try {
    const settingsRef = doc(db, 'users', uid, 'settings', 'main');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.data()?.[MIGRATION_FLAG] === true) return;

    const snap = await getDocs(collection(db, 'users', uid, 'prayers'));
    const repairs = snap.docs
      .map((d) => ({ ref: d.ref, patch: getPrayerTextRepairPatch(d.data()) }))
      .filter(({ patch }) => Object.keys(patch).length > 0);

    for (let i = 0; i < repairs.length; i += 400) {
      const batch = writeBatch(db);
      for (const { ref, patch } of repairs.slice(i, i + 400)) {
        batch.update(ref, { ...patch, updatedAt: serverTimestamp() });
      }
      await batch.commit();
    }

    await setDoc(
      settingsRef,
      { [MIGRATION_FLAG]: true, updatedAt: serverTimestamp() },
      { merge: true },
    );

    if (repairs.length > 0) {
      console.info(`[prayers] repaired line breaks in ${repairs.length} existing item(s)`);
    }
  } catch (error) {
    repairedUids.delete(uid);
    console.warn('[prayers] legacy line-break repair skipped:', error);
  }
}

/**
 * 앱 시작 시 인증 사용자의 기존 기도 데이터를 1회 점검한다.
 * 완료 마커가 있으면 전체 목록을 다시 읽지 않고, 실제 보정이 필요한 문서만 배치 수정한다.
 */
export function startPrayerTextMigration() {
  if (started) return;
  started = true;

  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    void repairPrayerTexts(user.uid);
  });
}
