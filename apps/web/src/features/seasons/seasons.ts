export interface SeasonDef {
  id: string;
  title: string;
  emoji: string;
  startMonth: 1 | 4 | 7 | 10;
  endMonth: 3 | 6 | 9 | 12;
  /** 누적 달성 체크 수 기준 보상 단계 */
  tiers: Array<{ at: number; rewardId: string; title: string }>;
}

export const SEASON_DEFS: SeasonDef[] = [
  {
    id: 'spring', title: '봄의 정원', emoji: '🌸', startMonth: 3, endMonth: 5,
    tiers: [
      { at: 30,  rewardId: 'deco_butterfly', title: '나비 장식' },
      { at: 80,  rewardId: 'plant_cherry',   title: '벚꽃 묘목' },
      { at: 150, rewardId: 'badge_spring',   title: '봄 정원사 배지' },
    ],
  } as unknown as SeasonDef,
  {
    id: 'summer', title: '여름의 햇살', emoji: '☀️', startMonth: 6, endMonth: 8,
    tiers: [
      { at: 30,  rewardId: 'deco_lantern',  title: '풍등' },
      { at: 80,  rewardId: 'plant_lemon',   title: '레몬 나무' },
      { at: 150, rewardId: 'badge_summer',  title: '여름 정원사 배지' },
    ],
  } as unknown as SeasonDef,
  {
    id: 'autumn', title: '가을의 결실', emoji: '🍂', startMonth: 9, endMonth: 11,
    tiers: [
      { at: 30,  rewardId: 'deco_pumpkin',  title: '호박' },
      { at: 80,  rewardId: 'plant_persim',  title: '감나무' },
      { at: 150, rewardId: 'badge_autumn',  title: '가을 정원사 배지' },
    ],
  } as unknown as SeasonDef,
  {
    id: 'winter', title: '겨울의 인내', emoji: '❄️', startMonth: 12, endMonth: 2,
    tiers: [
      { at: 30,  rewardId: 'deco_snowman',  title: '눈사람' },
      { at: 80,  rewardId: 'plant_pine',    title: '소나무' },
      { at: 150, rewardId: 'badge_winter',  title: '겨울 정원사 배지' },
    ],
  } as unknown as SeasonDef,
];

export function currentSeason(date: string): SeasonDef {
  const m = new Date(date).getMonth() + 1; // 1~12
  if (m >= 3 && m <= 5)  return SEASON_DEFS[0];
  if (m >= 6 && m <= 8)  return SEASON_DEFS[1];
  if (m >= 9 && m <= 11) return SEASON_DEFS[2];
  return SEASON_DEFS[3];
}

/** 시즌 ID 를 'YYYY-season' 형태로 정규화 (예: '2026-spring'). */
export function seasonInstanceId(date: string): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const s = currentSeason(date).id;
  // 겨울은 12~2월 — 1,2월은 전년도 겨울 시즌으로 본다
  const adjustedYear = (s === 'winter' && d.getMonth() + 1 < 3) ? y - 1 : y;
  return `${adjustedYear}-${s}`;
}
