import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  doc, getDoc, setDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { HabitDoc } from 'shared/types/firestore';
import { SCALED_ACHIEVE_THRESHOLD } from 'shared/lib/habitPoints';

/**
 * 알림 액션(B-2) 처리기.
 * Service Worker 가 'check_all'/'snooze_1h' 액션을 클라이언트에 위임한다.
 *  - 열린 창이 있으면 postMessage 로 전달
 *  - 닫혀 있으면 #/habits?quickCheck=…|snooze=… 딥링크로 진입
 * 인증된 Firestore 쓰기는 반드시 클라이언트에서 수행 (보안).
 */
async function applyQuickCheck(uid: string, habitIds: string[], date: string) {
  let count = 0;
  for (const id of habitIds) {
    const snap = await getDoc(doc(db, 'users', uid, 'habits', id));
    if (!snap.exists()) continue;
    const habit = snap.data() as HabitDoc;
    const score = habit.scoreMode === 'binary' ? 1 : SCALED_ACHIEVE_THRESHOLD;
    await setDoc(doc(db, 'users', uid, 'days', date, 'habitChecks', id), {
      habitId: id,
      score,
      achieved: true,
      note: '알림에서 빠른 완료',
      checkedAt: serverTimestamp() as never,
    });
    count++;
  }
  if (count > 0) toast.success(`✓ ${count}개 완료 처리됐어요`);
}

async function applySnooze(uid: string, habitIds: string[], date: string, minutes: number) {
  const reSendAt = Timestamp.fromMillis(Date.now() + minutes * 60_000);
  for (const id of habitIds) {
    await setDoc(doc(db, 'users', uid, 'reminderQueue', id), {
      habitId: id,
      date,
      reSendAt,
      createdAt: serverTimestamp() as never,
    });
  }
  if (habitIds.length > 0) toast(`⏰ ${minutes}분 뒤 다시 알려드릴게요`);
}

export default function ReminderActionHandler() {
  const uid = useAppStore((s) => s.uid);
  const fallbackDate = useAppStore((s) => s.currentDate);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // 1) 열린 창에서 SW 메시지 수신
  useEffect(() => {
    if (!uid || !('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d.type !== 'string') return;
      const ids = String(d.habitIds || '').split(',').filter(Boolean);
      if (ids.length === 0) return;
      const date = d.date || fallbackDate;
      if (d.type === 'QUICK_CHECK') applyQuickCheck(uid, ids, date);
      else if (d.type === 'SNOOZE_REMINDER') applySnooze(uid, ids, date, d.minutes || 60);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [uid, fallbackDate]);

  // 2) 콜드 오픈 — 딥링크 쿼리 파라미터 처리
  useEffect(() => {
    if (!uid) return;
    const quick = params.get('quickCheck');
    const snooze = params.get('snooze');
    if (!quick && !snooze) return;
    const date = params.get('date') || fallbackDate;
    if (quick) {
      const ids = quick.split(',').filter(Boolean);
      if (ids.length) applyQuickCheck(uid, ids, date);
    } else if (snooze) {
      const ids = snooze.split(',').filter(Boolean);
      if (ids.length) applySnooze(uid, ids, date, 60);
    }
    navigate('/habits', { replace: true }); // 쿼리 제거
  }, [uid, params, navigate, fallbackDate]);

  return null;
}
