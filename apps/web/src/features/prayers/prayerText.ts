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


/**
 * 과거 일괄 등록 본문에 한 줄로 붙은 불릿/번호 목록을 복원한다.
 * 추측으로 문장을 분리하지 않으며, 글자는 고치지 않고 불릿 앞 공백만 LF로 바꾼다.
 */
export function restoreInlinePrayerBullets(value: string): string {
  const normalized = normalizePrayerText(value);
  if (normalized.includes('\n')) return normalized;
  const bullets = normalized.match(/(?:^|[ \t])[-•][ \t]+\S/g) ?? [];
  if (bullets.length >= 2) {
    return normalized.replace(/[ \t]+(?=[-•][ \t]+\S)/g, '\n');
  }
  const numbered = normalized.match(/(?:^|[ \t])\d+[.)][ \t]+\S/g) ?? [];
  if (numbered.length >= 2) {
    return normalized.replace(/[ \t]+(?=\d+[.)][ \t]+\S)/g, '\n');
  }
  return normalized;
}

/** AI 교정 시 원본의 모든 비공백 문자를 보존해야 한다. */
export function isSafePrayerLineBreakRepair(original: string, next: string): boolean {
  return typeof original === 'string' && typeof next === 'string'
    && next.includes('\n')
    && original.replace(/\s/g, '') === next.replace(/\s/g, '');
}
