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
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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

  // userProfiles/{uid} 실시간 구독 (+ Cloud Function이 못 만들었으면 self-create 폴백)
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const ref = doc(db, 'userProfiles', user.uid);
    let attemptedCreate = false;
    const unsub = onSnapshot(
      ref,
      async (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfileDoc);
          return;
        }
        setProfile(null);
        if (attemptedCreate) return;
        attemptedCreate = true;
        try {
          // 규칙상 create 는 status='pending' & isOwner=false 만 허용됨.
          // owner 는 직후 update 로 self-approve (rules: update,delete if isOwner).
          await setDoc(ref, {
            uid:         user.uid,
            email:       user.email ?? '',
            displayName: user.displayName ?? null,
            photoURL:    user.photoURL ?? null,
            status:      'pending',
            isOwner:     false,
            createdAt:   serverTimestamp(),
            approvedAt:  null,
            approvedBy:  null,
          });
          if (user.uid === OWNER_UID) {
            await updateDoc(ref, {
              status:     'approved',
              isOwner:    true,
              approvedAt: serverTimestamp(),
              approvedBy: user.uid,
            });
          }
        } catch (e) {
          console.error('userProfile self-create 실패', e);
        }
      },
      (err) => {
        console.error('userProfile 구독 오류', err);
        setProfile(null);
      },
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
