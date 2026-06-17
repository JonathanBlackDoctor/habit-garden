/**
 * 포인트 원장(pointLedger) 표시 도우미.
 * 서버 함수·클라이언트 곳곳에서 기록하는 reason 문자열을 사람이 읽는 한글 라벨·이모지로 변환한다.
 * (reason 종류는 functions/src/*Award.ts · habitPenalty.ts · gardenAutogrow.ts ·
 *  apps/web/src/features/garden/useGarden.ts 등 적립/차감 지점과 1:1 대응)
 */
import { BADGE_DEFS, PLANT_SPECIES } from 'shared/types/firestore';

export interface PointReasonInfo {
  label: string;
  emoji: string;
}

// 고정 reason → 라벨·이모지
const STATIC: Record<string, PointReasonInfo> = {
  // ── 습관 ──
  habit_achieved:          { label: '습관 달성',            emoji: '✅' },
  habit_partial:           { label: '습관 시도 인정',        emoji: '✅' },
  habit_achieved_comeback: { label: '습관 달성 · 회복기',    emoji: '✅' },
  habit_partial_comeback:  { label: '습관 시도 · 회복기',    emoji: '✅' },
  habit_downgrade:         { label: '습관 점수 하향',        emoji: '↩️' },
  // ── 연속(스트릭) ──
  streak_combo:          { label: '연속 달성 콤보',        emoji: '🔥' },
  streak_combo_comeback: { label: '연속 달성 콤보 · 회복기', emoji: '🔥' },
  streak_combo_revert:   { label: '연속 콤보 회수',        emoji: '↩️' },
  daily_success:         { label: '오늘 성공 보너스',      emoji: '🌟' },
  // ── 회고 ──
  reflection: { label: '회고 작성', emoji: '✍️' },
  // ── 기도 ──
  prayer_check:          { label: '기도 체크',          emoji: '🙏' },
  prayer_uncheck:        { label: '기도 체크 해제',      emoji: '↩️' },
  prayer_list_complete:  { label: '오늘 기도 목록 완료', emoji: '🙏' },
  prayer_streak_7:       { label: '기도 7일 연속',      emoji: '🔥' },
  prayer_streak_30:      { label: '기도 30일 연속',     emoji: '🔥' },
  prayer_answered:       { label: '기도 응답 기록',      emoji: '🕊️' },
  // ── 할 일 ──
  todo_check:   { label: '할 일 완료',     emoji: '📝' },
  todo_uncheck: { label: '할 일 완료 해제', emoji: '↩️' },
  // ── 말씀 적용 ──
  application_check:    { label: '말씀 적용 실천',     emoji: '📖' },
  application_uncheck:  { label: '말씀 적용 실천 해제', emoji: '↩️' },
  application_complete: { label: '말씀 적용 완료',     emoji: '📖' },
  // ── 레벨·정원 ──
  levelup_reward:      { label: '레벨업 보상',      emoji: '🎉' },
  passive_yield:       { label: '정원 자동 수확',    emoji: '🌿' },
  harvest_plant:       { label: '식물 수확',        emoji: '🌾' },
  transcendent_upkeep: { label: '초월 식물 유지비',  emoji: '🌌' },
  spend_plant:           { label: '씨앗 심기',           emoji: '🪴' },
  spend_plant_rare_drop: { label: '씨앗 심기 · 희귀 드롭!', emoji: '🍀' },
  spend_water:           { label: '물주기',             emoji: '💧' },
  unlock_species:        { label: '식물 종 해금',        emoji: '🔓' },
  // ── 패널티·기타 ──
  habit_penalty:    { label: '습관 미완료 패널티', emoji: '⚠️' },
  use_freeze_token: { label: '스트릭 보호 토큰',   emoji: '🧊' },
  starter_bonus:    { label: '시작 보너스',        emoji: '🎁' },
};

/** reason 문자열을 한글 라벨·이모지로 변환. 알 수 없는 reason 은 원문을 그대로 보여준다. */
export function describePointReason(reason: string): PointReasonInfo {
  const fixed = STATIC[reason];
  if (fixed) return fixed;

  // ── 동적 reason ──
  if (reason.startsWith('badge_')) {
    const id = reason.slice('badge_'.length);
    const def = BADGE_DEFS.find((b) => b.id === id);
    return { label: def ? `배지 · ${def.title}` : '배지 획득', emoji: '🏅' };
  }
  if (reason.startsWith('streak_milestone_')) {
    const n = reason.slice('streak_milestone_'.length);
    return { label: `${n}일 스트릭 달성`, emoji: '🔥' };
  }
  if (reason.startsWith('season_')) {
    return { label: '시즌 챌린지 보상', emoji: '🏆' };
  }
  if (reason.startsWith('weekly_quest_')) {
    return { label: '주간 퀘스트 보상', emoji: '🎯' };
  }

  return { label: reason, emoji: '•' };
}

/** refId 가 식물 종(species) id 면 종 이름을 붙여 부가 설명으로 돌려준다. (심기·해금 등) */
export function describePointRef(reason: string, refId?: string | null): string | null {
  if (!refId) return null;
  if (reason === 'spend_plant' || reason === 'spend_plant_rare_drop' || reason === 'unlock_species') {
    const species = PLANT_SPECIES.find((s) => s.id === refId);
    if (species) return species.name;
  }
  return null;
}
