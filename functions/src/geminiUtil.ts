/**
 * Gemini 호출 공통 유틸 — 레이트리밋(429) 친화 처리 + 1회 자동 재시도.
 */
import * as functions from 'firebase-functions/v1';

/**
 * 모든 Gemini 호출이 쓰는 모델 ID. 모델 폐기 시 여기 한 곳만 바꾼다.
 * gemini-2.5-flash 는 2026-06-17 종료(폐기 단계에서 무료 티어 호출 거부) →
 * 2026-05-19 GA 된 안정판 gemini-3.5-flash 로 이전.
 */
export const GEMINI_MODEL = 'gemini-3.5-flash';

export const RATE_LIMIT_MESSAGE =
  '지금 AI 사용량이 잠시 초과됐어요. 1~2분 후 다시 시도해 주세요.';

export const DAILY_QUOTA_MESSAGE =
  '오늘의 무료 AI 사용량을 모두 사용했어요. 사용량은 매일 오후 4~5시(태평양 자정)에 초기화돼요.';

export const QUOTA_CONFIG_MESSAGE =
  'AI 호출이 계속 거부되고 있어요(허용량 0). API 키 프로젝트의 결제·쿼터 설정 확인이 필요해요.';

/** 429 / 할당량 초과 / 레이트리밋 계열 에러인지 판별 */
export function isRateLimit(e: any): boolean {
  if (e?.status === 429) return true;
  return /\b429\b|too many requests|quota|rate limit/i.test(String(e?.message ?? ''));
}

/** 모델 폐기·오타 등으로 모델 자체를 찾지 못한 에러인지 판별 */
export function isModelNotFound(e: any): boolean {
  if (e?.status === 404) return true;
  return /\b404\b|not found|is not supported/i.test(String(e?.message ?? ''));
}

/**
 * 429 의 세부 원인에 맞는 사용자 메시지.
 * - 허용량 자체가 0(키 프로젝트 설정 문제) → 재시도해도 소용없음을 알린다.
 * - 일일 쿼터 소진 → "1~2분 후 재시도" 대신 초기화 시점을 알린다.
 */
export function rateLimitMessage(e: any): string {
  const msg = String(e?.message ?? '');
  if (/limit:\s*0\b|"quotaValue"\s*:\s*"?0"?\b/i.test(msg)) return QUOTA_CONFIG_MESSAGE;
  if (/perday|per day/i.test(msg)) return DAILY_QUOTA_MESSAGE;
  return RATE_LIMIT_MESSAGE;
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
    throw new functions.https.HttpsError('resource-exhausted', rateLimitMessage(e));
  }
}
