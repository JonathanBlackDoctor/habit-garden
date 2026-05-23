import { addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { SEED_HABITS } from 'shared/types/firestore';

/** 기본 시드 습관을 사용자의 habits 컬렉션에 추가. (Admin·게스트 온보딩 공용) */
export async function seedDefaultHabits(uid: string): Promise<number> {
  for (const seed of SEED_HABITS) {
    const ref = await addDoc(collection(db, 'users', uid, 'habits'), { ...seed, id: '' });
    await updateDoc(ref, { id: ref.id });
  }
  return SEED_HABITS.length;
}
