import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TodayTodoDoc } from 'shared/types/firestore';

export interface MoveTodayTodoResult {
  longTodoId: string;
  alreadyMoved: boolean;
}

/**
 * Move, rather than copy: the destination, receipt, carryover boundary and
 * source deletion commit together. The receipt makes retries/multiple tabs
 * idempotent and retains the original daily title and carryover metadata even
 * when returning a task to an existing linked long-term goal.
 *
 * Call only after the day's carryover has completed. Closing that day's
 * historical fallback prevents an older, preserved copy from reappearing.
 */
export async function moveTodayTodoToLong(
  uid: string,
  date: string,
  todoId: string,
): Promise<MoveTodayTodoResult> {
  if (!uid || !todoId || uid.includes('/') || todoId.includes('/') || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('할 일 정보를 확인한 뒤 다시 시도해 주세요.');
  }

  const sourceRef = doc(db, 'users', uid, 'days', date, 'todayTodos', todoId);
  const dayRef = doc(db, 'users', uid, 'days', date);
  const moveId = `${date}_${todoId}`;
  const receiptRef = doc(db, 'users', uid, 'todoMoves', moveId);

  return runTransaction(db, async (tx) => {
    const receipt = await tx.get(receiptRef);
    if (receipt.exists()) {
      return { longTodoId: receipt.data().longTodoId as string, alreadyMoved: true };
    }

    const source = await tx.get(sourceRef);
    if (!source.exists()) {
      throw new Error('이미 삭제되었거나 이동된 할 일이에요.');
    }
    // Always read the latest server data, not a potentially stale UI object.
    const todo = { ...source.data(), id: todoId } as TodayTodoDoc;
    if (todo.done) {
      throw new Error('완료한 할 일은 완료를 취소한 뒤 이동해 주세요.');
    }
    if (typeof todo.title !== 'string' || !todo.title.trim()) {
      throw new Error('할 일 제목을 확인한 뒤 다시 시도해 주세요.');
    }

    const day = await tx.get(dayRef);
    if (!day.exists() || !day.data().todosCarriedOver) {
      throw new Error('이월된 할 일을 확인한 뒤 다시 시도해 주세요.');
    }

    const longTodoId = todo.linkedLongTodoId || `today_${moveId}`;
    const targetRef = doc(db, 'users', uid, 'longTodos', longTodoId);
    const target = await tx.get(targetRef);

    // All transaction reads must finish before the first write.
    if (!target.exists()) {
      tx.set(targetRef, {
        id: longTodoId,
        title: todo.title,
        priority: 'mid',
        progress: 0,
        done: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (target.data().done) {
      // Match the existing archive's restore behavior; preserve progress,
      // priority, deadline and title rather than overwriting the linked goal.
      tx.update(targetRef, { done: false, updatedAt: serverTimestamp() });
    }

    tx.set(receiptRef, {
      longTodoId,
      sourceDate: date,
      sourceTodo: todo,
      movedAt: serverTimestamp(),
    });
    tx.set(dayRef, {
      todoCarryoverClosed: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    tx.delete(sourceRef);

    return { longTodoId, alreadyMoved: false };
  });
}
