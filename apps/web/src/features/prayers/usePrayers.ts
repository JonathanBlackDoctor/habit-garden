import { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, updateDoc, deleteDoc,
  addDoc, serverTimestamp, increment, limit, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type {
  PrayerDoc, PrayerPersonDoc, PrayerCheckDoc, DayDoc,
  PrayerCategory, PrayerPriority, PrayerWeeklyDigestDoc,
} from 'shared/types/firestore';
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

export function usePeople() {
  const uid = useAppStore((s) => s.uid);
  const [people, setPeople] = useState<PrayerPersonDoc[]>([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'people'), orderBy('name'));
    return onSnapshot(q, (snap) => {
      setPeople(snap.docs.map((d) => d.data() as PrayerPersonDoc));
    });
  }, [uid]);

  return people;
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

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid, 'days', date), (snap) => {
      setDayDoc(snap.exists() ? (snap.data() as DayDoc) : null);
    });
  }, [uid, date]);

  return dayDoc;
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

    if (dayDoc?.prayerPlan) {
      pinnedIds = dayDoc.prayerPlan.pinnedIds.filter((id) => byId.has(id));
      rotationIds = dayDoc.prayerPlan.rotationIds.filter((id) => byId.has(id));
      // 계획 생성 이후 추가된 고정 항목도 즉시 반영
      for (const p of active) {
        if (p.pinned && !pinnedIds.includes(p.id)) pinnedIds.push(p.id);
      }
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
    }

    const pinned = pinnedIds.map((id) => byId.get(id)!).filter(Boolean);
    const rotation = rotationIds
      .filter((id) => !pinnedIds.includes(id))
      .map((id) => byId.get(id)!)
      .filter(Boolean);

    return { pinned, rotation };
  }, [prayers, dayDoc]);
}

// ── 액션 ──────────────────────────────────────────────────
export interface QuickAddInput {
  title: string;
  category?: PrayerCategory;
  priority?: PrayerPriority;
  personName?: string;
  personId?: string;
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
      personId:   input.personId,
      personName: (input.personName ?? '').trim(),
      category:   input.category ?? 'other',
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
    if (input.personId) {
      await updateDoc(doc(db, 'users', uid, 'people', input.personId), {
        activeCount: increment(1), updatedAt: now,
      }).catch(() => {});
    }
    return ref.id;
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
  const checkPrayer = async (p: PrayerDoc) => {
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'days', date, 'prayerChecks', p.id), {
      prayerId: p.id,
      prayedAt: serverTimestamp(),
    } as any);
    toast(`🙏 ${p.title}`, { description: '오늘 기도했어요 (+2P)' });
  };

  /** 체크 취소 */
  const uncheckPrayer = async (prayerId: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'days', date, 'prayerChecks', prayerId));
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
    if (p.personId) {
      await updateDoc(doc(db, 'users', uid, 'people', p.personId), {
        activeCount: increment(-1), answeredCount: increment(1), updatedAt: now,
      }).catch(() => {});
    }
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
    if (p.personId && p.status === 'active') {
      await updateDoc(doc(db, 'users', uid, 'people', p.personId), {
        activeCount: increment(-1), updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  /** 대상자 찾거나 생성 (이름 기준) */
  const ensurePerson = async (
    name: string,
    relation: PrayerCategory,
    existing: PrayerPersonDoc[]
  ): Promise<string | undefined> => {
    if (!uid) return undefined;
    const trimmed = name.trim();
    if (!trimmed) return undefined;
    const found = existing.find(
      (p) => p.name === trimmed || (p.aliases ?? []).includes(trimmed)
    );
    if (found) return found.id;
    const ref = doc(collection(db, 'users', uid, 'people'));
    const now = serverTimestamp();
    await setDoc(ref, {
      id: ref.id, name: trimmed, relation,
      activeCount: 0, answeredCount: 0,
      createdAt: now, updatedAt: now,
    } as any);
    return ref.id;
  };

  /** AI 검토 후 일괄 저장 */
  const bulkSave = async (
    items: QuickAddInput[],
    people: PrayerPersonDoc[]
  ): Promise<number> => {
    if (!uid) return 0;
    let saved = 0;
    // 사람 캐시 (이번 저장 중 새로 만든 사람도 재사용)
    const cache = [...people];
    for (const item of items) {
      let personId = item.personId;
      if (!personId && item.personName?.trim()) {
        personId = await ensurePerson(item.personName, item.category ?? 'other', cache);
        if (personId && !cache.find((c) => c.id === personId)) {
          cache.push({ id: personId, name: item.personName.trim() } as PrayerPersonDoc);
        }
      }
      const ref = doc(collection(db, 'users', uid, 'prayers'));
      const now = serverTimestamp();
      await setDoc(ref, {
        id: ref.id,
        personId,
        personName: (item.personName ?? '').trim(),
        category: item.category ?? 'other',
        receivedAt: now,
        title: item.title.trim(),
        body: item.body?.trim() || undefined,
        priority: item.priority ?? 'mid',
        pinned: false,
        status: 'active',
        prayCount: 0,
        streak: 0,
        source: 'bulk_ai',
        createdAt: now,
        updatedAt: now,
      } as any);
      if (personId) {
        await updateDoc(doc(db, 'users', uid, 'people', personId), {
          activeCount: increment(1), updatedAt: now,
        }).catch(() => {});
      }
      saved++;
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
      if (d.personId && d.status === 'active') {
        await updateDoc(doc(db, 'users', uid, 'people', d.personId), {
          activeCount: increment(-1), updatedAt: now,
        }).catch(() => {});
      }
    }
    toast(`🔗 ${docs.length}개를 하나로 합쳤어요`);
  };

  return {
    quickAdd, updatePrayer, togglePin, checkPrayer, uncheckPrayer,
    markAnswered, awaken, removePrayer, ensurePerson, bulkSave, mergePrayers,
  };
}

// 외부에서 오늘 날짜가 필요할 때
export function useToday() {
  return useAppStore((s) => s.currentDate) || plannerDate();
}
