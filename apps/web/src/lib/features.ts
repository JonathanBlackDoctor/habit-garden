import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { useAppStore } from './store';

export function useFaithEnabled(): boolean {
  const settings = useAppStore((s) => s.settings);
  const profile = useAppStore((s) => s.profile);
  if (settings?.features?.faith !== undefined) return settings.features.faith;
  return profile?.isOwner ?? false;
}

export async function setFaithEnabled(uid: string, enabled: boolean): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'settings', 'main'),
    { features: { faith: enabled }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
