import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  doc, setDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { refreshFcmToken, recordNotifOpen } from '@/lib/fcm';

/**
 * 알림 액션·트래킹 처리기.
 *  - 스누즈(snooze_1h): Service Worker 가 클라이언트에 위임 → reminderQueue 에 재발송 예약
 *    · 열린 창이 있으면 postMessage(SNOOZE_REMINDER)
 *    · 닫혀 있으면 #/habits?snooze=… 딥링크로 진입
 *  - 오픈 트래킹(기능 #7): 알림을 눌러 앱을 연 경우 NOTIF_OPEN 메시지 / ?notifOpen= 파라미터로 집계
 *  - 토큰 갱신: 마운트 시 refreshFcmToken 으로 최신 FCM 토큰을 재저장(회전 토큰 대응)
 * 인증된 Firestore 쓰기는 반드시 클라이언트에서 수행 (보안).
 */
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
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  // 0) 앱 로드 시 FCM 토큰 갱신 (켜져 있을 때만 내부에서 동작)
  useEffect(() => {
    if (uid) refreshFcmToken(uid);
  }, [uid]);

  // 1) 열린 창에서 SW 메시지 수신 (스누즈 위임 / 오픈 트래킹)
  useEffect(() => {
    if (!uid || !('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d.type !== 'string') return;
      if (d.type === 'NOTIF_OPEN') {
        recordNotifOpen(uid, String(d.action || ''), fallbackDate);
        return;
      }
      if (d.type === 'SNOOZE_REMINDER') {
        const ids = String(d.habitIds || '').split(',').filter(Boolean);
        if (ids.length) applySnooze(uid, ids, d.date || fallbackDate, d.minutes || 60);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [uid, fallbackDate]);

  // 2) 콜드 오픈 — 스누즈 딥링크 처리
  useEffect(() => {
    if (!uid) return;
    const snooze = params.get('snooze');
    if (!snooze) return;
    const ids = snooze.split(',').filter(Boolean);
    const date = params.get('date') || fallbackDate;
    if (ids.length) applySnooze(uid, ids, date, 60);
    navigate('/habits', { replace: true }); // 쿼리 제거
  }, [uid, params, navigate, fallbackDate]);

  // 3) 콜드 오픈 — 오픈 트래킹 파라미터 처리 (라우트는 유지, 파라미터만 제거)
  useEffect(() => {
    if (!uid) return;
    const open = params.get('notifOpen');
    if (!open) return;
    recordNotifOpen(uid, open, fallbackDate);
    const next = new URLSearchParams(params);
    next.delete('notifOpen');
    setParams(next, { replace: true });
  }, [uid, params, setParams, fallbackDate]);

  return null;
}
