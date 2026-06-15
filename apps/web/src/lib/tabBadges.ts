import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useFaithEnabled } from '@/lib/features';
import { timeOfDay } from '@/lib/dayBoundary';
import { useHabits, useHabitChecks } from '@/features/habits/useHabits';
import { usePrayers, usePrayerChecks, useDayDoc, useTodayPrayers } from '@/features/prayers/usePrayers';
import { useApplications, useApplicationChecks } from '@/features/applications/useApplications';
import type { TodayTodoDoc } from 'shared/types/firestore';

function useTodayTodos(date: string): TodayTodoDoc[] {
  const uid = useAppStore((s) => s.uid);
  const [todos, setTodos] = useState<TodayTodoDoc[]>([]);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(collection(db, 'users', uid, 'days', date, 'todayTodos')), (snap) => {
      setTodos(snap.docs.map((d) => d.data() as TodayTodoDoc));
    });
  }, [uid, date]);
  return todos;
}

/**
 * 하단 탭에 표시할 '미완료 할 일' 개수 — 스마트폰 앱 아이콘 배지처럼 탭별 숫자.
 * 경로(to)별 개수를 반환하며, 0 이하는 배지를 숨긴다.
 *
 * - `/`        오늘 탭: 미완료 오늘 할 일 + 회고 미작성(저녁·밤, Main의 넛지와 동일 기준)
 * - `/habits`  습관 탭: 미기록 습관(건너뜀은 체크 문서가 있어 제외)
 * - `/prayers` 신앙 탭: 오늘 미체크 기도제목 + 미이행 말씀 적용(신앙 기능 ON일 때만)
 */
export function useTabBadges(): Record<string, number> {
  const date = useAppStore((s) => s.currentDate);
  const faithEnabled = useFaithEnabled();

  // 습관 — 미기록(아직 손대지 않은) 습관 수
  const habits = useHabits();
  const habitChecks = useHabitChecks(date);
  const habitsTodo = habits.filter((h) => habitChecks[h.id] === undefined).length;

  // 오늘 — 회고(저녁·밤 미작성) + 미완료 오늘 할 일
  const { dayDoc } = useDayDoc(date);
  const todos = useTodayTodos(date);
  const tod = timeOfDay();
  const reflectionDue = !dayDoc?.reflection && (tod === 'evening' || tod === 'night') ? 1 : 0;
  const todosTodo = todos.filter((t) => !t.done).length;
  const todayTodo = reflectionDue + todosTodo;

  // 신앙 — 오늘 미체크 기도제목 + 미이행 말씀 적용
  const prayers = usePrayers();
  const prayerChecks = usePrayerChecks(date);
  const { pinned, rotation } = useTodayPrayers(prayers, dayDoc);
  const prayersTodo = [...pinned, ...rotation].filter((p) => !prayerChecks[p.id]).length;

  const apps = useApplications();
  const appChecks = useApplicationChecks(date);
  const appsTodo = apps.filter((a) => a.status === 'active' && !appChecks[a.id]).length;

  return {
    '/': todayTodo,
    '/habits': habitsTodo,
    '/prayers': faithEnabled ? prayersTodo + appsTodo : 0,
  };
}
