import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { useAppStore } from './store';

export type UiDesign = 'editorial' | 'classic';

export function useFaithEnabled(): boolean {
  const settings = useAppStore((s) => s.settings);
  const profile = useAppStore((s) => s.profile);
  if (settings?.features?.faith !== undefined) return settings.features.faith;
  return profile?.isOwner ?? false;
}

export function useUiDesign(): UiDesign {
  const settings = useAppStore((s) => s.settings) as ({ uiDesign?: UiDesign } | null);
  return settings?.uiDesign === 'classic' ? 'classic' : 'editorial';
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

export async function setUiDesign(uid: string, uiDesign: UiDesign): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'settings', 'main'),
    { uiDesign, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
