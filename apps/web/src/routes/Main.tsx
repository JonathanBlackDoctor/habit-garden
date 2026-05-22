import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useHabits, useHabitChecks } from '@/features/habits/useHabits';
import { useProgress } from '@/features/garden/useGarden';
import PlantSVG from '@/features/garden/PlantSVG';
import { formatKoreanDate, timeOfDay } from '@/lib/dayBoundary';
import type { DayDoc, TodayTodoDoc } from 'shared/types/firestore';
import { motion } from 'framer-motion';
import { Flame, ArrowRight, CheckCircle2 } from 'lucide-react';

const TIME_LABELS: Record<string, string> = {
  morning: '아침', afternoon: '점심', evening: '저녁', night: '밤', anytime: '언제든',
};
const TIME_ORDER = ['morning', 'afternoon', 'evening', 'night', 'anytime'];

export default function Main() {
  const uid      = useAppStore((s) => s.uid);
  const date     = useAppStore((s) => s.currentDate);
  const navigate = useNavigate();
  const habits   = useHabits();
  const checks   = useHabitChecks(date);
  const progress = useProgress();
  const [dayDoc, setDayDoc]   = useState<DayDoc | null>(null);
  const [todos, setTodos]     = useState<TodayTodoDoc[]>([]);
  const currentTOD = timeOfDay();

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid, 'days', date), (snap) => {
      setDayDoc(snap.exists() ? (snap.data() as DayDoc) : null);
    });
  }, [uid, date]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(collection(db, 'users', uid, 'days', date, 'todayTodos')), (snap) => {
      setTodos(snap.docs.map((d) => d.data() as TodayTodoDoc));
    });
  }, [uid, date]);

  const totalAchieved = Object.values(checks).filter((c) => c.achieved).length;
  const totalHabits   = habits.length;
  const spendable     = progress?.spendablePoints ?? 0;
  const streak        = progress?.globalStreak ?? 0;
  const level         = progress?.level ?? 1;
  const health        = progress?.gardenState?.health ?? 100;
  const plants        = progress?.gardenState?.plants ?? [];
  const hasReflection = !!dayDoc?.reflection;

  // 시간대별 요약
  const groupedHabits = TIME_ORDER.map((tod) => {
    const group = habits.filter((h) => h.timeOfDay === tod);
    const achieved = group.filter((h) => checks[h.id]?.achieved).length;
    return { tod, group, achieved };
  }).filter(({ group }) => group.length > 0);

  return (
    <div className="flex flex-col gap-3 p-4 pb-6">
      {/* ── 상단바 ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[var(--radius-lg)] bg-[var(--leaf)] px-4 py-3 text-white"
        style={{ boxShadow: '0 2px 8px rgba(79,122,55,0.3)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-80">{formatKoreanDate(date)}</p>
            <p className="text-base font-semibold">
              Lv.{level}
              {streak > 0 && (
                <span className="ml-2 text-sm opacity-90">
                  🔥{streak}일
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">생기 {health}</p>
            <p className="text-base font-semibold tabular-nums">✦{spendable.toLocaleString()}P</p>
          </div>
        </div>
      </motion.div>

      {/* ── 오늘의 습관 ── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">오늘의 습관</h3>
          <button
            onClick={() => navigate('/habits')}
            className="flex items-center gap-1 text-xs text-[var(--leaf)]"
          >
            지금 체크 <ArrowRight size={13} />
          </button>
        </div>

        {groupedHabits.length === 0 ? (
          <p className="text-xs text-[var(--fg-faint)] text-center py-2">
            관리 메뉴에서 시드 습관을 추가하세요.
          </p>
        ) : (
          <div className="space-y-2">
            {groupedHabits.map(({ tod, group, achieved }) => {
              const isNow = tod === currentTOD;
              const allDone = achieved === group.length && group.length > 0;
              return (
                <button
                  key={tod}
                  onClick={() => navigate('/habits')}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className="w-10 text-xs text-[var(--fg-muted)] shrink-0">{TIME_LABELS[tod]}</span>
                  <div className="flex-1 flex gap-1">
                    {group.map((h) => (
                      <div
                        key={h.id}
                        className={`h-3.5 w-3.5 rounded-full ${
                          checks[h.id]?.achieved
                            ? 'bg-[var(--leaf)]'
                            : checks[h.id]?.score !== undefined
                            ? 'bg-[var(--wither)]'
                            : 'bg-[var(--leaf-soft)] border border-[var(--border)]'
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-xs tabular-nums shrink-0 ${
                      allDone ? 'text-[var(--leaf)]' : isNow ? 'text-[var(--bloom)] font-medium' : 'text-[var(--fg-faint)]'
                    }`}
                  >
                    {achieved}/{group.length}
                    {isNow && !allDone && ' ⚡'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="text-xs text-[var(--fg-faint)] text-right tabular-nums">
          전체 달성 {totalAchieved}/{totalHabits}
        </div>
      </motion.section>

      {/* ── 정원 미리보기 ── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-4 space-y-2"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">정원</h3>
          <button
            onClick={() => navigate('/garden')}
            className="flex items-center gap-1 text-xs text-[var(--leaf)]"
          >
            정원 가기 <ArrowRight size={13} />
          </button>
        </div>
        <div
          className="flex items-end justify-center gap-2 rounded-[var(--radius)] bg-gradient-to-b from-[#EEF7E4] to-[var(--leaf-soft)] py-4 min-h-[96px]"
        >
          {plants.length === 0 ? (
            <p className="text-xs text-[var(--fg-faint)]">씨앗을 심어보세요 🌱</p>
          ) : (
            plants.slice(0, 4).map((p) => (
              <PlantSVG key={p.id} speciesId={p.speciesId} stage={p.stage} withered={!!p.witheredSince} size={54} />
            ))
          )}
        </div>
        {totalAchieved > 0 && (
          <p className="text-xs text-[var(--fg-muted)] text-center">
            오늘 +{totalAchieved * 10}P 예상 적립
          </p>
        )}
      </motion.section>

      {/* ── 컨디션 한 줄 ── */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        onClick={() => navigate('/condition')}
        className="card px-4 py-3 text-left flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--sky)]">☀</span>
          {dayDoc?.condition?.sleepScore !== undefined ? (
            <span className="text-sm text-[var(--fg-primary)]">
              수면 {dayDoc.condition.sleepScore} · 에너지 {dayDoc.condition.energyScore ?? '-'} · 기분 {dayDoc.condition.moodScore ?? '-'}
            </span>
          ) : (
            <span className="text-sm text-[var(--fg-faint)]">컨디션 입력 전 — 탭해서 기록</span>
          )}
        </div>
        <ArrowRight size={14} className="text-[var(--fg-faint)]" />
      </motion.button>

      {/* ── 플래너 / 회고 ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-3"
      >
        {/* 플래너 */}
        <button
          onClick={() => navigate('/planner')}
          className="card p-3 text-left space-y-1"
        >
          <p className="text-xs font-medium text-[var(--fg-muted)]">할 일</p>
          {todos.length === 0 ? (
            <p className="text-xs text-[var(--fg-faint)]">없음</p>
          ) : (
            <>
              <p className="text-sm tabular-nums text-[var(--fg-primary)]">
                {todos.filter((t) => t.done).length}/{todos.length} 완료
              </p>
              {todos.slice(0, 2).map((t) => (
                <p key={t.id} className="text-xs text-[var(--fg-muted)] truncate">
                  {t.done ? '✓' : '□'} {t.title}
                </p>
              ))}
            </>
          )}
        </button>

        {/* 회고 */}
        <button
          onClick={() => navigate('/reflection')}
          className="card p-3 text-left space-y-1"
        >
          <p className="text-xs font-medium text-[var(--fg-muted)]">하루 회고</p>
          {hasReflection ? (
            <div className="flex items-center gap-1 text-[var(--leaf)]">
              <CheckCircle2 size={14} />
              <span className="text-xs">작성 완료</span>
            </div>
          ) : (
            <p className="text-xs text-[var(--fg-faint)]">저녁에 작성하기</p>
          )}
        </button>
      </motion.div>

      {/* ── 기도 ── */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        onClick={() => navigate('/prayers')}
        className="card px-4 py-3 text-left flex items-center justify-between"
      >
        <span className="text-sm text-[var(--sky)]">🙏 오늘의 기도 · 감사</span>
        <ArrowRight size={14} className="text-[var(--fg-faint)]" />
      </motion.button>
    </div>
  );
}
