import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// ── 모바일 캐시(옛 서비스워커) 강제 정리 ─────────────────────────
// 이전 빌드(BrowserRouter 시절 또는 잘못된 라우팅)의 서비스워커가 박혀 있으면
// 새 번들을 무시하고 옛 HTML/JS를 계속 서빙해 로그인 후 빈 화면이 보입니다.
// 어떤 SW가 등록돼 있든 모두 해제하고, 캐시도 비웁니다.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => {});
}
if (typeof caches !== 'undefined') {
  caches.keys()
    .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    .catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
