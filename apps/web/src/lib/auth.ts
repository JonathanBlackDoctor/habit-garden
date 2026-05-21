import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { useEffect } from 'react';
import { auth } from './firebase';
import { useAppStore } from './store';

export const ALLOWED_UID = 'XMgQWlM1wtM62hIheTH4sKGDNuC2';

export function isAllowedUser(uid: string): boolean {
  return uid === ALLOWED_UID;
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function useAuth(): { user: User | null; authLoading: boolean } {
  const user       = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const setUser    = useAppStore((s) => s.setUser);
  const setAuthLoading = useAppStore((s) => s.setAuthLoading);
  const setUid     = useAppStore((s) => s.setUid);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setUid(firebaseUser?.uid ?? null);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [setUser, setAuthLoading, setUid]);

  return { user, authLoading };
}
