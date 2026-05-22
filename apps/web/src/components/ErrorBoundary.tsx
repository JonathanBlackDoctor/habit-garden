import React from 'react';

interface State {
  err: Error | null;
}

/**
 * 최상위 에러 바운더리.
 * 모바일에서 콘솔을 못 보는 사용자가 "빈 화면"으로 좌초되는 것을 막기 위해
 * 어떤 에러가 나든 화면에 실제 메시지를 띄웁니다.
 */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', err, info);
  }

  render() {
    if (this.state.err) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'var(--bg-base, #F4F6EE)',
            color: '#333',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌧</div>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            화면을 표시하지 못했습니다.
          </p>
          <p style={{ fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 16 }}>
            아래 메시지를 캡쳐해서 알려주시면 빠르게 고칠 수 있어요.
          </p>
          <pre
            style={{
              fontSize: 11,
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 12,
              maxWidth: '90vw',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {String(this.state.err?.message ?? this.state.err)}
            {this.state.err?.stack ? `\n\n${this.state.err.stack}` : ''}
          </pre>
          <button
            onClick={() => {
              // SW/캐시까지 깨끗이 비우고 새로고침
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations()
                  .then((rs) => Promise.all(rs.map((r) => r.unregister())))
                  .finally(() => {
                    if (typeof caches !== 'undefined') {
                      caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
                        .finally(() => location.reload());
                    } else {
                      location.reload();
                    }
                  });
              } else {
                location.reload();
              }
            }}
            style={{
              marginTop: 16,
              padding: '10px 18px',
              borderRadius: 8,
              background: '#4F7A37',
              color: '#fff',
              border: 'none',
              fontSize: 14,
            }}
          >
            캐시 비우고 새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
