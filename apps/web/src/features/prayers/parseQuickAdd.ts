import type { PrayerCategory, PrayerPriority } from 'shared/types/firestore';

export interface QuickParseResult {
  title: string;
  category?: PrayerCategory;
  priority?: PrayerPriority;
  personName?: string;
}

// #토큰 → 카테고리 (영문 키 + 한글 라벨 모두 허용)
const CATEGORY_TOKENS: Record<string, PrayerCategory> = {
  self: 'self', 자신: 'self', 나: 'self',
  family: 'family', 가족: 'family',
  church: 'church', 교회: 'church',
  ministry: 'ministry', 사역: 'ministry',
  friend: 'friend', 지인: 'friend', 친구: 'friend',
  other: 'other', 기타: 'other',
};

// 단독 토큰 → 우선순위 (사용자 약식 입력용)
const PRIORITY_TOKENS: Record<string, PrayerPriority> = {
  high: 'high', 높음: 'high', 긴급: 'high', 중요: 'high', '!': 'high', '!!': 'high',
  mid: 'mid', 보통: 'mid', 중간: 'mid',
  low: 'low', 낮음: 'low', 나중: 'low',
};

/**
 * 한 줄 자연어 입력을 파싱한다.
 *  - `#가족` / `#family` → 카테고리
 *  - `@엄마` → 대상자
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

    if (raw.startsWith('#')) {
      const key = raw.slice(1).toLowerCase();
      if (key in CATEGORY_TOKENS) { result.category = CATEGORY_TOKENS[key]; continue; }
      titleWords.push(raw.slice(1));   // 알 수 없는 해시태그는 # 떼고 제목에 포함
      continue;
    }

    if (raw.startsWith('@') && raw.length > 1) {
      result.personName = raw.slice(1);
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
