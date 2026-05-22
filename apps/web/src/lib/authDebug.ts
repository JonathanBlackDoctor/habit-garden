// 모바일 진단용 - 화면에 보이는 DiagnosticBanner 와 공유하는 글로벌 상태.
// 정상화 이후 제거 예정.

export interface AuthDebug {
  redirect: string;       // getRedirectResult 결과
  redirectErr: string;    // getRedirectResult 에러
  signInErr: string;      // signInWithGoogle 호출 실패 시
  lastAuthEvent: string;  // onAuthStateChanged 가 마지막으로 본 user
  signInPath: string;     // 어느 경로(popup/redirect)로 시도했는지
}

const w = window as any;
if (!w.__authDbg) {
  w.__authDbg = {
    redirect: '-',
    redirectErr: '-',
    signInErr: '-',
    lastAuthEvent: '-',
    signInPath: '-',
  } as AuthDebug;
}

export function getAuthDebug(): AuthDebug {
  return (window as any).__authDbg as AuthDebug;
}

export function setAuthDebug(patch: Partial<AuthDebug>) {
  Object.assign((window as any).__authDbg, patch);
  // 화면을 강제로 갱신하기 위해 storage 이벤트를 흉내냄
  window.dispatchEvent(new Event('authdbg'));
}
