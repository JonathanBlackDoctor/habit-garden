import { describe, expect, it } from 'vitest';
import { getPrayerTextRepairPatch, normalizePrayerText, restoreInlinePrayerBullets, isSafePrayerLineBreakRepair } from './prayerText';

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

  it('restores multiple flattened bullet requests without rewriting text', () => {
    expect(restoreInlinePrayerBullets('- 수술 잘 되도록 - 회복하도록'))
      .toBe('- 수술 잘 되도록\\n- 회복하도록');
    expect(restoreInlinePrayerBullets('1. 학업 2. 가족')).toBe('1. 학업\\n2. 가족');
  });

  it('does not invent breaks when the original has one prayer or no marker', () => {
    expect(restoreInlinePrayerBullets('예배 잘 드리도록')).toBe('예배 잘 드리도록');
    expect(restoreInlinePrayerBullets('- 한 가지 기도')).toBe('- 한 가지 기도');
  });

  it('accepts only AI corrections that preserve every non-whitespace character', () => {
    expect(isSafePrayerLineBreakRepair('첫 번째 기도 두 번째 기도', '첫 번째 기도\\n두 번째 기도'))
      .toBe(true);
    expect(isSafePrayerLineBreakRepair('건강 회복', '건강 회복과 평안\\n')).toBe(false);
    expect(isSafePrayerLineBreakRepair('한 문장', '한 문장')).toBe(false);
  });
});
