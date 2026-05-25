import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithCredential,
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
import { exportGuestData, importGuestData } from './migrate';
import { seedGuestHabits } from './seed';

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

/** 가입 없이 둘러보기 — 익명 계정으로 진입. 같은 기기/브라우저에서 데이터 유지. */
export async function signInAsGuest(): Promise<void> {
  await setPersistence(auth, browserLocalPersistence).catch(() => {});
  const cred = await signInAnonymously(auth);
  // 신규 게스트 계정에 기본 습관을 1회 시딩 (빈 화면 방지)
  await seedGuestHabits(cred.user.uid).catch((e) =>
    console.error('guest habit seed failed', e),
  );
}

/**
 * 게스트(익명) → Google 정식 계정으로 업그레이드.
 * 익명 계정에 Google 자격을 link 하면 uid 가 유지되어 데이터가 그대로 보존된다.
 * 이미 그 Google 계정이 존재하면(credential-already-in-use) 기존 계정으로 로그인 후
 * 게스트 데이터를 best-effort 복사한다.
 */
export async function upgradeGuestWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await setPersistence(auth, browserLocalPersistence).catch(() => {});
  const current = auth.currentUser;

  // 익명이 아니면(이미 정식 로그인) 일반 로그인 흐름으로 처리
  if (!current || !current.isAnonymous) {
    await signInWithGoogle();
    return;
  }

  const guestUid = current.uid;
  try {
    await linkWithPopup(current, provider);
    // 성공: uid 유지 → 데이터 보존. profile self-create 가 pending 으로 생성됨.
  } catch (e: any) {
    const code = e?.code;
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/cancelled-popup-request'
    ) {
      await linkWithRedirect(current, provider);
      return;
    }
    if (code === 'auth/credential-already-in-use') {
      // 이미 존재하는 Google 계정 — 계정 전환 전 게스트 데이터를 먼저 읽어둔 뒤
      // 기존 계정으로 로그인하고 복사한다(보안규칙: 본인 데이터만 read).
      const cred = GoogleAuthProvider.credentialFromError(e);
      if (!cred) throw e;
      const snapshot = await exportGuestData(guestUid).catch(() => null);
      const result = await signInWithCredential(auth, cred);
      if (snapshot) {
        await importGuestData(result.user.uid, snapshot).catch((err) =>
          console.error('guest data migration failed', err),
        );
      }
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
  const setRealUid     = useAppStore((s) => s.setRealUid);
  const setProfile     = useAppStore((s) => s.setProfile);
  const setSettings    = useAppStore((s) => s.setSettings);

  useEffect(() => {
    getRedirectResult(auth).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      // 실제 인증 uid 저장 → store 가 샌드박스 여부에 따라 유효 uid(uid)를 계산.
      setRealUid(firebaseUser?.uid ?? null);
      setAuthLoading(false);
      if (!firebaseUser) {
        setProfile(null);
        setSettings(null);
      }
    });
    return unsubscribe;
  }, [setUser, setAuthLoading, setRealUid, setProfile, setSettings]);

  // userProfiles/{uid} 실시간 구독 (+ Cloud Function이 못 만들었으면 self-create 폴백)
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    // 익명 게스트는 userProfiles 문서를 만들지 않는다 (승인 대기열 오염 방지).
    if (user.isAnonymous) {
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

  // users/{uid}/settings/main 실시간 구독 (게스트 포함 모든 인증 사용자)
  useEffect(() => {
    if (!user) {
      setSettings(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'users', user.uid, 'settings', 'main'),
      (snap) => setSettings(snap.exists() ? (snap.data() as UserSettingsDoc) : null),
      () => setSettings(null),
    );
    return unsub;
  }, [user, setSettings]);

  return { user, profile, authLoading };
}
