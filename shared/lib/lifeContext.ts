/**
 * 생활 환경(LifeContext) 직렬화 — 클라이언트(요약 표시)와 Functions(AI 프롬프트) 공용 순수 모듈.
 *
 * 말씀 적용 AI(parseApplication)는 사용자의 생활 환경을 모르면 "이웃을 사랑하라" 같은
 * 막연한 적용밖에 못 준다. 채워진 항목만 모아 프롬프트에 넘겨, 적용점이 사용자의 실제
 * 직업·가정·일과·관계·고민에 맞게 구체적으로 나오도록 한다.
 */
import type { LifeContext } from '../types/firestore';

const FIELD_LABELS: Array<[keyof LifeContext, string]> = [
  ['role', '직업·신분'],
  ['family', '가정 상황'],
  ['routine', '하루 일과'],
  ['people', '자주 만나는 사람'],
  ['focus', '요즘 영적 고민·바라는 변화'],
  ['memo', '그 밖에'],
];

/** 채워진 항목이 하나라도 있는지 */
export function hasLifeContext(ctx?: LifeContext | null): boolean {
  if (!ctx) return false;
  return FIELD_LABELS.some(([k]) => typeof ctx[k] === 'string' && (ctx[k] as string).trim());
}

/**
 * AI 프롬프트에 넣을 컨텍스트 블록. 채워진 항목이 없으면 빈 문자열.
 * 항목값은 안전을 위해 길이를 제한한다(프롬프트 주입·과금 방지).
 */
export function formatLifeContext(ctx?: LifeContext | null): string {
  if (!ctx) return '';
  const lines = FIELD_LABELS
    .map(([k, label]) => {
      const v = ctx[k];
      if (typeof v !== 'string') return null;
      const t = v.trim().slice(0, 300);
      return t ? `- ${label}: ${t}` : null;
    })
    .filter((l): l is string => l !== null);
  return lines.join('\n');
}
