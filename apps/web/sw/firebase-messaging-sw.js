/* Firebase Cloud Messaging Service Worker.
 * 아래 initializeApp 의 config 플레이스홀더는 빌드 시 vite 플러그인('fcm-sw-config') /
 * dev 미들웨어가 실제 config(JSON)로 치환한다. 클라이언트 공개값이라 비밀이 아니다.
 *
 * 핵심: 서비스워커는 유휴 시 종료됐다가 푸시 도착 시 cold start 로 깨어난다.
 * 그 시점엔 열린 페이지가 없어 postMessage 로 config 를 받을 수 없으므로,
 * 반드시 최상단에서 동기적으로 Firebase 를 초기화해야 백그라운드 푸시가 표시된다.
 */
/* eslint-disable */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp(__FIREBASE_MESSAGING_CONFIG__);
const messaging = firebase.messaging();

// 서버는 data-only 페이로드를 보낸다(중복 표시 방지). 표시는 여기서 전담.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || '오늘의 한 걸음';
  const body = data.body || '';
  const isHabitReminder = data.action === 'habit_reminder';
  self.registration.showNotification(title, {
    body,
    icon: '/habit-garden/icons/icon-192.png',
    badge: '/habit-garden/icons/icon-192.png',
    data,
    tag: data.action || 'habit-reminder',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: isHabitReminder
      ? [
          { action: 'check_all', title: '✓ 전부 완료' },
          { action: 'snooze_1h', title: '⏰ 1시간 뒤' },
        ]
      : [],
  });
});

// PWA 설치 기준(installability) 충족용 no-op fetch 핸들러.
self.addEventListener('fetch', () => {});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const act = event.action;

  // 액션 버튼 → 열린 클라이언트에 위임(인증된 쓰기). 없으면 딥링크로 앱 오픈.
  const msg =
    act === 'check_all'
      ? { type: 'QUICK_CHECK', habitIds: data.habitIds || '', date: data.date || '' }
      : act === 'snooze_1h'
      ? { type: 'SNOOZE_REMINDER', habitIds: data.habitIds || '', date: data.date || '', minutes: 60 }
      : null;

  event.waitUntil(
    (async () => {
      const cls = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of cls) {
        if (c.url.includes('/habit-garden/')) {
          if (msg) c.postMessage(msg);
          if ('focus' in c) return c.focus();
        }
      }
      // 열린 창이 없으면 쿼리 파라미터를 실어 앱을 띄운다 (앱 로드 시 처리).
      let target = '/habit-garden/';
      if (msg) {
        const key = act === 'check_all' ? 'quickCheck' : 'snooze';
        target = `/habit-garden/#/habits?${key}=${encodeURIComponent(data.habitIds || '')}&date=${encodeURIComponent(data.date || '')}`;
      } else if (data.link) {
        target = data.link;
      }
      return self.clients.openWindow(target);
    })(),
  );
});
