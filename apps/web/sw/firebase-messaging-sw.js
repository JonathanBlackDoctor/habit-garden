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
    // badge 는 안드로이드 상태표시줄의 작은 아이콘 — 알파 채널만 흰 실루엣으로 렌더된다.
    // 풀컬러 불투명 아이콘을 주면 회색 사각형으로만 보이므로 투명 모노크롬 전용 아이콘을 쓴다.
    badge: '/habit-garden/icons/badge-96.png',
    data,
    tag: data.action || 'habit-reminder',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: isHabitReminder
      ? [
          { action: 'open_habits', title: '📝 지금 체크' },
          { action: 'snooze_1h', title: '⏰ 1시간 뒤' },
        ]
      : [],
  });
});

// PWA 설치 기준(installability) 충족용 no-op fetch 핸들러.
self.addEventListener('fetch', () => {});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// notifOpen 파라미터를 HashRouter 가 읽는 해시 쿼리에 싣는다(오픈 트래킹용).
function withNotifOpen(link, action) {
  if (!action) return link;
  if (link.indexOf('#') !== -1) {
    const sep = link.indexOf('?') !== -1 ? '&' : '?';
    return link + sep + 'notifOpen=' + encodeURIComponent(action);
  }
  const base = link.charAt(link.length - 1) === '/' ? link : link + '/';
  return base + '#/?notifOpen=' + encodeURIComponent(action);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const act = event.action;
  const type = data.action || ''; // 알림 타입 (habit_reminder 등)

  // 스누즈만 인증된 클라이언트 쓰기에 위임. 그 외(본문/‘지금 체크’ 클릭)는 앱 오픈 + 오픈 트래킹.
  const isSnooze = act === 'snooze_1h';
  const snoozeMsg = isSnooze
    ? { type: 'SNOOZE_REMINDER', habitIds: data.habitIds || '', date: data.date || '', minutes: 60 }
    : null;

  event.waitUntil(
    (async () => {
      const cls = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of cls) {
        if (c.url.includes('/habit-garden/')) {
          if (snoozeMsg) c.postMessage(snoozeMsg);
          else c.postMessage({ type: 'NOTIF_OPEN', action: type });
          if ('focus' in c) return c.focus();
        }
      }
      // 열린 창이 없으면 앱을 띄운다 (앱 로드 시 딥링크/오픈 파라미터 처리).
      if (snoozeMsg) {
        const target = `/habit-garden/#/habits?snooze=${encodeURIComponent(data.habitIds || '')}&date=${encodeURIComponent(data.date || '')}`;
        return self.clients.openWindow(target);
      }
      const link = act === 'open_habits' ? '/habit-garden/#/habits' : (data.link || '/habit-garden/');
      return self.clients.openWindow(withNotifOpen(link, type));
    })(),
  );
});
