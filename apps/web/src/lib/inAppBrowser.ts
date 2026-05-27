export type InAppBrowser =
  | 'kakaotalk'
  | 'naver'
  | 'daum'
  | 'line'
  | 'instagram'
  | 'facebook'
  | null;

/** 카카오톡 등 인앱(WebView) 브라우저를 userAgent 로 식별한다. */
export function detectInAppBrowser(): InAppBrowser {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('kakaotalk')) return 'kakaotalk';
  if (ua.includes('naver')) return 'naver';
  if (ua.includes('daumapps')) return 'daum';
  if (ua.includes('line/') || ua.includes('line ')) return 'line';
  if (ua.includes('instagram')) return 'instagram';
  if (ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab')) return 'facebook';
  return null;
}

export function isInAppBrowser(): boolean {
  return detectInAppBrowser() !== null;
}

/**
 * 인앱 브라우저는 Google OAuth(disallowed_useragent)를 차단한다.
 * 가능한 경우 외부 기본 브라우저로 현재 URL 을 다시 연다.
 * - 카카오톡: 전용 스킴으로 즉시 외부 브라우저 실행
 * - 라인: openExternalBrowser 쿼리로 외부 브라우저 실행
 * - 그 외 안드로이드: intent 스킴으로 시도
 * 반환값이 false 면 자동 전환이 불가능하므로 수동 안내가 필요하다.
 */
export function openInExternalBrowser(url: string = window.location.href): boolean {
  const browser = detectInAppBrowser();

  if (browser === 'kakaotalk') {
    window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    return true;
  }

  if (browser === 'line') {
    const sep = url.includes('?') ? '&' : '?';
    window.location.href = url + sep + 'openExternalBrowser=1';
    return true;
  }

  const isAndroid = /android/i.test(navigator.userAgent);
  if (isAndroid) {
    const withoutScheme = url.replace(/^https?:\/\//, '');
    window.location.href =
      'intent://' +
      withoutScheme +
      '#Intent;scheme=https;package=com.android.chrome;end';
    return true;
  }

  // iOS 의 인스타/페북 등은 자동 전환 스킴이 없어 수동 안내가 필요하다.
  return false;
}
