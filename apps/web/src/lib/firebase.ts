import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence } from 'firebase/auth';
import { connectFirestoreEmulator, enableIndexedDbPersistence, initializeFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth     = getAuth(app);
export const db       = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const functions = getFunctions(app, 'asia-northeast3');
export const storage  = getStorage(app);

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectStorageEmulator(storage, 'localhost', 9199);
}

// persistence 는 여기서 1회만 설정한다.
// 로그인 핸들러(클릭) 안에서 `await setPersistence(...)` 를 호출하면 사용자 제스처
// 체인이 끊겨 모바일 브라우저가 signInWithPopup 의 팝업을 차단하고, 깨진
// signInWithRedirect(앱 도메인 ≠ authDomain → 크로스도메인 스토리지 파티셔닝으로
// 자격증명 유실) 폴백으로 떨어져 로그인 무한 루프가 발생한다.
// 초기화 시점에 미리 설정해 두면 팝업이 클릭과 동기적으로 실행되어 정상 동작한다.
setPersistence(auth, browserLocalPersistence).catch(() => {});

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence: browser not supported');
  }
});
