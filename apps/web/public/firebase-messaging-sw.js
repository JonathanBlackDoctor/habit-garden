/* Firebase Cloud Messaging Service Worker (Phase 3-1).
 * vite-plugin-pwa 가 selfDestroying 모드라 /habit-garden/sw.js 와 충돌 안 함.
 * 이 파일은 /habit-garden/firebase-messaging-sw.js 로 서빙된다 (public/ 정적 복사).
 */
/* eslint-disable */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// 빌드 시 env 가 SW 에 주입되지 않으므로 메인 스레드가 postMessage 로 config 를 전달한다.
// 초기에 비어있어도 swap-once 패턴으로 동작.
let app;
let messaging;

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'FCM_INIT' || app) return;
  app = firebase.initializeApp(event.data.config);
  messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? '오늘의 한 걸음';
    const body  = payload.notification?.body  ?? '';
    const data  = payload.data || {};
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
});

// PWA 설치 기준(installability) 충족용 no-op fetch 핸들러.
// 캐싱은 하지 않고 네트워크로 그대로 통과시킴.
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
