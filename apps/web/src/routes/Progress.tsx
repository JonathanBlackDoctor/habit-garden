import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useProgress } from '@/features/progress/useProgress';
import type { DayDoc } from 'shared/types/firestore';
import CountUp from '@/components/CountUp';
import { motion } from 'framer-motion';
import { useTabBloomKey } from '@/lib/tabActive';
import { plannerDate } from '@/lib/dayBoundary';
import { Flame, Star } from 'lucide-react';
import HabitHeatmap from '@/features/stats/HabitHeatmap';
import WeeklyReport from '@/features/stats/WeeklyReport';
import WeeklyInsightCard from '@/features/coach/WeeklyInsightCard';
import CorrelationCard from '@/features/insights/CorrelationCard';
import SignupCTA from '@/components/SignupCTA';
import { useIsPremium } from '@/lib/features';

export default function Progress() {
  const uid      = useAppStore((s) => s.uid);
  const navigate = useNavigate();
  const isPremium = useIsPremium();
  const progress = useProgress();
  const bloomKey = useTabBloomKey('/progress'); // 진척 탭에 들어올 때 카운트 재생
  const [recentDays, setRecentDays] = useState<DayDoc[]>([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'days'), orderBy('date', 'desc'), limit(30));
    return onSnapshot(q, (snap) => {
      setRecentDays(snap.docs.map((d) => d.data() as DayDoc));
    });
  }, [uid]);

  // progress 문서는 서버가 merge 쓰기로 만들 때까지 없을 수 있다 — 통계는 0으로 시작.
  const globalStreak = progress?.globalStreak ?? 0;
  const globalBestStreak = progress?.globalBestStreak ?? 0;

  const scoreByDate = new Map(recentDays.map((d) => [d.date, d.dayScore ?? 0]));
  const base = new Date(plannerDate() + 'T00:00:00Z');
  const last30Dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="min-h-screen p-4 space-y-4 pb-8">
      <h2 className="text-base font-semibold text-[var(--fg-primary)] pt-2">진척 현황</h2>

      {/* 스트릭 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3 text-center">
          <motion.div key={bloomKey} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }}>
            <Flame size={20} className="text-[var(--bloom)] mx-auto mb-1" />
          </motion.div>
          <p className="text-2xl font-bold text-[var(--fg-primary)] tabular-nums">
            <CountUp value={globalStreak} replayKey={bloomKey} />
          </p>
          <p className="text-xs text-[var(--fg-muted)]">현재 스트릭</p>
        </div>
        <div className="card p-3 text-center">
          <motion.div key={bloomKey} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }}>
            <Star size={20} className="text-[var(--bloom)] mx-auto mb-1" />
          </motion.div>
          <p className="text-2xl font-bold text-[var(--fg-primary)] tabular-nums">
            <CountUp value={globalBestStreak} replayKey={bloomKey} />
          </p>
          <p className="text-xs text-[var(--fg-muted)]">최고 스트릭</p>
        </div>
      </div>

      {/* 잔디 히트맵 */}
      <div className="card p-4 space-y-2">
        <h3 className="text-sm font-medium text-[var(--fg-primary)]">최근 30일 · 탭하여 수정</h3>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 30 }).map((_, i) => {
            const date = last30Dates[i];
            const score = scoreByDate.get(date) ?? 0;
            const bg = score === 0
              ? 'var(--leaf-soft)'
              : score < 40
              ? '#B8D89A'
              : score < 70
              ? '#7CB95B'
              : '#4F7A37';
            const dayNum = Number(date.slice(8, 10));
            return (
              <button
                key={i}
                type="button"
                title={`${date} · ${score}점`}
                onClick={() => navigate(`/day/${date}`)}
                className="flex h-7 w-7 items-center justify-center rounded-sm text-[10px] leading-none tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--leaf)]"
                style={{ background: bg, color: score >= 70 ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.5)' }}
              >
                {dayNum}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--fg-faint)]">
          <div className="flex gap-1">
            {['var(--leaf-soft)', '#B8D89A', '#7CB95B', '#4F7A37'].map((c, i) => (
              <div key={i} className="h-3 w-3 rounded-sm" style={{ background: c }} />
            ))}
          </div>
          <span>낮음 → 높음</span>
        </div>
      </div>

      {/* AI 주간 인사이트 — 승인 사용자 전용 */}
      {isPremium ? (
        <WeeklyInsightCard />
      ) : (
        <SignupCTA
          title="주간 인사이트"
          desc="가입하면 한 주의 패턴을 분석한 AI 주간 인사이트와 AI 피드백이 열려요."
        />
      )}

      {/* 무드-습관 상관 (B-16) */}
      <CorrelationCard />

      {/* 주간 리포트 */}
      <WeeklyReport />

      {/* 1년 잔디 히트맵 */}
      <HabitHeatmap />
    </div>
  );
}
