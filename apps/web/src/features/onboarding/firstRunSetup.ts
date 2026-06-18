import {
  collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { seedDefaultHabits } from '@/lib/seed';
import { BEGINNER_HIDDEN_WIDGETS } from '@/features/layout/widgetOrder';

/**
 * 신규 사용자 1회 셋업 — 온보딩 마무리(완료/건너뛰기) 시 호출.
 *  1) 습관이 하나도 없으면 기본 습관을 시드한다(멱등).
 *  2) 그렇게 '처음 습관을 받은' 신규 사용자에게만 초보자용 홈 레이아웃을 적용한다.
 *
 * 이미 습관이 있던 사용자(다른 기기 첫 진입·게스트 등)는 건드리지 않는다 →
 * 기존 사용자의 위젯 구성·데이터에 영향이 없다. 전부 best-effort(실패해도 앱은 진행).
 */
export async function firstRunSetup(uid: string): Promise<void> {
  let seededHabits = false;
  try {
    const habitsSnap = await getDocs(
      query(collection(db, 'users', uid, 'habits'), limit(1)),
    );
    if (habitsSnap.empty) {
      await seedDefaultHabits(uid);
      seededHabits = true;
    }
  } catch (e) {
    console.error('first-run habit seed failed', e);
  }

  // 초보자 홈 레이아웃은 '습관이 비어 있던 신규 사용자'에게만 1회 적용한다.
  if (!seededHabits) return;
  try {
    const settingsRef = doc(db, 'users', uid, 'settings', 'main');
    const snap = await getDoc(settingsRef);
    const hidden = snap.exists() ? snap.data().mainHiddenWidgets : undefined;
    if (hidden === undefined) {
      await setDoc(
        settingsRef,
        { mainHiddenWidgets: [...BEGINNER_HIDDEN_WIDGETS], updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
  } catch (e) {
    console.error('first-run beginner layout seed failed', e);
  }
}
