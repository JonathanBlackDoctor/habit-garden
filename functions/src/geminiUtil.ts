/**
 * Gemini 호출 공통 유틸 — 레이트리밋(429) 친화 처리 + 1회 자동 재시도.
 */
import * as functions from 'firebase-functions/v1';

/** 모든 Gemini 호출이 쓰는 모델 ID. 모델 폐기 시 여기 한 곳만 바꾼다. */
export const GEMINI_MODEL = 'gemini-2.5-flash';

export const RATE_LIMIT_MESSAGE =
  '지금 AI 사용량이 잠시 초과됐어요. 1~2분 후 다시 시도해 주세요.';

/** 429 / 할당량 초과 / 레이트리밋 계열 에러인지 판별 */
export function isRateLimit(e: any): boolean {
  if (e?.status === 429) return true;
  return /\b429\b|too many requests|quota|rate limit/i.test(String(e?.message ?? ''));
}

/** 에러 메시지에서 retryDelay(초)를 추출해 ms로. 0~30000ms로 캡. */
function parseRetryDelayMs(e: any): number {
  const msg = String(e?.message ?? '');
  const m =
    msg.match(/retryDelay"?\s*:?\s*"?(\d+(?:\.\d+)?)\s*s/i) ??
    msg.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  const sec = m ? parseFloat(m[1]) : 0;
  return Math.min(Math.max(Math.ceil(sec * 1000), 0), 30000);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fn 실행 중 429가 나면 retryDelay(없으면 3초)만큼 한 번만 기다렸다 재시도한다.
 * 429가 아닌 에러는 즉시 원래 에러를 던진다.
 */
export async function callGeminiWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isRateLimit(e)) throw e;
    await delay(parseRetryDelayMs(e) || 3000);
    return await fn();
  }
}

/** 429면 callable 친화 코드(resource-exhausted)로, 그 외는 원래 에러를 던진다. */
export function throwIfRateLimit(e: any): void {
  if (isRateLimit(e)) {
    throw new functions.https.HttpsError('resource-exhausted', RATE_LIMIT_MESSAGE);
  }
}
