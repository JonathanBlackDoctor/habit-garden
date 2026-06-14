import { useMemo } from 'react';
import {
  doc, setDoc, updateDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { HabitGroup, HabitDoc, HabitCheckDoc } from 'shared/types/firestore';
import { statusOf } from '@/features/habits/habitStatus';
import { toast } from 'sonner';

/** 습관 묶음 목록 (설정에 저장). 예: '학교' — 등교일에만 하는 습관을 묶어 일괄 건너뛰기. */
export function useHabitGroups(): HabitGroup[] {
  const settings = useAppStore((s) => s.settings);
  return useMemo(() => settings?.habitGroups ?? [], [settings?.habitGroups]);
}

function genId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function useHabitGroupActions() {
  const uid = useAppStore((s) => s.uid);

  /** 새 묶음 추가 → 생성된 id 반환 */
  const addGroup = async (name: string): Promise<string | null> => {
    if (!uid) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = useAppStore.getState().settings?.habitGroups ?? [];
    const dup = existing.find((g) => g.name === trimmed);
    if (dup) return dup.id;
    const group: HabitGroup = { id: genId(), name: trimmed };
    await setDoc(
      doc(db, 'users', uid, 'settings', 'main'),
      { habitGroups: [...existing, group], updatedAt: serverTimestamp() },
      { merge: true },
    );
    return group.id;
  };

  const renameGroup = async (id: string, name: string) => {
    if (!uid) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = useAppStore.getState().settings?.habitGroups ?? [];
    const next = existing.map((g) => (g.id === id ? { ...g, name: trimmed } : g));
    await setDoc(
      doc(db, 'users', uid, 'settings', 'main'),
      { habitGroups: next, updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  /** 묶음 삭제 — 소속 습관들의 groupId 를 비운 뒤 목록에서 제거 */
  const removeGroup = async (id: string, members: HabitDoc[]) => {
    if (!uid) return;
    const existing = useAppStore.getState().settings?.habitGroups ?? [];
    const batch = writeBatch(db);
    for (const h of members) {
      if (h.groupId === id) batch.update(doc(db, 'users', uid, 'habits', h.id), { groupId: null });
    }
    await batch.commit();
    await setDoc(
      doc(db, 'users', uid, 'settings', 'main'),
      { habitGroups: existing.filter((g) => g.id !== id), updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  /** 습관의 소속 묶음 변경 */
  const assignHabit = async (habitId: string, groupId: string | null) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'habits', habitId), { groupId });
  };

  return { addGroup, renameGroup, removeGroup, assignHabit };
}

/**
 * 한 묶음의 습관들을 그날(date) 일괄 건너뛰기 / 해제한다.
 * 건너뛰기는 기존 skip(score=null) 과 동일하므로 스트릭·패널티에서 자동 제외된다.
 * 토스트 폭주를 막기 위해 writeBatch 로 한 번에 처리하고 요약 토스트만 띄운다.
 */
export function useBulkSkip(date: string) {
  const uid = useAppStore((s) => s.uid);

  const bulkSkip = async (groupName: string, habits: HabitDoc[], checks: Record<string, HabitCheckDoc>) => {
    if (!uid) return;
    const targets = habits.filter((h) => statusOf(checks[h.id]) !== 'skipped');
    if (targets.length === 0) {
      toast(`${groupName} — 이미 모두 건너뛰기 상태예요`);
      return;
    }
    const batch = writeBatch(db);
    for (const h of targets) {
      batch.set(doc(db, 'users', uid, 'days', date, 'habitChecks', h.id), {
        habitId: h.id,
        score: null,
        achieved: false,
        checkedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    toast(`⏭️ ${groupName} 일괄 건너뛰기`, { description: `${targets.length}개를 오늘 건너뛰어요` });
  };

  const bulkUnskip = async (groupName: string, habits: HabitDoc[], checks: Record<string, HabitCheckDoc>) => {
    if (!uid) return;
    const targets = habits.filter((h) => statusOf(checks[h.id]) === 'skipped');
    if (targets.length === 0) return;
    const batch = writeBatch(db);
    for (const h of targets) {
      batch.delete(doc(db, 'users', uid, 'days', date, 'habitChecks', h.id));
    }
    await batch.commit();
    toast(`${groupName} 건너뛰기 해제`, { description: `${targets.length}개를 되돌렸어요` });
  };

  return { bulkSkip, bulkUnskip };
}
