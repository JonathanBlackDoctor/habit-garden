import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type {
  ApplicationDoc, ApplicationCheckDoc, ApplicationType,
} from 'shared/types/firestore';
import { APPLICATION_DEFAULT_TARGET_DAYS } from 'shared/types/firestore';
import { toast } from 'sonner';

/** 모든 말씀 적용 (최신순) */
export function useApplications() {
  const uid = useAppStore((s) => s.uid);
  const [apps, setApps] = useState<ApplicationDoc[]>([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'applications'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setApps(snap.docs.map((d) => d.data() as ApplicationDoc));
    });
  }, [uid]);

  return apps;
}

/** 오늘 실천 체크 (applicationId → check) */
export function useApplicationChecks(date: string) {
  const uid = useAppStore((s) => s.uid);
  const [checks, setChecks] = useState<Record<string, ApplicationCheckDoc>>({});

  useEffect(() => {
    if (!uid) return;
    const c = collection(db, 'users', uid, 'days', date, 'applicationChecks');
    return onSnapshot(c, (snap) => {
      const map: Record<string, ApplicationCheckDoc> = {};
      snap.docs.forEach((d) => { map[d.id] = d.data() as ApplicationCheckDoc; });
      setChecks(map);
    });
  }, [uid, date]);

  return checks;
}

export interface NewApplicationInput {
  type: ApplicationType;
  application: string;
  reference?: string;
  title?: string;
  insight?: string;
  date?: string;
  targetDays?: number;
}

/** AI 노트 정리 결과 */
export interface ParsedApplication {
  reference: string;
  insight: string;
  applications: string[];
  targetDays: number;
}

/** 노트 텍스트를 AI로 정리 (parseApplication callable). 승인 사용자 전용. */
export async function parseApplicationNote(rawText: string): Promise<ParsedApplication> {
  const fn = httpsCallable(functions, 'parseApplication');
  const res: any = await fn({ rawText: rawText.trim() });
  const d = res.data ?? {};
  return {
    reference: typeof d.reference === 'string' ? d.reference : '',
    insight: typeof d.insight === 'string' ? d.insight : '',
    applications: Array.isArray(d.applications) ? d.applications.filter((a: any) => typeof a === 'string' && a.trim()) : [],
    targetDays: typeof d.targetDays === 'number' ? d.targetDays : 7,
  };
}

export function useApplicationActions() {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);

  const addApplication = async (input: NewApplicationInput): Promise<string | null> => {
    if (!uid || !input.application.trim()) return null;
    const ref = doc(collection(db, 'users', uid, 'applications'));
    const now = serverTimestamp();
    const app: any = {
      id: ref.id,
      type: input.type,
      date: (input.date ?? today),
      reference: input.reference?.trim() || undefined,
      title: input.title?.trim() || undefined,
      insight: input.insight?.trim() || undefined,
      application: input.application.trim(),
      status: 'active',
      targetDays: input.targetDays ?? APPLICATION_DEFAULT_TARGET_DAYS,
      practiceCount: 0,
      practicedDates: [],
      streak: 0,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(ref, app);
    toast('🌱 말씀 적용 추가됨', { description: input.application.trim() });
    return ref.id;
  };

  /** 공통 메타(유형·본문·깨달음·목표일)를 공유하는 여러 적용점을 한 번에 저장 */
  const addApplications = async (
    common: Omit<NewApplicationInput, 'application'>,
    applications: string[],
  ): Promise<number> => {
    if (!uid) return 0;
    const list = applications.map((a) => a.trim()).filter(Boolean);
    if (list.length === 0) return 0;
    const batch = writeBatch(db);
    const now = serverTimestamp();
    for (const application of list) {
      const ref = doc(collection(db, 'users', uid, 'applications'));
      batch.set(ref, {
        id: ref.id,
        type: common.type,
        date: common.date ?? today,
        reference: common.reference?.trim() || undefined,
        title: common.title?.trim() || undefined,
        insight: common.insight?.trim() || undefined,
        application,
        status: 'active',
        targetDays: common.targetDays ?? APPLICATION_DEFAULT_TARGET_DAYS,
        practiceCount: 0,
        practicedDates: [],
        streak: 0,
        createdAt: now,
        updatedAt: now,
      } as any);
    }
    await batch.commit();
    toast(`🌱 적용 ${list.length}개를 추가했어요`);
    return list.length;
  };

  const updateApplication = async (id: string, patch: Partial<ApplicationDoc>) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'applications', id), {
      ...patch, updatedAt: serverTimestamp(),
    } as any);
  };

  /** 오늘 실천 체크 — 포인트·연속·횟수 갱신은 applicationAward 함수가 처리 */
  const checkPractice = async (app: ApplicationDoc) => {
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'days', today, 'applicationChecks', app.id), {
      applicationId: app.id,
      practicedAt: serverTimestamp(),
    } as any);
    toast('✅ 오늘 실천!', { description: `${app.application} (+3P)` });
  };

  const uncheckPractice = async (app: ApplicationDoc) => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'days', today, 'applicationChecks', app.id));
    toast('실천 취소', { description: app.application });
  };

  /** 적용 완료(정착) — 완료 보너스는 applicationCompleteAward 함수가 지급 */
  const completeApplication = async (app: ApplicationDoc) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'applications', app.id), {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as any);
    toast('🎉 적용 완료', { description: `${app.application} (+20P)` });
  };

  const archiveApplication = async (app: ApplicationDoc) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'applications', app.id), {
      status: 'archived', updatedAt: serverTimestamp(),
    } as any);
  };

  const reactivateApplication = async (app: ApplicationDoc) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'applications', app.id), {
      status: 'active', updatedAt: serverTimestamp(),
    } as any);
  };

  const removeApplication = async (app: ApplicationDoc) => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'applications', app.id));
  };

  return {
    addApplication, addApplications, updateApplication, checkPractice, uncheckPractice,
    completeApplication, archiveApplication, reactivateApplication, removeApplication,
  };
}
