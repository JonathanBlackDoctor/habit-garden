import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * 모바일(특히 iOS standalone PWA / 안드로이드 Chrome 일부)에서는 signInWithPopup이
 * 무반응이거나 빈 화면을 유발합니다. redirect 흐름으로 안전하게 처리합니다.
 * 데스크톱은 기존 popup 그대로.
 */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  if (isMobile()) {
    await signInWithRedirect(auth, provider);
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (e: any) {
    // 팝업 차단 등 어떤 이유로든 실패하면 redirect로 폴백
    if (
      e?.code === 'auth/popup-blocked' ||
      e?.code === 'auth/popup-closed-by-user' ||
      e?.code === 'auth/operation-not-supported-in-this-environment'
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

export function useAuth(): { user: User | null; authLoading: boolean } {
  const user           = useAppStore((s) => s.user);
  const authLoading    = useAppStore((s) => s.authLoading);
  const setUser        = useAppStore((s) => s.setUser);
  const setAuthLoading = useAppStore((s) => s.setAuthLoading);
  const setUid         = useAppStore((s) => s.setUid);

  useEffect(() => {
    // redirect 로그인에서 돌아왔다면 결과를 먼저 회수 (예외는 무시)
    getRedirectResult(auth).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setUid(firebaseUser?.uid ?? null);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [setUser, setAuthLoading, setUid]);

  return { user, authLoading };
}
