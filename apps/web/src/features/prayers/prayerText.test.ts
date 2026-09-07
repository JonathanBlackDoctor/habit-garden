import { describe, expect, it } from 'vitest';
import { getPrayerTextRepairPatch, normalizePrayerText } from './prayerText';

describe('prayer text line-break normalization', () => {
  it('keeps normal LF line breaks unchanged', () => {
    expect(normalizePrayerText('첫째\n둘째\n\n넷째')).toBe('첫째\n둘째\n\n넷째');
  });

  it('normalizes CRLF and CR to LF', () => {
    expect(normalizePrayerText('첫째\r\n둘째\r셋째')).toBe('첫째\n둘째\n셋째');
  });

  it('converts legacy escaped line breaks into real line breaks', () => {
    expect(normalizePrayerText('첫째\\n둘째\\r\\n셋째')).toBe('첫째\n둘째\n셋째');
  });

  it('returns only fields that actually need repair', () => {
    expect(getPrayerTextRepairPatch({
      title: '기도 제목',
      body: '하나\\n둘',
      answerNote: '응답\r\n감사',
      group: '개인',
    })).toEqual({
      body: '하나\n둘',
      answerNote: '응답\n감사',
    });
  });
});
