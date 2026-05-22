import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';
import { auth, db } from './firebase';
import { useAppStore } from './store';
import type { UserProfileDoc, UserSettingsDoc } from 'shared/types/firestore';

export const OWNER_UID = 'XMgQWlM1wtM62hIheTH4sKGDNuC2';

export function isOwner(uid: string | null | undefined): boolean {
  return !!uid && uid === OWNER_UID;
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await setPersistence(auth, browserLocalPersistence).catch(() => {});
  try {
    await signInWithPopup(auth, provider);
  } catch (e: any) {
    const code = e?.code;
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function useAuth(): {
  user: User | null;
  profile: UserProfileDoc | null;
  authLoading: boolean;
} {
  const user           = useAppStore((s) => s.user);
  const profile        = useAppStore((s) => s.profile);
  const authLoading    = useAppStore((s) => s.authLoading);
  const setUser        = useAppStore((s) => s.setUser);
  const setAuthLoading = useAppStore((s) => s.setAuthLoading);
  const setUid         = useAppStore((s) => s.setUid);
  const setProfile     = useAppStore((s) => s.setProfile);
  const setSettings    = useAppStore((s) => s.setSettings);

  useEffect(() => {
    getRedirectResult(auth).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setUid(firebaseUser?.uid ?? null);
      setAuthLoading(false);
      if (!firebaseUser) {
        setProfile(null);
        setSettings(null);
      }
    });
    return unsubscribe;
  }, [setUser, setAuthLoading, setUid, setProfile, setSettings]);

  // userProfiles/{uid} 실시간 구독
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'userProfiles', user.uid),
      (snap) => setProfile(snap.exists() ? (snap.data() as UserProfileDoc) : null),
      () => setProfile(null),
    );
    return unsub;
  }, [user, setProfile]);

  // users/{uid}/settings/main 실시간 구독 (승인된 경우에만)
  useEffect(() => {
    if (!user || profile?.status !== 'approved') {
      setSettings(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'users', user.uid, 'settings', 'main'),
      (snap) => setSettings(snap.exists() ? (snap.data() as UserSettingsDoc) : null),
      () => setSettings(null),
    );
    return unsub;
  }, [user, profile?.status, setSettings]);

  return { user, profile, authLoading };
}
