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

/** 'YYYY-MM-DD' → 자정 오차 없는 Date (정오 UTC 고정 — 어느 타임존에서도 날짜가 밀리지 않는다) */
function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** today를 포함해 거슬러 올라간 n일치 날짜를 오래된 순으로 반환 */
export function lastNDates(today: string, n: number): string[] {
  const base = parseDateStr(today);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 날짜 문자열의 요일 한 글자 (예: '금') */
export function weekdayLabel(dateStr: string): string {
  return WEEKDAYS[parseDateStr(dateStr).getUTCDay()];
}

/** 오늘 탭 상단용 긴 표기 (예: '금요일 · 9월 4일') */
export function formatLongKoreanDate(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return `${WEEKDAYS[d.getUTCDay()]}요일 · ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}
