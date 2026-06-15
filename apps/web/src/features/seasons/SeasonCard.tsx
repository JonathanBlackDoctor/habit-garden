import { useEffect, useMemo, useState } from 'react';
import { doc, setDoc, serverTimestamp, collection, addDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useProgress } from '@/features/garden/useGarden';
import { currentSeason, seasonInstanceId } from './seasons';
import type { DayDoc, ProgressDoc } from 'shared/types/firestore';
import { motion } from 'framer-motion';
import { feedback } from '@/lib/feedback';
import { toast } from 'sonner';

/** Phase 4-2 — 분기 시즌 챌린지 카드. 누적 달성 체크로 보상 단계 달성. */
export default function SeasonCard() {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const progress = useProgress();
  const season = currentSeason(today);
  const instanceId = seasonInstanceId(today);

  const [recentDays, setRecentDays] = useState<DayDoc[]>([]);

  // 시즌 시작이 바뀌면 progress.seasonProgress 초기화
  useEffect(() => {
    if (!uid || !progress) return;
    const sp = progress.seasonProgress;
    if (sp && sp.seasonId === instanceId) return;
    setDoc(
      doc(db, 'users', uid, 'progress', 'main'),
      {
        seasonProgress: { seasonId: instanceId, totalChecks: 0, rewardsClaimed: [] },
        updatedAt: serverTimestamp() as any,
      },
      { merge: true },
    ).catch(() => {});
    // progress 를 의존성에 포함: 최초 사용자는 progress 로드 시 seasonProgress 가 없어
    // seasonId 가 undefined→undefined 로 머물러 초기화가 누락될 수 있다. progress 로드 시
    // 한 번 더 평가되도록 한다. 이미 같은 시즌이면 위 가드로 멈춘다.
  }, [uid, instanceId, progress, progress?.seasonProgress?.seasonId]);

  // 진행률은 days.dayScore 기반 — 시즌 시작 이후 누적 체크 수
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, 'users', uid, 'days'), (snap) => {
      setRecentDays(snap.docs.map((d) => d.data() as DayDoc));
    });
  }, [uid]);

  const total = useMemo(() => {
    // 단순화: 시즌 동안 dayScore>=50 인 날 카운트 × 일평균 가중치 가정
    // 더 정확하게 하려면 collectionGroup 호출이 추가로 필요해 비용 ↑.
    // 여기서는 "달성한 날 수"로 시즌 진행 — 90일 만점.
    const start = seasonStartDate(today);
    return recentDays.filter((d) => d.date >= start && (d.dayScore ?? 0) >= 50).length;
  }, [recentDays, today]);

  // 보상 자동 지급 — 트랜잭션으로 보상 단계별 1회만.
  // rewardsClaimed를 서버 커밋값 기준으로 원자적으로 검사·갱신하므로,
  // days 구독 재계산이나 빠른 재렌더로 effect가 여러 번 떠도 중복 적립되지 않는다.
  useEffect(() => {
    if (!uid || !progress?.seasonProgress) return;
    const claimedNow = new Set(progress.seasonProgress.rewardsClaimed);
    if (!season.tiers.some((t) => total >= t.at && !claimedNow.has(t.rewardId))) return;

    const progressRef = doc(db, 'users', uid, 'progress', 'main');
    (async () => {
      const awarded = await runTransaction(db, async (tx) => {
        const p = (await tx.get(progressRef)).data() as ProgressDoc | undefined;
        const sp = p?.seasonProgress;
        if (!sp || sp.seasonId !== instanceId) return [];
        const claimed = new Set(sp.rewardsClaimed);
        const pending = season.tiers.filter((t) => total >= t.at && !claimed.has(t.rewardId));
        if (pending.length === 0) return [];

        const bonusPts = pending.length * 50; // 보상 단계당 50P
        tx.set(progressRef, {
          seasonProgress: {
            seasonId: instanceId,
            totalChecks: total,
            rewardsClaimed: [...sp.rewardsClaimed, ...pending.map((t) => t.rewardId)],
          },
          spendablePoints: (p?.spendablePoints ?? 0) + bonusPts,
          totalPoints: (p?.totalPoints ?? 0) + bonusPts,
          gardenState: {
            ...p?.gardenState,
            decorations: [
              ...(p?.gardenState?.decorations ?? []),
              ...pending.map((t) => t.rewardId),
            ],
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
        return pending;
      }).catch(() => [] as typeof season.tiers);

      if (awarded.length === 0) return;

      for (const t of awarded) {
        await addDoc(collection(db, 'users', uid, 'pointLedger'), {
          delta: 50,
          reason: `season_${season.id}_${t.rewardId}`,
          createdAt: serverTimestamp() as any,
        }).catch(() => {});
      }
      feedback('levelup');
      toast(`${season.emoji} ${awarded[0].title} 획득! +${awarded.length * 50}P`, { duration: 6000 });
    })();
  }, [uid, total, season, instanceId]);

  if (!progress) return null;

  const claimed = new Set(progress.seasonProgress?.rewardsClaimed ?? []);
  const nextTier = season.tiers.find((t) => !claimed.has(t.rewardId));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{season.emoji}</span>
        <div className="flex-1">
          <p className="text-xs text-[var(--fg-muted)]">시즌</p>
          <p className="text-sm font-medium text-[var(--fg-primary)]">{season.title}</p>
        </div>
        <span className="text-xs font-medium tabular-nums text-[var(--fg-muted)]">{total}일</span>
      </div>
      <div className="flex gap-1">
        {season.tiers.map((t) => {
          const got = claimed.has(t.rewardId);
          const reached = total >= t.at;
          return (
            <div key={t.rewardId} className="flex-1">
              <div
                className="h-2 rounded-full"
                style={{
                  background: got ? 'var(--bloom)' : reached ? 'var(--leaf)' : 'var(--leaf-soft)',
                }}
                title={`${t.at}일 — ${t.title}`}
              />
              <p className="mt-1 text-[9px] tabular-nums text-[var(--fg-faint)] text-center">{t.at}일</p>
            </div>
          );
        })}
      </div>
      {nextTier && (
        <p className="text-[10px] text-[var(--fg-muted)]">
          다음 보상: {nextTier.title} ({total}/{nextTier.at}일)
        </p>
      )}
    </motion.div>
  );
}

function seasonStartDate(today: string): string {
  const d = new Date(today);
  const m = d.getMonth() + 1;
  let startMonth: number;
  if (m >= 3 && m <= 5)  startMonth = 3;
  else if (m >= 6 && m <= 8)  startMonth = 6;
  else if (m >= 9 && m <= 11) startMonth = 9;
  else startMonth = 12;
  let year = d.getFullYear();
  if (startMonth === 12 && m < 3) year = year - 1;
  return `${year}-${String(startMonth).padStart(2, '0')}-01`;
}
