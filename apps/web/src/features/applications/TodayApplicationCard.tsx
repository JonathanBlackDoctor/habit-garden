import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, CheckCircle2, Flame, ArrowRight, BookOpen } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  useApplications, useApplicationChecks, useApplicationActions,
} from '@/features/applications/useApplications';
import { TYPE_EMOJI } from '@/routes/Applications';
import type { ApplicationDoc } from 'shared/types/firestore';

/** 메인(오늘 탭)에 노출되는 '오늘의 말씀 적용' 카드 — 진행 중 적용을 바로 보고 원탭 체크. */
export default function TodayApplicationCard() {
  const navigate = useNavigate();
  const date = useAppStore((s) => s.currentDate);
  const apps = useApplications();
  const checks = useApplicationChecks(date);

  const active = apps.filter((a) => a.status === 'active');
  const goApplications = () => navigate('/prayers?view=application');

  if (active.length === 0) {
    return (
      <button
        onClick={goApplications}
        className="card flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-lg">📖</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--fg-primary)]">말씀 적용</p>
          <p className="truncate text-xs text-[var(--fg-faint)]">오늘 받은 말씀을 어떻게 살지 한 줄로 적어보세요</p>
        </div>
        <ArrowRight size={14} className="shrink-0 text-[var(--fg-faint)]" />
      </button>
    );
  }

  // 미실천을 위로, 그 안에서 연속일 높은 순 — 오늘 할 일이 먼저 보이게
  const sorted = [...active].sort((a, b) => {
    const da = checks[a.id] ? 1 : 0;
    const db = checks[b.id] ? 1 : 0;
    if (da !== db) return da - db;
    return b.streak - a.streak;
  });
  const shown = sorted.slice(0, 3);
  const remaining = sorted.length - shown.length;
  const doneCount = active.filter((a) => checks[a.id]).length;

  return (
    <div className="card space-y-2.5 p-3.5">
      <button onClick={goApplications} className="flex w-full items-center gap-2 text-left">
        <BookOpen size={15} className="shrink-0 text-[var(--leaf)]" />
        <span className="text-sm font-semibold text-[var(--fg-primary)]">오늘의 말씀 적용</span>
        <span className="text-[11px] tabular-nums text-[var(--fg-faint)]">{doneCount}/{active.length}</span>
        <ArrowRight size={13} className="ml-auto shrink-0 text-[var(--fg-faint)]" />
      </button>

      <div className="space-y-1.5">
        {shown.map((app) => (
          <ApplicationRow key={app.id} app={app} practicedToday={!!checks[app.id]} />
        ))}
      </div>

      {remaining > 0 && (
        <button onClick={goApplications} className="w-full text-center text-[11px] text-[var(--fg-faint)]">
          +{remaining}개 더 보기
        </button>
      )}
    </div>
  );
}

function ApplicationRow({ app, practicedToday }: { app: ApplicationDoc; practicedToday: boolean }) {
  const { checkPractice, uncheckPractice } = useApplicationActions();
  const goalMet = app.practiceCount >= app.targetDays;
  const progress = Math.min(app.practiceCount / Math.max(app.targetDays, 1), 1);

  return (
    <motion.div layout className="flex items-center gap-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-base)] p-2">
      <div className="min-w-0 flex-1">
        <p className={cn(
          'truncate text-sm leading-snug',
          practicedToday ? 'text-[var(--fg-faint)] line-through' : 'font-medium text-[var(--fg-primary)]',
        )}>
          <span className="mr-1">{TYPE_EMOJI[app.type]}</span>{app.application}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg-surface)]">
            <div
              className={cn('h-full rounded-full transition-all', goalMet ? 'bg-[var(--bloom)]' : 'bg-[var(--leaf)]')}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-[var(--fg-faint)]">{app.practiceCount}/{app.targetDays}</span>
          {app.streak > 1 && (
            <span className="flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-[var(--bloom)]">
              <Flame size={10} />{app.streak}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => (practicedToday ? uncheckPractice(app) : checkPractice(app))}
        aria-label={practicedToday ? '실천 취소' : '오늘 실천했어요'}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
          practicedToday ? 'bg-[var(--leaf-soft)] text-[var(--leaf)]' : 'bg-[var(--leaf)] text-white',
        )}
      >
        {practicedToday ? <CheckCircle2 size={17} /> : <Check size={17} />}
      </button>
    </motion.div>
  );
}
