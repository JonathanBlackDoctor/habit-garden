/**
 * AI 사용 불가 시 원문을 임시 항목으로 나눈다.
 * 사람/대상을 추측하거나 내용을 요약하지 않고, 최대 100개 검토 항목에 모든 입력을 보존한다.
 */
export interface FallbackPrayerItem {
  title: string;
  body: string;
  target: string;
}

export function fallbackParsePrayerText(rawText: string): FallbackPrayerItem[] {
  const normalized = rawText.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n[ \t]*\n/).map((p) => p.trim()).filter(Boolean);
  const linesOrParagraphs = paragraphs.length > 1
    ? paragraphs
    : normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const chunks = linesOrParagraphs.slice(0, 99);
  if (linesOrParagraphs.length >= 100) {
    chunks.push(linesOrParagraphs.slice(99).join('\n'));
  }

  return chunks.map((chunk) => {
    const content = chunk.trim();
    const firstLine = content.split('\n')[0]?.trim() ?? '';
    const title = firstLine.replace(/^[-•*]\s*/, '').slice(0, 60).trim() || '기도제목';
    return {
      title,
      // 제목의 60자 제한에 걸리거나 여러 줄이어도 본문에 원문 전체를 보존한다.
      body: content === title ? '' : content,
      target: '나 자신',
    };
  });
}
