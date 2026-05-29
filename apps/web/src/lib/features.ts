import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { useAppStore } from './store';
import type { GardenState } from 'shared/types/firestore';

export function useFaithEnabled(): boolean {
  const settings = useAppStore((s) => s.settings);
  const profile = useAppStore((s) => s.profile);
  if (settings?.features?.faith !== undefined) return settings.features.faith;
  return profile?.isOwner ?? false;
}

/** 익명(가입 없이 둘러보기) 게스트 여부 */
export function useIsGuest(): boolean {
  const user = useAppStore((s) => s.user);
  return user?.isAnonymous === true;
}

/**
 * AI·서버 프리미엄 기능 노출 여부.
 * 승인(approved)된 정식 계정만 true. 게스트·대기·거부는 false.
 */
export function useIsPremium(): boolean {
  const profile = useAppStore((s) => s.profile);
  return profile?.status === 'approved';
}

export async function setFaithEnabled(uid: string, enabled: boolean): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'settings', 'main'),
    { features: { faith: enabled }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ── 정원 둘러보기: 닉네임 + 공개 정원(gardens/{uid}) ──
/** 현재 store 의 닉네임을 반환한다 (미설정 시 ''). */
export function useNickname(): string {
  return useAppStore((s) => s.settings?.nickname ?? '');
}

export interface PublicGardenInput {
  uid: string;
  sandbox: boolean;
  isAnonymous: boolean;
  nickname: string;
  level: number;
  gardenState: GardenState;
}

/**
 * 공개 정원 미러(gardens/{uid})를 작성한다.
 * 샌드박스·게스트·빈 닉네임이면 작성하지 않는다(둘러보기 비노출).
 */
export async function writePublicGarden(input: PublicGardenInput): Promise<void> {
  const nickname = input.nickname.trim();
  if (input.sandbox || input.isAnonymous || !nickname) return;
  await setDoc(
    doc(db, 'gardens', input.uid),
    {
      uid: input.uid,
      nickname,
      level: input.level,
      gardenState: input.gardenState,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * 닉네임 저장: settings(canonical) 기록 후 공개 정원 미러를 갱신한다.
 * 닉네임을 비우면 공개 정원 문서를 삭제해 둘러보기에서 사라지게 한다.
 */
export async function saveNickname(input: PublicGardenInput): Promise<void> {
  const nickname = input.nickname.trim();
  await setDoc(
    doc(db, 'users', input.uid, 'settings', 'main'),
    { nickname, updatedAt: serverTimestamp() },
    { merge: true },
  );
  if (input.sandbox || input.isAnonymous) return;
  if (!nickname) {
    await deleteDoc(doc(db, 'gardens', input.uid)).catch(() => { /* 문서 없을 수 있음 */ });
    return;
  }
  await writePublicGarden({ ...input, nickname });
}
