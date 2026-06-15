import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { BarChart3 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { NotificationStatsDoc, NotificationType } from 'shared/types/firestore';

const TYPE_LABELS: Record<NotificationType, string> = {
  habit_reminder: '습관 리마인더',
  prayer_reminder: '기도 알림',
  morning_brief: '모닝 브리프',
  prayer_weekly: '주간 기도 회고',
};
const TYPES = Object.keys(TYPE_LABELS) as NotificationType[];
const DAYS = 30;

type Agg = Record<NotificationType, { sent: number; failed: number; opened: number }>;

function emptyAgg(): Agg {
  return TYPES.reduce((acc, t) => {
    acc[t] = { sent: 0, failed: 0, opened: 0 };
    return acc;
  }, {} as Agg);
}

/**
 * 알림 전달/오픈 트래킹 통계 (기능 #7).
 * users/{uid}/notifStats/{날짜} 최근 30일을 집계해 타입별 발송·실패·열람·열람률을 보여준다.
 *  - 발송(sent): FCM 가 접수한 건수(디바이스 도달이 아닌 발송 성공)
 *  - 실패(failed): FCM 접수 실패(무효 토큰 등 — 발송 시 자동 정리됨)
 *  - 열람(opened): 사용자가 알림을 눌러 앱을 연 횟수
 */
export default function NotificationStatsCard() {
  const uid = useAppStore((s) => s.uid);
  const [agg, setAgg] = useState<Agg>(emptyAgg);
  const [days, setDays] = useState(0);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'notifStats'),
      orderBy('date', 'desc'),
      limit(DAYS),
    );
    return onSnapshot(q, (snap) => {
      const next = emptyAgg();
      snap.docs.forEach((d) => {
        const data = d.data() as NotificationStatsDoc;
        TYPES.forEach((t) => {
          next[t].sent   += data.sent?.[t]   ?? 0;
          next[t].failed += data.failed?.[t] ?? 0;
          next[t].opened += data.opened?.[t] ?? 0;
        });
      });
      setAgg(next);
      setDays(snap.size);
    });
  }, [uid]);

  const totalSent = TYPES.reduce((s, t) => s + agg[t].sent, 0);
  const totalOpened = TYPES.reduce((s, t) => s + agg[t].opened, 0);
  const totalFailed = TYPES.reduce((s, t) => s + agg[t].failed, 0);

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={16} className="text-[var(--leaf)]" />
        <h3 className="text-sm font-medium text-[var(--fg-primary)]">알림 통계</h3>
        <span className="ml-auto text-[10px] text-[var(--fg-faint)]">최근 {DAYS}일</span>
      </div>

      {totalSent === 0 && totalFailed === 0 ? (
        <p className="text-xs text-[var(--fg-faint)]">
          {days === 0 ? '아직 집계된 알림이 없어요.' : '최근 발송된 알림이 없어요.'}
        </p>
      ) : (
        <>
          {/* 요약 */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="총 발송" value={totalSent} />
            <Stat label="총 열람" value={totalOpened} accent />
            <Stat label="전체 열람률" value={`${rate(totalOpened, totalSent)}%`} accent />
          </div>

          {/* 타입별 */}
          <div className="space-y-2 pt-1">
            {TYPES.filter((t) => agg[t].sent > 0 || agg[t].failed > 0).map((t) => {
              const { sent, failed, opened } = agg[t];
              const openRate = rate(opened, sent);
              return (
                <div key={t} className="rounded-md bg-[var(--bg-base)] p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--fg-primary)]">{TYPE_LABELS[t]}</span>
                    <span className="text-[11px] text-[var(--fg-muted)]">열람률 {openRate}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--leaf-soft)]">
                    <div className="h-full rounded-full bg-[var(--leaf)]" style={{ width: `${openRate}%` }} />
                  </div>
                  <div className="flex gap-3 text-[10px] text-[var(--fg-faint)]">
                    <span>발송 {sent}</span>
                    <span>열람 {opened}</span>
                    {failed > 0 && <span className="text-[var(--bloom)]">실패 {failed}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] leading-snug text-[var(--fg-faint)]">
            발송은 FCM 접수 기준이에요(기기 도달과 다를 수 있어요). 실패한 무효 토큰은
            발송 시 자동으로 정리됩니다.
          </p>
        </>
      )}
    </section>
  );
}

function rate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-md bg-[var(--bg-base)] p-2 text-center">
      <p className={`text-base font-semibold ${accent ? 'text-[var(--leaf)]' : 'text-[var(--fg-primary)]'}`}>{value}</p>
      <p className="text-[10px] text-[var(--fg-faint)]">{label}</p>
    </div>
  );
}
