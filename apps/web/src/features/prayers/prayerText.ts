export const PRAYER_TEXT_FIELDS = ['title', 'body', 'answerNote'] as const;

/**
 * 과거 데이터에 남아 있을 수 있는 줄바꿈 표현을 하나의 형식(LF)으로 정규화한다.
 * - Windows CRLF/CR → LF
 * - 문자 그대로 저장된 "\\n"/"\\r\\n" → 실제 줄바꿈
 */
export function normalizePrayerText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\\r\\n|\\n|\\r/g, '\n');
}

/** Firestore 문서에서 실제 수정이 필요한 텍스트 필드만 반환한다. */
export function getPrayerTextRepairPatch(
  data: Record<string, unknown>,
): Record<string, string> {
  const patch: Record<string, string> = {};

  for (const field of PRAYER_TEXT_FIELDS) {
    const value = data[field];
    if (typeof value !== 'string') continue;
    const normalized = normalizePrayerText(value);
    if (normalized !== value) patch[field] = normalized;
  }

  return patch;
}
