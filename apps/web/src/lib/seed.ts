import { addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { SEED_HABITS, GUEST_SEED_HABITS } from 'shared/types/firestore';

async function seedHabits(uid: string, seeds: Omit<typeof SEED_HABITS[number], never>[]): Promise<number> {
  for (const seed of seeds) {
    const ref = await addDoc(collection(db, 'users', uid, 'habits'), { ...seed, id: '' });
    await updateDoc(ref, { id: ref.id });
  }
  return seeds.length;
}

/** 기본 시드 습관을 사용자의 habits 컬렉션에 추가. (Admin용 전체 목록) */
export async function seedDefaultHabits(uid: string): Promise<number> {
  return seedHabits(uid, SEED_HABITS);
}

/** 게스트(둘러보기) 시드 습관 추가 — 운동·청소·스마트폰 절제만. */
export async function seedGuestHabits(uid: string): Promise<number> {
  return seedHabits(uid, GUEST_SEED_HABITS);
}
