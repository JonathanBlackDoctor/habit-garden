// ── 온보딩 완료 플래그 ──
// store.ts 의 `hg_sandbox` 와 동일한 device-level localStorage 패턴.
// 버전 접미사(_v1)로 향후 온보딩을 개편하면 모든 사용자에게 다시 노출할 수 있다.
// 게스트(익명) 계정에서도 동작하도록 Firestore 가 아닌 localStorage 에 저장한다.
const ONBOARDED_KEY = 'hg_onboarded_v1';

/** 이 기기에서 온보딩을 이미 끝냈는지 여부. */
export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    // 프라이빗 모드 등에서 localStorage 접근이 막히면 매번 보여주지 않도록 true 처리
    return true;
  }
}

/** 온보딩 완료로 표시한다. */
export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    /* noop */
  }
}

/** (개발/테스트용) 온보딩 플래그를 지워 다시 노출되게 한다. */
export function resetOnboarded(): void {
  try {
    localStorage.removeItem(ONBOARDED_KEY);
  } catch {
    /* noop */
  }
}
