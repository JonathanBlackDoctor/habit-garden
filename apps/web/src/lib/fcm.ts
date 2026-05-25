import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { initializeApp, getApps } from 'firebase/app';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { toast } from 'sonner';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const SW_URL = `${import.meta.env.BASE_URL}firebase-messaging-sw.js`;
const TOKEN_LS_KEY = 'fcm.token';
const ENABLED_LS_KEY = 'fcm.enabled';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFcmEnabled(): boolean {
  return localStorage.getItem(ENABLED_LS_KEY) === '1';
}

export function setFcmEnabledFlag(v: boolean) {
  localStorage.setItem(ENABLED_LS_KEY, v ? '1' : '0');
}

/**
 * Phase 3-1 — FCM 알림 활성화.
 * 1) 권한 요청
 * 2) /habit-garden/firebase-messaging-sw.js 등록
 * 3) SW 에 config postMessage
 * 4) 토큰 발급 → Firestore 저장
 */
export async function enablePushNotifications(uid: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    toast.error('이 브라우저는 푸시 알림을 지원하지 않아요');
    return null;
  }
  if (!VAPID_KEY) {
    toast.error('VITE_FIREBASE_VAPID_KEY 환경변수가 설정되지 않았어요');
    return null;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    toast('알림 권한이 거부됐어요');
    return null;
  }

  // 별도 Firebase App 인스턴스 — main app 과 분리 (이름 'fcm')
  let app = getApps().find((a) => a.name === 'fcm');
  if (!app) app = initializeApp(firebaseConfig, 'fcm');

  const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/habit-garden/' });
  await navigator.serviceWorker.ready;

  // SW 는 빌드 시 주입된 config 로 최상단에서 스스로 초기화한다(cold start 대응).
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) return null;

  localStorage.setItem(TOKEN_LS_KEY, token);
  setFcmEnabledFlag(true);

  // Firestore 저장
  await setDoc(
    doc(db, 'users', uid, 'notifications', token.slice(0, 32)),
    {
      token,
      platform: 'web',
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp() as any,
      lastSeenAt: serverTimestamp() as any,
    },
    { merge: true },
  );

  // 포그라운드 메시지 → 토스트 (서버는 data-only 페이로드를 보낸다)
  onMessage(messaging, (payload) => {
    const data = payload.data ?? {};
    const title = data.title ?? payload.notification?.title ?? '오늘의 한 걸음';
    toast(title, { description: data.body ?? payload.notification?.body });
  });

  toast('🔔 알림이 켜졌어요');
  return token;
}

export async function disablePushNotifications() {
  setFcmEnabledFlag(false);
  localStorage.removeItem(TOKEN_LS_KEY);
  toast('알림을 껐어요');
}
