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
    self.registration.showNotification(title, {
      body,
      icon: '/habit-garden/icons/icon-192.png',
      badge: '/habit-garden/icons/icon-192.png',
      data: payload.data,
      tag: 'habit-reminder',
    });
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cls) => {
      const target = '/habit-garden/';
      for (const c of cls) {
        if (c.url.includes('/habit-garden/') && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
