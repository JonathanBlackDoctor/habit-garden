import { describe, expect, it } from 'vitest';
import { PRAYER_PRIORITY_LABELS, PRAYER_ROTATION_DEFAULTS } from './types/firestore';
import { fallbackParsePrayerText } from './prayerBulkFallback';

describe('AI-free prayer bulk review fallback', () => {
  it('does not invent items for blank text', () => {
    expect(fallbackParsePrayerText(' \n\t ')).toEqual([]);
  });

  it('preserves separate unstructured lines for review', () => {
    const result = fallbackParsePrayerText('철수 건강\r\n영희 시험');
    expect(result.map((item) => item.title)).toEqual(['철수 건강', '영희 시험']);
    expect(result.every((item) => item.target === '나 자신')).toBe(true);
  });

  it('keeps related lines in separated paragraphs together without losing text', () => {
    const result = fallbackParsePrayerText('철수\n- 건강\n- 취업\n\n영희\n- 시험');
    expect(result).toHaveLength(2);
    expect(result[0].body).toBe('철수\n- 건강\n- 취업');
    expect(result[1].body).toBe('영희\n- 시험');
  });

  it('preserves text past the short title limit', () => {
    const long = '기도 부탁드립니다 '.repeat(20);
    const [item] = fallbackParsePrayerText(long);
    expect(item.title.length).toBeLessThanOrEqual(60);
    expect(item.body).toBe(long.trim());
  });

  it('keeps overflow source text within 100 reviewable entries', () => {
    const result = fallbackParsePrayerText(Array.from({ length: 105 }, (_, i) => '기도 ' + i).join('\n'));
    expect(result).toHaveLength(100);
    expect(result[99].body).toContain('기도 104');
  });
});

describe('prayer exposure wording', () => {
  it('shows frequency, without changing the existing rotation config', () => {
    expect(PRAYER_PRIORITY_LABELS).toEqual({ high: '자주', mid: '보통', low: '가끔' });
    expect(PRAYER_ROTATION_DEFAULTS.high.baseInterval).toBe(2);
    expect(PRAYER_ROTATION_DEFAULTS.mid.baseInterval).toBe(5);
    expect(PRAYER_ROTATION_DEFAULTS.low.baseInterval).toBe(10);
  });
});
