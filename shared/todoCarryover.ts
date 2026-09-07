/**
 * '오늘 할 일' 이월 선택 로직 (순수 함수) — 서버(dailyReset)와 클라이언트(Planner)가 공유한다.
 *
 * 이월은 매일 어제→오늘로 사슬처럼 이어지지만, 그 사슬은 dailyReset 이 매일 돌고
 * 사용자가 매일 앱을 연다는 가정에 의존한다. 서버가 하루라도 거르거나 사용자가
 * 며칠 접속하지 않아 사슬이 끊기면, 미완료 항목이 과거 어느 날에 고립되어 사라진 것처럼 보인다.
 * 그래서 한 날만 보지 않고, '미완료가 남은 가장 최근 과거 날짜'까지 거슬러 찾아 복구한다.
 *
 * 핵심 규칙: 후보 날짜(최신순) 중 미완료가 하나라도 있는 '첫(=가장 최근) 날'만 이월한다.
 * 장기 할 일로 이동한 날은 명시적인 복구 경계다. 그 날의 나머지는 이월하되,
 * 더 과거에 보존된 복사본을 다시 가져와 이동을 되돌리지 않는다.
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
  /** 이 날 이전의 기록은 장기 이동 전 보존용 복사본이므로 복구하지 않는다. */
  todoCarryoverClosed?: boolean;
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

/** Stop reading older dates once there is pending work or an explicit boundary. */
export function isCarryoverBoundary(day: CarryDay): boolean {
  return day.todoCarryoverClosed === true || day.todos.some((todo) => !todo.done);
}

/**
 * 후보 과거 날짜들(최신순)에서 미완료가 남은 가장 최근 날짜를 찾아,
 * 그 날의 미완료(done=false) 항목만 이월 대상으로 돌려준다.
 * 완료 항목은 제외하고, title 과 linkedLongTodoId(있을 때만) 만 옮긴다.
 * 명시적인 장기 이동 경계가 비어 있어도 더 오래된 사본은 복구하지 않는다.
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
    if (day.todoCarryoverClosed) break;
  }
  return { sourceDate: null, items: [] };
}
