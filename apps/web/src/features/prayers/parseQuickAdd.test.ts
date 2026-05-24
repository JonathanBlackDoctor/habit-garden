import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './parseQuickAdd';

describe('parseQuickAdd', () => {
  it('토큰 없으면 전체가 제목', () => {
    const r = parseQuickAdd('엄마 건강 회복');
    expect(r.title).toBe('엄마 건강 회복');
    expect(r.group).toBeUndefined();
    expect(r.priority).toBeUndefined();
  });

  it('#모임 인식', () => {
    const r = parseQuickAdd('#교회 건강 회복');
    expect(r.group).toBe('교회');
    expect(r.title).toBe('건강 회복');
  });

  it('#영문 모임 인식 (표기 그대로 보존)', () => {
    expect(parseQuickAdd('#CMF 부흥').group).toBe('CMF');
    expect(parseQuickAdd('#개인 묵상').group).toBe('개인');
  });

  it('우선순위 키워드 인식 (영문/한글/!!)', () => {
    expect(parseQuickAdd('취업 high').priority).toBe('high');
    expect(parseQuickAdd('취업 긴급').priority).toBe('high');
    expect(parseQuickAdd('취업 !!').priority).toBe('high');
    expect(parseQuickAdd('취업 낮음').priority).toBe('low');
  });

  it('@대상 인식', () => {
    const r = parseQuickAdd('@엄마 건강 회복');
    expect(r.target).toBe('엄마');
    expect(r.title).toBe('건강 회복');
  });

  it('복합 입력 — 모임+대상+우선순위+제목', () => {
    const r = parseQuickAdd('#교회 @청년부 부흥 high');
    expect(r.group).toBe('교회');
    expect(r.target).toBe('청년부');
    expect(r.priority).toBe('high');
    expect(r.title).toBe('부흥');
  });

  it('@ 만 있으면 대상으로 보지 않는다', () => {
    const r = parseQuickAdd('@ 기도');
    expect(r.target).toBeUndefined();
    expect(r.title).toContain('기도');
  });

  it('토큰만 입력되면 원문을 제목으로 보존', () => {
    const r = parseQuickAdd('#교회 high');
    expect(r.group).toBe('교회');
    expect(r.priority).toBe('high');
    expect(r.title).toBe('#교회 high');
  });

  it('여분 공백 정리', () => {
    const r = parseQuickAdd('  #교회   부흥   ');
    expect(r.group).toBe('교회');
    expect(r.title).toBe('부흥');
  });

  it('# 만 있으면 모임으로 보지 않는다', () => {
    const r = parseQuickAdd('# 기도');
    expect(r.group).toBeUndefined();
    expect(r.title).toContain('기도');
  });
});
