import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { startPrayerTextMigration } from './features/prayers/prayerTextMigration';

// 기존 기도 데이터 중 줄바꿈이 이스케이프 문자열로 남아 있는 항목을
// 로그인 후 실제 개행으로 정규화한다. 정상 문서는 쓰기 없이 통과한다.
startPrayerTextMigration();

// PWA 설치 기준 충족 + FCM 백그라운드 푸시 수신을 위해
// 페이지 로드 시 서비스워커를 미리 등록한다.
// (실제 푸시 권한·토큰 발급은 More 페이지의 토글에서 수행)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}firebase-messaging-sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .catch((err) => console.warn('SW register failed:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
