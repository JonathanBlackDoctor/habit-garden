import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

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
