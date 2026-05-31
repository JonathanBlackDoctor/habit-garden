/**
 * '오늘 할 일' 이월 선택 로직 (순수 함수) — 서버(dailyReset)와 클라이언트(Planner)가 공유한다.
 *
 * 이월은 매일 어제→오늘로 사슬처럼 이어지지만, 그 사슬은 dailyReset 이 매일 돌고
 * 사용자가 매일 앱을 연다는 가정에 의존한다. 서버가 하루라도 거르거나 사용자가
 * 며칠 접속하지 않아 사슬이 끊기면, 미완료 항목이 과거 어느 날에 고립되어 사라진 것처럼 보인다.
 * 그래서 한 날만 보지 않고, '미완료가 남은 가장 최근 과거 날짜'까지 거슬러 찾아 복구한다.
 *
 * 핵심 규칙: 후보 날짜(최신순) 중 미완료가 하나라도 있는 '첫(=가장 최근) 날'만 이월한다.
 * 더 과거 날짜에 남아 있는 항목은 그 최근 날로 이미 사슬 복사돼 있거나 보존용 원본이므로,
 * 가장 최근 한 날만 가져와야 중복 이월을 막는다.
 */

/** 거슬러 찾을 최대 일수 — 서버/클라 공통. */
export const CARRY_LOOKBACK_DAYS = 14;

/** 이월 판단에 필요한 todo 의 최소 형태 (TodayTodoDoc 와 구조 호환). */
export interface CarryTodo {
  done: boolean;
  title: string;
  linkedLongTodoId?: string;
}

/** 한 과거 날짜와 그 날의 todo 목록. */
export interface CarryDay {
  date: string;            // 'YYYY-MM-DD'
  todos: CarryTodo[];
}

/** 이월돼 새로 만들어질 항목의 내용. */
export interface CarryItem {
  title: string;
  linkedLongTodoId?: string;
}

export interface CarryResult {
  /** 이월 출처 날짜. 가져올 게 없으면 null. */
  sourceDate: string | null;
  /** 오늘로 복사할 미완료 항목들. */
  items: CarryItem[];
}

/**
 * 후보 과거 날짜들(최신순)에서 미완료가 남은 가장 최근 날짜를 찾아,
 * 그 날의 미완료(done=false) 항목만 이월 대상으로 돌려준다.
 * 완료 항목은 제외하고, title 과 linkedLongTodoId(있을 때만) 만 옮긴다.
 */
export function selectCarryOverItems(days: CarryDay[]): CarryResult {
  for (const day of days) {
    const pending = day.todos.filter((t) => !t.done);
    if (pending.length > 0) {
      return {
        sourceDate: day.date,
        items: pending.map((t) => ({
          title: t.title,
          ...(t.linkedLongTodoId ? { linkedLongTodoId: t.linkedLongTodoId } : {}),
        })),
      };
    }
  }
  return { sourceDate: null, items: [] };
}
