import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// ── 모바일 캐시(옛 서비스워커) 강제 정리 ─────────────────────────
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

// ── 글로벌 에러 시각화 ───────────────────────────────────────
// React 트리 밖에서 발생한 에러(import 시점, async 에러 등)는 ErrorBoundary 가
// 못 잡아서 그냥 흰 화면이 됩니다. DOM 에 강제로 띄워 모바일에서도 보이게 합니다.
function paintError(label: string, msg: string) {
  try {
    let box = document.getElementById('__global-error-overlay');
    if (!box) {
      box = document.createElement('div');
      box.id = '__global-error-overlay';
      Object.assign(box.style, {
        position: 'fixed', top: '0', left: '0', right: '0', zIndex: '100000',
        background: '#7a1f1f', color: '#fff', padding: '8px 10px',
        fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.35',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: '50vh', overflowY: 'auto',
      } as Partial<CSSStyleDeclaration>);
      document.body.appendChild(box);
    }
    const line = document.createElement('div');
    line.textContent = `[${label}] ${msg}`;
    line.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
    line.style.padding = '2px 0';
    box.appendChild(line);
  } catch { /* no-op */ }
}

window.addEventListener('error', (ev) => {
  paintError('error', `${ev.message}  @ ${ev.filename}:${ev.lineno}:${ev.colno}`);
});
window.addEventListener('unhandledrejection', (ev) => {
  const r = ev.reason;
  const msg = (r && (r.stack || r.message)) || String(r);
  paintError('rejection', msg);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
