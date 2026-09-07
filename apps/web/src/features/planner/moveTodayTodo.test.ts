import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moveTodayTodoToLong } from './moveTodayTodo';

type Data = Record<string, unknown>;
type Ref = { path: string; id: string };
type Tx = {
  get: (ref: Ref) => Promise<{ exists: () => boolean; data: () => Data }>;
  set: (ref: Ref, data: Data, options?: { merge: boolean }) => void;
  update: (ref: Ref, data: Data) => void;
  delete: (ref: Ref) => void;
};

const harness = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  failCommit: false,
  retry: false,
  transactions: 0,
  committedWrites: [] as string[],
}));

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]): Ref => ({
    path: parts.join('/'), id: parts[parts.length - 1],
  }),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  runTransaction: async (_db: unknown, callback: (tx: Tx) => Promise<unknown>) => {
    harness.transactions++;
    for (let attempt = 0; attempt < 2; attempt++) {
      const writes: Array<() => void> = [];
      let wrote = false;
      const tx: Tx = {
        get: async (ref) => {
          if (wrote) throw new Error('Firestore reads must precede writes');
          const data = harness.documents.get(ref.path);
          return { exists: () => data !== undefined, data: () => ({ ...data }) };
        },
        set: (ref, data, options) => {
          wrote = true;
          writes.push(() => {
            harness.documents.set(ref.path, options?.merge
              ? { ...harness.documents.get(ref.path), ...data }
              : { ...data });
            harness.committedWrites.push(ref.path);
          });
        },
        update: (ref, data) => {
          wrote = true;
          writes.push(() => {
            harness.documents.set(ref.path, { ...harness.documents.get(ref.path), ...data });
            harness.committedWrites.push(ref.path);
          });
        },
        delete: (ref) => {
          wrote = true;
          writes.push(() => {
            harness.documents.delete(ref.path);
            harness.committedWrites.push(ref.path);
          });
        },
      };
      const result = await callback(tx);
      // Simulate Firestore discarding an attempt before retrying its callback.
      if (harness.retry && attempt === 0) continue;
      if (harness.failCommit) throw new Error('permission-denied');
      writes.forEach((apply) => apply());
      return result;
    }
    throw new Error('Unexpected transaction retry count');
  },
}));

const uid = 'user-1';
const date = '2026-09-07';
const id = 'daily-1';
const dayPath = `users/${uid}/days/${date}`;
const sourcePath = `${dayPath}/todayTodos/${id}`;
const receiptPath = `users/${uid}/todoMoves/${date}_${id}`;
const targetId = `today_${date}_${id}`;
const targetPath = `users/${uid}/longTodos/${targetId}`;
const source = { id: 'legacy-sort-key', title: '시험 준비 계획 세우기', done: false };

function seed(patch: Data = {}) {
  harness.documents.set(sourcePath, { ...source, ...patch });
}

beforeEach(() => {
  harness.documents.clear();
  harness.failCommit = false;
  harness.retry = false;
  harness.transactions = 0;
  harness.committedWrites = [];
  harness.documents.set(dayPath, {
    date, todosCarriedOver: true, condition: { energyScore: 80 },
  });
  seed();
});

describe('moveTodayTodoToLong', () => {
  it('creates an active normal-priority goal and removes the daily source atomically', async () => {
    expect(await moveTodayTodoToLong(uid, date, id)).toEqual({
      longTodoId: targetId, alreadyMoved: false,
    });
    expect(harness.documents.get(targetPath)).toEqual({
      id: targetId, title: source.title, priority: 'mid', progress: 0,
      done: false, createdAt: 'SERVER_TIMESTAMP', updatedAt: 'SERVER_TIMESTAMP',
    });
    expect(harness.documents.has(sourcePath)).toBe(false);
    expect(harness.committedWrites).toHaveLength(4);
  });

  it('preserves the actual document id and carryover metadata in the move receipt', async () => {
    seed({ carriedFrom: '2026-09-06' });
    await moveTodayTodoToLong(uid, date, id);
    expect(harness.documents.get(receiptPath)).toMatchObject({
      longTodoId: targetId, sourceDate: date,
      sourceTodo: { ...source, id, carriedFrom: '2026-09-06' },
    });
  });

  it('closes historical fallback without overwriting other day fields', async () => {
    await moveTodayTodoToLong(uid, date, id);
    expect(harness.documents.get(dayPath)).toMatchObject({
      date, todosCarriedOver: true, todoCarryoverClosed: true,
      condition: { energyScore: 80 },
    });
  });

  it('uses the latest stored title rather than an earlier UI value', async () => {
    seed({ title: '다른 기기에서 수정한 제목' });
    await moveTodayTodoToLong(uid, date, id);
    expect(harness.documents.get(targetPath)?.title).toBe('다른 기기에서 수정한 제목');
  });

  it('does not duplicate a goal on repeated calls', async () => {
    await moveTodayTodoToLong(uid, date, id);
    const writes = harness.committedWrites.length;
    expect(await moveTodayTodoToLong(uid, date, id)).toEqual({
      longTodoId: targetId, alreadyMoved: true,
    });
    expect(harness.committedWrites).toHaveLength(writes);
  });

  it('does not recreate a goal that was deleted after a successful move', async () => {
    await moveTodayTodoToLong(uid, date, id);
    harness.documents.delete(targetPath);
    expect((await moveTodayTodoToLong(uid, date, id)).alreadyMoved).toBe(true);
    expect(harness.documents.has(targetPath)).toBe(false);
  });

  it('retains linked goal details and keeps the daily title in its receipt', async () => {
    seed({ linkedLongTodoId: 'goal-1' });
    const linkedPath = `users/${uid}/longTodos/goal-1`;
    const linked = {
      id: 'goal-1', title: '학기 계획', priority: 'high', progress: 55,
      done: false, deadline: '2026-10-01', createdAt: 'original', updatedAt: 'original',
    };
    harness.documents.set(linkedPath, linked);
    expect((await moveTodayTodoToLong(uid, date, id)).longTodoId).toBe('goal-1');
    expect(harness.documents.get(linkedPath)).toEqual(linked);
    expect(harness.documents.has(targetPath)).toBe(false);
    expect(harness.documents.get(receiptPath)).toMatchObject({
      sourceTodo: { title: source.title, linkedLongTodoId: 'goal-1' },
    });
  });

  it('restores an archived linked goal without resetting its progress', async () => {
    seed({ linkedLongTodoId: 'archived' });
    const linkedPath = `users/${uid}/longTodos/archived`;
    harness.documents.set(linkedPath, {
      id: 'archived', title: '보관된 목표', priority: 'low', progress: 100, done: true,
    });
    await moveTodayTodoToLong(uid, date, id);
    expect(harness.documents.get(linkedPath)).toMatchObject({
      title: '보관된 목표', priority: 'low', progress: 100, done: false,
    });
  });

  it('recreates a missing linked destination before deleting the daily source', async () => {
    seed({ linkedLongTodoId: 'missing-goal' });
    await moveTodayTodoToLong(uid, date, id);
    expect(harness.documents.get(`users/${uid}/longTodos/missing-goal`)).toMatchObject({
      id: 'missing-goal', title: source.title, done: false,
    });
    expect(harness.documents.has(sourcePath)).toBe(false);
  });

  it('does not move a task completed by another tab', async () => {
    seed({ done: true });
    await expect(moveTodayTodoToLong(uid, date, id)).rejects.toThrow('완료');
    expect(harness.documents.get(sourcePath)?.done).toBe(true);
    expect(harness.committedWrites).toEqual([]);
  });

  it('does not create a goal when the source no longer exists', async () => {
    harness.documents.delete(sourcePath);
    await expect(moveTodayTodoToLong(uid, date, id)).rejects.toThrow('삭제');
    expect(harness.committedWrites).toEqual([]);
  });

  it('requires completed carryover before closing historical fallback', async () => {
    harness.documents.set(dayPath, { date });
    await expect(moveTodayTodoToLong(uid, date, id)).rejects.toThrow('이월');
    expect(harness.documents.has(sourcePath)).toBe(true);
    expect(harness.committedWrites).toEqual([]);
  });

  it('leaves all records unchanged if commit fails', async () => {
    const before = structuredClone([...harness.documents]);
    harness.failCommit = true;
    await expect(moveTodayTodoToLong(uid, date, id)).rejects.toThrow('permission-denied');
    expect([...harness.documents]).toEqual(before);
    expect(harness.committedWrites).toEqual([]);
  });

  it('commits only one destination when Firestore retries the callback', async () => {
    harness.retry = true;
    await moveTodayTodoToLong(uid, date, id);
    expect(harness.committedWrites.filter((path) => path === targetPath)).toHaveLength(1);
    expect(harness.documents.has(sourcePath)).toBe(false);
  });

  it.each([
    ['', date, id], [uid, 'not-a-date', id], [uid, date, ''],
    ['wrong/user', date, id], [uid, date, 'wrong/id'],
  ])('rejects invalid path arguments without starting a transaction (%s, %s, %s)', async (user, day, todo) => {
    await expect(moveTodayTodoToLong(user, day, todo)).rejects.toThrow('정보');
    expect(harness.transactions).toBe(0);
  });

  it('rejects a blank title without removing the source', async () => {
    seed({ title: '   ' });
    await expect(moveTodayTodoToLong(uid, date, id)).rejects.toThrow('제목');
    expect(harness.documents.has(sourcePath)).toBe(true);
  });
});
