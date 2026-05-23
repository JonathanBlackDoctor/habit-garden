import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useProgress } from '@/features/garden/useGarden';
import { BADGE_DEFS } from 'shared/types/firestore';
import type { BadgeDoc, DayDoc } from 'shared/types/firestore';
import { xpForLevel } from '@/lib/utils';
import { Flame, Star, Award } from 'lucide-react';
import HabitHeatmap from '@/features/stats/HabitHeatmap';
import WeeklyReport from '@/features/stats/WeeklyReport';
import SeasonCard from '@/features/seasons/SeasonCard';
import WeeklyInsightCard from '@/features/coach/WeeklyInsightCard';

export default function Progress() {
  const uid      = useAppStore((s) => s.uid);
  const navigate = useNavigate();
  const progress = useProgress();
  const [badges, setBadges]   = useState<BadgeDoc[]>([]);
  const [recentDays, setRecentDays] = useState<DayDoc[]>([]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, 'users', uid, 'badges'), (snap) => {
      setBadges(snap.docs.map((d) => d.data() as BadgeDoc));
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'days'), orderBy('date', 'desc'), limit(30));
    return onSnapshot(q, (snap) => {
      setRecentDays(snap.docs.map((d) => d.data() as DayDoc));
    });
  }, [uid]);

  if (!progress) return null;

  const { level, xpInLevel, globalStreak, globalBestStreak, spendablePoints, totalPoints } = progress;
  const xpNeeded = xpForLevel(level);
  const earnedIds = new Set(badges.map((b) => b.badgeId));

  return (
    <div className="min-h-screen p-4 space-y-4 pb-8">
      <h2 className="text-base font-semibold text-[var(--fg-primary)] pt-2">진척 현황</h2>

      {/* 레벨 카드 */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--fg-muted)]">레벨</p>
            <p className="text-2xl font-bold text-[var(--leaf)] tabular-nums">Lv.{level}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--fg-muted)]">포인트</p>
            <p className="text-xl font-bold text-[var(--bloom)] tabular-nums">✦{spendablePoints.toLocaleString()}</p>
            <p className="text-xs text-[var(--fg-faint)] tabular-nums">누적 {totalPoints.toLocaleString()}P</p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-[var(--fg-muted)]">
            <span>경험치</span>
            <span className="tabular-nums">{xpInLevel}/{xpNeeded}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--leaf-soft)]">
            <div
              className="h-full rounded-full bg-[var(--leaf)] transition-all"
              style={{ width: `${Math.min((xpInLevel / xpNeeded) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 스트릭 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3 text-center">
          <Flame size={20} className="text-[var(--bloom)] mx-auto mb-1" />
          <p className="text-2xl font-bold text-[var(--fg-primary)] tabular-nums">{globalStreak}</p>
          <p className="text-xs text-[var(--fg-muted)]">현재 스트릭</p>
        </div>
        <div className="card p-3 text-center">
          <Star size={20} className="text-[var(--bloom)] mx-auto mb-1" />
          <p className="text-2xl font-bold text-[var(--fg-primary)] tabular-nums">{globalBestStreak}</p>
          <p className="text-xs text-[var(--fg-muted)]">최고 스트릭</p>
        </div>
      </div>

      {/* 잔디 히트맵 */}
      <div className="card p-4 space-y-2">
        <h3 className="text-sm font-medium text-[var(--fg-primary)]">최근 30일 · 탭하여 수정</h3>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 30 }).map((_, i) => {
            const day = recentDays[29 - i];
            const score = day?.dayScore ?? 0;
            const bg = score === 0
              ? 'var(--leaf-soft)'
              : score < 40
              ? '#B8D89A'
              : score < 70
              ? '#7CB95B'
              : '#4F7A37';
            if (!day?.date) {
              return <div key={i} className="h-5 w-5 rounded-sm" style={{ background: bg }} />;
            }
            return (
              <button
                key={i}
                type="button"
                title={`${day.date} · ${score}점`}
                onClick={() => navigate(`/day/${day.date}`)}
                className="h-5 w-5 rounded-sm focus:outline-none focus:ring-2 focus:ring-[var(--leaf)]"
                style={{ background: bg }}
              />
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

      {/* AI 주간 인사이트 */}
      <WeeklyInsightCard />

      {/* 시즌 챌린지 */}
      <SeasonCard />

      {/* 주간 리포트 */}
      <WeeklyReport />

      {/* 1년 잔디 히트맵 */}
      <HabitHeatmap />

      {/* 배지 */}
      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-medium text-[var(--fg-primary)]">배지</h3>
        <div className="grid grid-cols-4 gap-3">
          {BADGE_DEFS.map((def) => {
            const earned = earnedIds.has(def.id);
            return (
              <div key={def.id} className="flex flex-col items-center gap-1 text-center">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${
                    earned
                      ? def.tier === 'gold'
                        ? 'bg-yellow-100 text-yellow-600'
                        : def.tier === 'silver'
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-orange-50 text-orange-400'
                      : 'bg-[var(--bg-base)] text-[var(--fg-faint)]'
                  }`}
                >
                  <Award size={22} />
                </div>
                <span className={`text-[10px] leading-tight ${earned ? 'text-[var(--fg-primary)]' : 'text-[var(--fg-faint)]'}`}>
                  {def.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
