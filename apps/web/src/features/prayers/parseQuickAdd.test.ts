import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './parseQuickAdd';

describe('parseQuickAdd', () => {
  it('토큰 없으면 전체가 제목', () => {
    const r = parseQuickAdd('엄마 건강 회복');
    expect(r.title).toBe('엄마 건강 회복');
    expect(r.category).toBeUndefined();
    expect(r.priority).toBeUndefined();
    expect(r.personName).toBeUndefined();
  });

  it('#한글 카테고리 인식', () => {
    const r = parseQuickAdd('#가족 건강 회복');
    expect(r.category).toBe('family');
    expect(r.title).toBe('건강 회복');
  });

  it('#영문 카테고리 인식 (대소문자 무관)', () => {
    expect(parseQuickAdd('#Church 부흥').category).toBe('church');
    expect(parseQuickAdd('#ministry 선교').category).toBe('ministry');
  });

  it('@대상자 인식', () => {
    const r = parseQuickAdd('@엄마 건강 회복');
    expect(r.personName).toBe('엄마');
    expect(r.title).toBe('건강 회복');
  });

  it('우선순위 키워드 인식 (영문/한글/!!)', () => {
    expect(parseQuickAdd('취업 high').priority).toBe('high');
    expect(parseQuickAdd('취업 긴급').priority).toBe('high');
    expect(parseQuickAdd('취업 !!').priority).toBe('high');
    expect(parseQuickAdd('취업 낮음').priority).toBe('low');
  });

  it('복합 입력 — 카테고리+대상자+우선순위+제목', () => {
    const r = parseQuickAdd('#가족 @엄마 건강 회복 high');
    expect(r.category).toBe('family');
    expect(r.personName).toBe('엄마');
    expect(r.priority).toBe('high');
    expect(r.title).toBe('건강 회복');
  });

  it('알 수 없는 해시태그는 # 떼고 제목에 포함', () => {
    const r = parseQuickAdd('#수술 잘되도록');
    expect(r.category).toBeUndefined();
    expect(r.title).toBe('수술 잘되도록');
  });

  it('토큰만 입력되면 원문을 제목으로 보존', () => {
    const r = parseQuickAdd('#가족 high');
    expect(r.category).toBe('family');
    expect(r.priority).toBe('high');
    expect(r.title).toBe('#가족 high');
  });

  it('여분 공백 정리', () => {
    const r = parseQuickAdd('  #교회   부흥   ');
    expect(r.category).toBe('church');
    expect(r.title).toBe('부흥');
  });

  it('@만 있으면 대상자로 보지 않는다', () => {
    const r = parseQuickAdd('@ 기도');
    expect(r.personName).toBeUndefined();
    expect(r.title).toContain('기도');
  });
});
