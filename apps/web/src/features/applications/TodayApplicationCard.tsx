import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  useApplications, useApplicationChecks, useApplicationActions,
} from '@/features/applications/useApplications';
import type { ApplicationDoc } from 'shared/types/firestore';
import { ProgressRail, SectionHeading, StatusCircle } from '@/components/Editorial';

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
      className="w-full border-y border-[var(--divider-soft)] py-[13px] text-left"
      >
        <p className="text-[15.5px] font-semibold tracking-[-0.02em] text-[var(--fg-primary)]">오늘의 적용</p>
        <p className="mt-1 truncate text-[13.5px] text-[var(--fg-faint)]">오늘 받은 말씀을 어떻게 살지 한 줄로 적어보세요</p>
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
    <section className="space-y-2">
      <SectionHeading
        title="오늘의 적용"
        meta={`${doneCount} / ${active.length}`}
        action={<button type="button" onClick={goApplications}>전체 보기</button>}
      />

      <div className="editorial-list">
        {shown.map((app) => (
          <ApplicationRow key={app.id} app={app} practicedToday={!!checks[app.id]} />
        ))}
      </div>

      {remaining > 0 && (
        <button onClick={goApplications} className="w-full py-1 text-left text-[13px] text-[var(--fg-faint)]">
          +{remaining}개 더 보기
        </button>
      )}
    </section>
  );
}

function ApplicationRow({ app, practicedToday }: { app: ApplicationDoc; practicedToday: boolean }) {
  const { checkPractice, uncheckPractice } = useApplicationActions();
  const goalMet = app.practiceCount >= app.targetDays;
  const progress = Math.min(app.practiceCount / Math.max(app.targetDays, 1), 1);

  return (
    <motion.div layout className="editorial-row">
      <StatusCircle
        checked={practicedToday}
        label={`${app.application} ${practicedToday ? '실천 취소' : '실천 완료'}`}
        onClick={() => void (practicedToday ? uncheckPractice(app) : checkPractice(app))}
      />
      <div className="min-w-0 flex-1">
        <p className={cn(
          'truncate text-sm leading-snug',
          practicedToday ? 'text-[var(--fg-faint)] line-through' : 'font-medium text-[var(--fg-primary)]',
        )}>
          {app.application}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <ProgressRail value={progress * 100} className="flex-1" />
          <span className="shrink-0 text-[10px] tabular-nums text-[var(--fg-faint)]">{app.practiceCount}/{app.targetDays}</span>
          {app.streak > 1 && (
            <span className="flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-[var(--bloom)]">
              <Flame size={10} />{app.streak}
            </span>
          )}
        </div>
      </div>
      <span className="meta-copy tabular-nums">{goalMet ? '정착' : app.streak > 1 ? `${app.streak}일` : ''}</span>
    </motion.div>
  );
}
