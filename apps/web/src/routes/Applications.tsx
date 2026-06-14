import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ChevronLeft, Plus, Flame, Check, CheckCircle2, Archive, Trash2, BookOpen, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useFaithEnabled } from '@/lib/features';
import { formatKoreanDate } from '@/lib/dayBoundary';
import { cn } from '@/lib/utils';
import {
  useApplications, useApplicationChecks, useApplicationActions,
  type NewApplicationInput,
} from '@/features/applications/useApplications';
import type { ApplicationDoc, ApplicationType } from 'shared/types/firestore';
import {
  APPLICATION_TYPE_LABELS, APPLICATION_DEFAULT_TARGET_DAYS,
} from 'shared/types/firestore';

const TYPE_ORDER: ApplicationType[] = ['qt', 'sermon', 'meditation'];
const TYPE_EMOJI: Record<ApplicationType, string> = { qt: '🌅', sermon: '⛪', meditation: '📖' };

export default function Applications() {
  const faithEnabled = useFaithEnabled();
  if (!faithEnabled) return <Navigate to="/" replace />;
  return <ApplicationsInner />;
}

function ApplicationsInner() {
  const navigate = useNavigate();
  const date = useAppStore((s) => s.currentDate);
  const apps = useApplications();
  const checks = useApplicationChecks(date);
  const [showForm, setShowForm] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const active = apps.filter((a) => a.status === 'active');
  const finished = apps.filter((a) => a.status !== 'active');

  return (
    <div className="min-h-screen p-4 space-y-4 pb-10">
      {/* 헤더 */}
      <div className="flex items-center gap-2 py-1">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]" aria-label="뒤로">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-[var(--fg-primary)]">말씀 적용</h2>
          <p className="text-[11px] text-[var(--fg-faint)]">큐티·설교·묵상에서 받은 적용을 매일 실천으로</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center justify-center rounded-full bg-[var(--leaf)] p-2 text-white active:opacity-80"
          aria-label="적용 추가"
        >
          <Plus size={18} className={cn('transition-transform', showForm && 'rotate-45')} />
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <AddForm onDone={() => setShowForm(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 진행 중 적용 */}
      {active.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-[var(--fg-faint)]">
          <BookOpen size={28} className="text-[var(--leaf)]" />
          <p className="text-sm">아직 기록한 적용이 없어요.</p>
          <p className="text-xs">오늘 큐티·설교에서 받은 말씀을 어떻게 살지 한 줄로 적어보세요.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 rounded-full bg-[var(--leaf)] px-4 py-2 text-xs font-medium text-white"
          >
            첫 적용 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((app) => (
            <ApplicationCard key={app.id} app={app} practicedToday={!!checks[app.id]} />
          ))}
        </div>
      )}

      {/* 완료·보관함 */}
      {finished.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex w-full items-center justify-between rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--fg-muted)] shadow-[var(--shadow-sm)]"
          >
            <span>완료·보관 ({finished.length})</span>
            <ChevronLeft size={16} className={cn('transition-transform', showDone ? '-rotate-90' : 'rotate-0')} />
          </button>
          {showDone && (
            <div className="mt-2 space-y-2">
              {finished.map((app) => (
                <ApplicationCard key={app.id} app={app} practicedToday={!!checks[app.id]} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const { addApplication } = useApplicationActions();
  const [type, setType] = useState<ApplicationType>('qt');
  const [reference, setReference] = useState('');
  const [insight, setInsight] = useState('');
  const [application, setApplication] = useState('');
  const [targetDays, setTargetDays] = useState(APPLICATION_DEFAULT_TARGET_DAYS);

  const submit = async () => {
    if (!application.trim()) return;
    const input: NewApplicationInput = { type, application, reference, insight, targetDays };
    await addApplication(input);
    setReference(''); setInsight(''); setApplication('');
    onDone();
  };

  return (
    <div className="card space-y-2.5 p-3.5">
      {/* 유형 */}
      <div className="flex gap-1.5">
        {TYPE_ORDER.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              'flex-1 rounded-[var(--radius-sm)] py-1.5 text-xs font-medium transition-colors',
              type === t ? 'bg-[var(--leaf)] text-white' : 'bg-[var(--bg-base)] text-[var(--fg-muted)]',
            )}
          >
            {TYPE_EMOJI[t]} {APPLICATION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="본문 (예: 요한복음 3:16) · 선택"
        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--leaf)]"
      />
      <input
        value={insight}
        onChange={(e) => setInsight(e.target.value)}
        placeholder="깨달은 말씀 · 선택"
        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--leaf)]"
      />
      <textarea
        value={application}
        onChange={(e) => setApplication(e.target.value)}
        placeholder="적용 — 무엇을 실천할까요? (필수, 예: 매일 먼저 가족에게 한마디 격려하기)"
        rows={2}
        className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--leaf)]"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
          실천 목표
          <input
            type="number"
            min={1}
            max={60}
            value={targetDays}
            onChange={(e) => setTargetDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            className="w-14 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-xs tabular-nums outline-none focus:border-[var(--leaf)]"
          />
          일
        </label>
        <button
          onClick={submit}
          disabled={!application.trim()}
          className="rounded-full bg-[var(--leaf)] px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </div>
  );
}

function ApplicationCard({ app, practicedToday }: { app: ApplicationDoc; practicedToday: boolean }) {
  const { checkPractice, uncheckPractice, completeApplication, archiveApplication, reactivateApplication, removeApplication } =
    useApplicationActions();
  const [menuOpen, setMenuOpen] = useState(false);

  const goalMet = app.practiceCount >= app.targetDays;
  const progress = Math.min(app.practiceCount / Math.max(app.targetDays, 1), 1);
  const isActive = app.status === 'active';

  return (
    <motion.div layout className="card space-y-2 p-3.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded-full bg-[var(--leaf-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--leaf)]">
          {TYPE_EMOJI[app.type]} {APPLICATION_TYPE_LABELS[app.type]}
        </span>
        <div className="min-w-0 flex-1">
          {app.reference && (
            <p className="text-xs font-medium text-[var(--bloom)]">{app.reference}</p>
          )}
          <p className="text-sm font-medium leading-snug text-[var(--fg-primary)]">{app.application}</p>
          {app.insight && (
            <p className="mt-0.5 text-xs leading-snug text-[var(--fg-muted)]">💡 {app.insight}</p>
          )}
        </div>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="shrink-0 rounded-full px-1.5 text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"
          aria-label="더보기"
        >
          ⋯
        </button>
      </div>

      {/* 실천 진행 */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-base)]">
          <div
            className={cn('h-full rounded-full transition-all', goalMet ? 'bg-[var(--bloom)]' : 'bg-[var(--leaf)]')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-[var(--fg-muted)]">
          {app.practiceCount}/{app.targetDays}일
        </span>
        {app.streak > 1 && (
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-[var(--bloom)] tabular-nums">
            <Flame size={12} />{app.streak}
          </span>
        )}
      </div>

      {goalMet && isActive && (
        <p className="text-[11px] font-medium text-[var(--bloom)]">🎉 목표 달성! 삶에 정착됐다면 완료로 마무리하세요.</p>
      )}

      {/* 액션 */}
      {isActive ? (
        <button
          onClick={() => (practicedToday ? uncheckPractice(app) : checkPractice(app))}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] py-2 text-sm font-medium transition-colors',
            practicedToday
              ? 'bg-[var(--leaf-soft)] text-[var(--leaf)]'
              : 'bg-[var(--leaf)] text-white',
          )}
        >
          {practicedToday ? <><CheckCircle2 size={16} /> 오늘 실천함 (취소)</> : <><Check size={16} /> 오늘 실천했어요</>}
        </button>
      ) : (
        <p className="text-[11px] text-[var(--fg-faint)]">
          {app.status === 'completed' ? '✓ 완료 — 삶에 정착됨' : '보관됨'} · {formatKoreanDate(app.date)} 시작
        </p>
      )}

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-2 overflow-hidden pt-1"
          >
            {isActive && (
              <button
                onClick={() => { completeApplication(app); setMenuOpen(false); }}
                className="flex items-center gap-1 rounded-full bg-[var(--bloom-soft)] px-3 py-1.5 text-xs text-[var(--bloom)]"
              >
                <CheckCircle2 size={13} /> 완료
              </button>
            )}
            {isActive ? (
              <button
                onClick={() => { archiveApplication(app); setMenuOpen(false); }}
                className="flex items-center gap-1 rounded-full bg-[var(--bg-base)] px-3 py-1.5 text-xs text-[var(--fg-muted)]"
              >
                <Archive size={13} /> 보관
              </button>
            ) : (
              <button
                onClick={() => { reactivateApplication(app); setMenuOpen(false); }}
                className="flex items-center gap-1 rounded-full bg-[var(--bg-base)] px-3 py-1.5 text-xs text-[var(--fg-muted)]"
              >
                <RotateCcw size={13} /> 다시 진행
              </button>
            )}
            <button
              onClick={() => {
                if (confirm('이 적용을 삭제할까요?')) { removeApplication(app); }
                setMenuOpen(false);
              }}
              className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs text-red-500"
            >
              <Trash2 size={13} /> 삭제
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
