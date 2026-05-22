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
import { useEffect } from 'react';
import { auth } from './firebase';
import { useAppStore } from './store';
import { setAuthDebug } from './authDebug';

export const ALLOWED_UID = 'XMgQWlM1wtM62hIheTH4sKGDNuC2';

export function isAllowedUser(uid: string): boolean {
  return uid === ALLOWED_UID;
}

/**
 * 로그인. 우선 popup 시도, 실패하면 redirect 폴백.
 * 어떤 경로로 갔는지 / 어디서 실패했는지 모두 화면 디버그 배너에 노출.
 */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  setAuthDebug({ signInPath: 'popup-try', signInErr: '-' });
  try {
    // local persistence (IndexedDB 가 막힌 모바일 사파리에서도 동작)
    await setPersistence(auth, browserLocalPersistence).catch(() => {});
    await signInWithPopup(auth, provider);
    setAuthDebug({ signInPath: 'popup-ok' });
  } catch (e: any) {
    const code = e?.code ?? 'unknown';
    setAuthDebug({ signInErr: `popup: ${code}` });
    // 어떤 사유든 redirect 로 폴백
    try {
      setAuthDebug({ signInPath: 'redirect-try' });
      await signInWithRedirect(auth, provider);
    } catch (e2: any) {
      setAuthDebug({ signInErr: `popup: ${code} / redirect: ${e2?.code ?? 'unknown'}` });
      throw e2;
    }
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
    // redirect 로그인 결과 회수
    getRedirectResult(auth)
      .then((res) => {
        setAuthDebug({ redirect: res?.user ? `uid=${res.user.uid.slice(0, 6)}…` : 'null' });
      })
      .catch((e: any) => {
        setAuthDebug({ redirectErr: e?.code ?? String(e) });
      });

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setUid(firebaseUser?.uid ?? null);
        setAuthLoading(false);
        setAuthDebug({
          lastAuthEvent: firebaseUser
            ? `user uid=${firebaseUser.uid.slice(0, 6)}… email=${firebaseUser.email ?? '-'}`
            : 'null',
        });
      },
      (err) => {
        setAuthDebug({ lastAuthEvent: `error: ${(err as any)?.code ?? String(err)}` });
        setAuthLoading(false);
      }
    );
    return unsubscribe;
  }, [setUser, setAuthLoading, setUid]);

  return { user, authLoading };
}
