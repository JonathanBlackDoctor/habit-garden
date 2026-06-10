import { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, limit, Timestamp, writeBatch, runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type {
  PrayerDoc, PrayerCheckDoc, DayDoc,
  PrayerPriority, PrayerWeeklyDigestDoc,
} from 'shared/types/firestore';
import { DEFAULT_PRAYER_GROUPS, DEFAULT_PRAYER_TARGETS } from 'shared/types/firestore';
import { selectTodayPrayers, type RotationInput } from 'shared/prayerRotation';
import { plannerDate } from '@/lib/dayBoundary';
import { toast } from 'sonner';

// ── 구독 훅 ───────────────────────────────────────────────
export function usePrayers() {
  const uid = useAppStore((s) => s.uid);
  const [prayers, setPrayers] = useState<PrayerDoc[]>([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'prayers'), orderBy('receivedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setPrayers(snap.docs.map((d) => d.data() as PrayerDoc));
    });
  }, [uid]);

  return prayers;
}

/** 기도제목을 받은 모임 목록 — 설정에 저장된 사용자 목록 + 기본값 */
export function usePrayerGroups(): string[] {
  const settings = useAppStore((s) => s.settings);
  return useMemo(() => {
    const custom = settings?.prayerGroups ?? [];
    const merged = [...DEFAULT_PRAYER_GROUPS, ...custom];
    return Array.from(new Set(merged.map((g) => g.trim()).filter(Boolean)));
  }, [settings?.prayerGroups]);
}

/** 기도 대상(요청자/나 자신) 목록 — 설정에 저장된 사용자 목록 + 기본값 */
export function usePrayerTargets(): string[] {
  const settings = useAppStore((s) => s.settings);
  return useMemo(() => {
    const custom = settings?.prayerTargets ?? [];
    const merged = [...DEFAULT_PRAYER_TARGETS, ...custom];
    return Array.from(new Set(merged.map((t) => t.trim()).filter(Boolean)));
  }, [settings?.prayerTargets]);
}

export function usePrayerChecks(date: string) {
  const uid = useAppStore((s) => s.uid);
  const [checks, setChecks] = useState<Record<string, PrayerCheckDoc>>({});

  useEffect(() => {
    if (!uid) return;
    const q = collection(db, 'users', uid, 'days', date, 'prayerChecks');
    return onSnapshot(q, (snap) => {
      const map: Record<string, PrayerCheckDoc> = {};
      snap.docs.forEach((d) => { map[d.id] = d.data() as PrayerCheckDoc; });
      setChecks(map);
    });
  }, [uid, date]);

  return checks;
}

export function useLatestWeeklyDigest() {
  const uid = useAppStore((s) => s.uid);
  const [digest, setDigest] = useState<PrayerWeeklyDigestDoc | null>(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'prayerWeekly'),
      orderBy('generatedAt', 'desc'),
      limit(1),
    );
    return onSnapshot(q, (snap) => {
      setDigest(snap.empty ? null : (snap.docs[0].data() as PrayerWeeklyDigestDoc));
    });
  }, [uid]);

  return digest;
}

export function useDayDoc(date: string) {
  const uid = useAppStore((s) => s.uid);
  const [dayDoc, setDayDoc] = useState<DayDoc | null>(null);
  // 스냅샷 첫 도착 여부 — "로딩 중 null"과 "문서 없음 null"을 구분한다.
  // (이걸 구분하지 않으면 dayDoc 로드 전에 prayerPlan을 '없음'으로 오판해 덮어쓴다.)
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setLoaded(false);
    return onSnapshot(doc(db, 'users', uid, 'days', date), (snap) => {
      setDayDoc(snap.exists() ? (snap.data() as DayDoc) : null);
      setLoaded(true);
    });
  }, [uid, date]);

  return { dayDoc, loaded };
}

// ── 오늘의 목록 계산 (서버 prayerPlan 우선, 없으면 클라이언트 fallback) ──
function tsToMs(ts?: Timestamp | { toMillis?: () => number }): number | undefined {
  if (!ts) return undefined;
  try {
    if (typeof (ts as any).toMillis === 'function') return (ts as any).toMillis();
  } catch { /* pending serverTimestamp */ }
  return undefined;
}

export function useTodayPrayers(prayers: PrayerDoc[], dayDoc: DayDoc | null) {
  return useMemo(() => {
    const active = prayers.filter((p) => p.status === 'active');
    const byId = new Map(active.map((p) => [p.id, p] as const));

    let pinnedIds: string[];
    let rotationIds: string[];
    let fromPlan: boolean;

    const plan = dayDoc?.prayerPlan;
    if (plan && (plan.pinnedIds || plan.rotationIds)) {
      pinnedIds = (plan.pinnedIds ?? []).filter((id) => byId.has(id));
      rotationIds = (plan.rotationIds ?? []).filter((id) => byId.has(id));
      // 계획 생성 이후 추가된 고정 항목도 즉시 반영
      for (const p of active) {
        if (p.pinned && !pinnedIds.includes(p.id)) pinnedIds.push(p.id);
      }
      fromPlan = true;
    } else {
      // 클라이언트 fallback — 서버가 아직 계산 전이거나 신규
      const now = Date.now();
      const inputs: RotationInput[] = active.map((p) => ({
        id: p.id,
        priority: p.priority,
        pinned: p.pinned,
        rotationDays: p.rotationDays,
        receivedAtMs: tsToMs(p.receivedAt as any) ?? now,
        lastPrayedAtMs: tsToMs(p.lastPrayedAt as any),
      }));
      const res = selectTodayPrayers(inputs, now);
      pinnedIds = res.pinnedIds;
      rotationIds = res.rotationIds;
      fromPlan = false;
    }

    const pinned = pinnedIds.map((id) => byId.get(id)!).filter(Boolean);
    const rotation = rotationIds
      .filter((id) => !pinnedIds.includes(id))
      .map((id) => byId.get(id)!)
      .filter(Boolean);

    // fromPlan=false 면 아직 그날 목록이 확정되지 않은 상태 — 호출부에서 영속화한다.
    return { pinned, rotation, fromPlan, pinnedIds, rotationIds };
  }, [prayers, dayDoc]);
}

// ── 액션 ──────────────────────────────────────────────────
export interface QuickAddInput {
  title: string;
  group?: string;
  target?: string;
  priority?: PrayerPriority;
  body?: string;
  pinned?: boolean;
}

export function usePrayerActions() {
  const uid  = useAppStore((s) => s.uid);
  const date = useAppStore((s) => s.currentDate);

  /** 빠른 한 줄 저장 — 제목만으로 즉시 저장 */
  const quickAdd = async (input: QuickAddInput) => {
    if (!uid || !input.title.trim()) return null;
    const ref = doc(collection(db, 'users', uid, 'prayers'));
    const now = serverTimestamp();
    const prayer: any = {
      id: ref.id,
      group:      (input.group ?? '개인').trim() || '개인',
      target:     (input.target ?? '나 자신').trim() || '나 자신',
      receivedAt: now,
      title:      input.title.trim(),
      body:       input.body?.trim() || undefined,
      priority:   input.priority ?? 'mid',
      pinned:     input.pinned ?? false,
      status:     'active',
      prayCount:  0,
      streak:     0,
      source:     'quick',
      createdAt:  now,
      updatedAt:  now,
    };
    await setDoc(ref, prayer);
    return ref.id;
  };

  /** 모임 목록에 새 모임 추가 (settings/main 에 누적) */
  const addPrayerGroup = async (name: string) => {
    if (!uid) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = useAppStore.getState().settings?.prayerGroups ?? [];
    if (existing.includes(trimmed) || DEFAULT_PRAYER_GROUPS.includes(trimmed as any)) return;
    await setDoc(
      doc(db, 'users', uid, 'settings', 'main'),
      { prayerGroups: [...existing, trimmed], updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  /** 대상 목록에 새 대상 추가 (settings/main 에 누적) */
  const addPrayerTarget = async (name: string) => {
    if (!uid) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = useAppStore.getState().settings?.prayerTargets ?? [];
    if (existing.includes(trimmed) || DEFAULT_PRAYER_TARGETS.includes(trimmed as any)) return;
    await setDoc(
      doc(db, 'users', uid, 'settings', 'main'),
      { prayerTargets: [...existing, trimmed], updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  /** '오늘 기도 더 받기' — 그날 DayDoc.prayerPlan.extraIds 에 영속화(중첩 머지) */
  const appendTodayExtras = async (forDate: string, ids: string[]) => {
    if (!uid) return;
    await setDoc(
      doc(db, 'users', uid, 'days', forDate),
      { prayerPlan: { extraIds: ids }, updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  /**
   * 오늘의 목록을 그날 한 번 확정(prayerPlan.pinnedIds/rotationIds 영속화).
   * 체크 시 lastPrayedAt 이 갱신돼 로테이션이 재계산되면 목록이 흔들려 사라지는 문제를 막는다.
   *
   * 한 번 확정된 plan 은 절대 덮어쓰지 않는다 — 트랜잭션으로 서버의 권위 있는 상태를 읽어
   * 이미 pinnedIds/rotationIds 가 있으면 그대로 보존한다. 탭 재진입·새로고침·오프라인 캐시
   * 경합으로 dayDoc 이 잠깐 plan 없이 로드돼 '체크 이후' 축소된 목록이 재계산·재영속화되며
   * 오전에 확정된 로테이션을 밀어내던 문제를 차단한다.
   * extraIds 등 기존 prayerPlan 필드는 중첩 머지로 보존된다.
   */
  const persistTodayPlan = async (forDate: string, pinnedIds: string[], rotationIds: string[]) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'days', forDate);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const plan = snap.exists() ? (snap.data() as DayDoc).prayerPlan : undefined;
      const alreadyFixed =
        (plan?.pinnedIds?.length ?? 0) > 0 || (plan?.rotationIds?.length ?? 0) > 0;
      if (alreadyFixed) return; // 이미 그날 목록 확정됨 — 보존
      tx.set(
        ref,
        {
          prayerPlan: { pinnedIds, rotationIds, generatedAt: serverTimestamp() },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
  };

  /** 기존 기도제목 부분 수정 */
  const updatePrayer = async (id: string, patch: Partial<PrayerDoc>) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'prayers', id), {
      ...patch, updatedAt: serverTimestamp(),
    } as any);
  };

  /** 고정 토글 */
  const togglePin = async (p: PrayerDoc) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'prayers', p.id), {
      pinned: !p.pinned, updatedAt: serverTimestamp(),
    });
  };

  /** 오늘 기도 완료 체크 — prayerChecks 기록 (포인트·갱신은 prayerAward 함수) */
  const checkPrayer = async (p: PrayerDoc, opts?: { silent?: boolean }) => {
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'days', date, 'prayerChecks', p.id), {
      prayerId: p.id,
      prayedAt: serverTimestamp(),
    } as any);
    if (!opts?.silent) toast(`🙏 ${p.title}`, { description: '오늘 기도했어요 (+2P)' });
  };

  /** 체크 취소 — prayerChecks 삭제 (포인트 삭감은 prayerAward 함수) */
  const uncheckPrayer = async (p: PrayerDoc) => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'days', date, 'prayerChecks', p.id));
    toast(`🙏 ${p.title}`, { description: '기도 취소 (−2P)' });
  };

  /** 응답 기록 → 응답 보관함으로 이동 */
  const markAnswered = async (p: PrayerDoc, answerNote: string) => {
    if (!uid) return;
    const now = serverTimestamp();
    await updateDoc(doc(db, 'users', uid, 'prayers', p.id), {
      status: 'answered',
      answeredAt: now,
      answerNote: answerNote.trim() || undefined,
      updatedAt: now,
    } as any);
    toast(`✨ 응답 기록 — ${p.title}`);
  };

  /** 잠든 기도 깨우기 → active 복귀, lastPrayedAt 리셋 */
  const awaken = async (p: PrayerDoc) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'prayers', p.id), {
      status: 'active',
      dormantSince: undefined,
      lastPrayedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as any);
    toast(`🌱 다시 깨웠습니다 — ${p.title}`);
  };

  /** 영구 삭제 */
  const removePrayer = async (p: PrayerDoc) => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'prayers', p.id));
  };

  /** 여러 기도제목 일괄 삭제 */
  const removePrayers = async (ids: string[]) => {
    if (!uid || ids.length === 0) return;
    const batch = writeBatch(db);
    for (const id of ids) {
      batch.delete(doc(db, 'users', uid, 'prayers', id));
    }
    await batch.commit();
    toast(`🗑️ ${ids.length}개를 삭제했어요`);
  };

  /** 여러 기도제목 일괄 부분 수정 (모임/우선순위/고정 등) */
  const updatePrayers = async (ids: string[], patch: Partial<PrayerDoc>) => {
    if (!uid || ids.length === 0) return;
    const batch = writeBatch(db);
    for (const id of ids) {
      batch.update(doc(db, 'users', uid, 'prayers', id), {
        ...patch, updatedAt: serverTimestamp(),
      } as any);
    }
    await batch.commit();
    toast(`✏️ ${ids.length}개를 수정했어요`);
  };

  /** AI 검토 후 일괄 저장 — 같은 batchId로 묶어 원자적 저장 */
  const bulkSave = async (items: QuickAddInput[]): Promise<number> => {
    if (!uid || items.length === 0) return 0;
    const batch = writeBatch(db);
    const batchId = doc(collection(db, 'users', uid, 'prayers')).id;
    const now = serverTimestamp();
    let saved = 0;
    for (const item of items) {
      const ref = doc(collection(db, 'users', uid, 'prayers'));
      batch.set(ref, {
        id: ref.id,
        group: (item.group ?? '개인').trim() || '개인',
        target: (item.target ?? '나 자신').trim() || '나 자신',
        receivedAt: now,
        title: item.title.trim(),
        body: item.body?.trim() || undefined,
        priority: item.priority ?? 'mid',
        pinned: false,
        status: 'active',
        prayCount: 0,
        streak: 0,
        source: 'bulk_ai',
        batchId,
        createdAt: now,
        updatedAt: now,
      } as any);
      saved++;
    }
    await batch.commit();
    // AI가 추출한 새 대상을 대상 목록에 1회 병합 저장
    const existing = useAppStore.getState().settings?.prayerTargets ?? [];
    const known = new Set([...DEFAULT_PRAYER_TARGETS, ...existing]);
    const newTargets = Array.from(
      new Set(items.map((it) => (it.target ?? '').trim()).filter((t) => t && !known.has(t)))
    );
    if (newTargets.length > 0) {
      await setDoc(
        doc(db, 'users', uid, 'settings', 'main'),
        { prayerTargets: [...existing, ...newTargets], updatedAt: serverTimestamp() },
        { merge: true },
      ).catch(() => {});
    }
    return saved;
  };

  /** 중복 기도제목 병합 — 가장 먼저 받은 항목으로 합치고 나머지는 삭제 */
  const mergePrayers = async (ids: string[]) => {
    if (!uid || ids.length < 2) return;
    const snaps = await Promise.all(
      ids.map((id) => getDoc(doc(db, 'users', uid, 'prayers', id)))
    );
    const docs = snaps.filter((s) => s.exists()).map((s) => s.data() as PrayerDoc);
    if (docs.length < 2) return;

    const ms = (p: PrayerDoc) => tsToMs(p.receivedAt as any) ?? Number.MAX_SAFE_INTEGER;
    docs.sort((a, b) => ms(a) - ms(b));
    const keep = docs[0];
    const rest = docs.slice(1);

    const rank: Record<PrayerPriority, number> = { high: 3, mid: 2, low: 1 };
    const topPriority = docs.reduce<PrayerPriority>(
      (acc, d) => (rank[d.priority] > rank[acc] ? d.priority : acc),
      keep.priority,
    );
    const mergedBody = docs
      .map((d) => (d.body ? `• ${d.title}\n${d.body}` : `• ${d.title}`))
      .join('\n\n');
    const mergedTags = Array.from(new Set(docs.flatMap((d) => d.tags ?? [])));

    const now = serverTimestamp();
    await updateDoc(doc(db, 'users', uid, 'prayers', keep.id), {
      body: mergedBody,
      prayCount: docs.reduce((s, d) => s + (d.prayCount ?? 0), 0),
      streak: Math.max(...docs.map((d) => d.streak ?? 0)),
      priority: topPriority,
      pinned: docs.some((d) => d.pinned),
      tags: mergedTags.length ? mergedTags : undefined,
      updatedAt: now,
    } as any);

    for (const d of rest) {
      await deleteDoc(doc(db, 'users', uid, 'prayers', d.id));
    }
    toast(`🔗 ${docs.length}개를 하나로 합쳤어요`);
  };

  return {
    quickAdd, addPrayerGroup, addPrayerTarget, appendTodayExtras, persistTodayPlan, updatePrayer, togglePin, checkPrayer, uncheckPrayer,
    markAnswered, awaken, removePrayer, removePrayers, updatePrayers, bulkSave, mergePrayers,
  };
}

// 외부에서 오늘 날짜가 필요할 때
export function useToday() {
  return useAppStore((s) => s.currentDate) || plannerDate();
}
