// 모바일 진단용 - 화면에 보이는 DiagnosticBanner 와 공유하는 글로벌 상태.
// 정상화 이후 제거 예정.

export interface AuthDebug {
  redirect: string;
  redirectErr: string;
  signInErr: string;
  lastAuthEvent: string;
  signInPath: string;
  lastClick: string;        // 마지막으로 눌린 엘리먼트 요약
  loginBtnClicked: string;  // Login 페이지의 버튼이 실제 핸들러에 도달했는지
}

const w = window as any;
if (!w.__authDbg) {
  w.__authDbg = {
    redirect: '-',
    redirectErr: '-',
    signInErr: '-',
    lastAuthEvent: '-',
    signInPath: '-',
    lastClick: '-',
    loginBtnClicked: '-',
  } as AuthDebug;

  // 어떤 엘리먼트가 눌렸는지 capture phase 로 잡아둔다.
  document.addEventListener(
    'click',
    (ev) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName?.toLowerCase() ?? '?';
      const txt = (t.textContent ?? '').trim().slice(0, 24);
      w.__authDbg.lastClick = `${tag}:"${txt}"`;
      window.dispatchEvent(new Event('authdbg'));
    },
    true
  );
}

export function getAuthDebug(): AuthDebug {
  return (window as any).__authDbg as AuthDebug;
}

export function setAuthDebug(patch: Partial<AuthDebug>) {
  Object.assign((window as any).__authDbg, patch);
  window.dispatchEvent(new Event('authdbg'));
}
