import { subHours } from 'date-fns';
import { format, toZonedTime } from 'date-fns-tz';

const KST = 'Asia/Seoul';

/** 주어진 시각이 속하는 '플래너 날짜'를 YYYY-MM-DD로 반환 (04:00 경계) */
export function plannerDate(date: Date = new Date()): string {
  const kst = toZonedTime(date, KST);
  const shifted = subHours(kst, 4);
  return format(shifted, 'yyyy-MM-dd', { timeZone: KST });
}

/** 지금이 속한 시간대 반환 */
export function timeOfDay(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = toZonedTime(date, KST).getHours();
  if (h >= 4 && h < 11)  return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

/** 날짜 문자열을 한국어 표시 (예: 5/21(수)) */
export function formatKoreanDate(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const d = new Date(dateStr + 'T04:00:00+09:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = days[d.getDay()];
  return `${month}/${day}(${dow})`;
}
