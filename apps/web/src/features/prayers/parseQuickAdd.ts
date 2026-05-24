import type { PrayerPriority } from 'shared/types/firestore';

export interface QuickParseResult {
  title: string;
  group?: string;
  priority?: PrayerPriority;
}

// 단독 토큰 → 우선순위 (사용자 약식 입력용)
const PRIORITY_TOKENS: Record<string, PrayerPriority> = {
  high: 'high', 높음: 'high', 긴급: 'high', 중요: 'high', '!': 'high', '!!': 'high',
  mid: 'mid', 보통: 'mid', 중간: 'mid',
  low: 'low', 낮음: 'low', 나중: 'low',
};

/**
 * 한 줄 자연어 입력을 파싱한다.
 *  - `#교회` / `#CMF` 등 → 받은 모임 (해시태그 뒤 문자열을 그대로 사용)
 *  - 단독 `high`/`높음`/`!!` 등 → 우선순위
 *  - 나머지 단어 → 제목
 *
 * 토큰을 못 찾으면 입력 전체가 제목이 된다(파괴적이지 않음).
 */
export function parseQuickAdd(input: string): QuickParseResult {
  const result: QuickParseResult = { title: input.trim() };
  const titleWords: string[] = [];

  for (const raw of input.trim().split(/\s+/)) {
    if (!raw) continue;

    if (raw.startsWith('#') && raw.length > 1) {
      result.group = raw.slice(1);
      continue;
    }

    const lower = raw.toLowerCase();
    if (lower in PRIORITY_TOKENS) { result.priority = PRIORITY_TOKENS[lower]; continue; }

    titleWords.push(raw);
  }

  const title = titleWords.join(' ').trim();
  result.title = title || input.trim();   // 토큰만 입력된 경우 원문 보존
  return result;
}
