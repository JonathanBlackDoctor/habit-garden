import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ChevronLeft, Plus, Flame, Check, CheckCircle2, Archive, Trash2, BookOpen, RotateCcw, Wand2, Loader2, PenLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { useFaithEnabled, useIsPremium } from '@/lib/features';
import { formatKoreanDate } from '@/lib/dayBoundary';
import { cn } from '@/lib/utils';
import {
  useApplications, useApplicationChecks, useApplicationActions, parseApplicationNote,
  type NewApplicationInput,
} from '@/features/applications/useApplications';
import type { ApplicationDoc, ApplicationType } from 'shared/types/firestore';
import {
  APPLICATION_TYPE_LABELS, APPLICATION_DEFAULT_TARGET_DAYS,
} from 'shared/types/firestore';

const TYPE_ORDER: ApplicationType[] = ['qt', 'sermon', 'meditation', 'lgm', 'etc'];
const TYPE_EMOJI: Record<ApplicationType, string> = {
  qt: '🌅', sermon: '⛪', meditation: '📖', lgm: '👥', etc: '📝',
};

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
          data-tour="application-add"
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

function TypeSelector({ type, setType }: { type: ApplicationType; setType: (t: ApplicationType) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {TYPE_ORDER.map((t) => (
        <button
          key={t}
          onClick={() => setType(t)}
          className={cn(
            'rounded-[var(--radius-sm)] py-1.5 text-xs font-medium transition-colors',
            type === t ? 'bg-[var(--leaf)] text-white' : 'bg-[var(--bg-base)] text-[var(--fg-muted)]',
          )}
        >
          {TYPE_EMOJI[t]} {APPLICATION_TYPE_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

const FIELD_CLS =
  'w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--leaf)]';

function AddForm({ onDone }: { onDone: () => void }) {
  const isPremium = useIsPremium();
  const [mode, setMode] = useState<'direct' | 'ai'>('direct');
  const [type, setType] = useState<ApplicationType>('qt');

  return (
    <div className="card space-y-2.5 p-3.5">
      {/* 입력 방식 — AI 정리는 승인 사용자 전용 */}
      {isPremium && (
        <div className="flex gap-1.5 rounded-full bg-[var(--bg-base)] p-1">
          <ModeTab active={mode === 'direct'} onClick={() => setMode('direct')} icon={<PenLine size={13} />} label="직접 입력" />
          <ModeTab active={mode === 'ai'} onClick={() => setMode('ai')} icon={<Wand2 size={13} />} label="AI로 정리" />
        </div>
      )}

      <TypeSelector type={type} setType={setType} />

      {mode === 'direct' || !isPremium
        ? <DirectFields type={type} onDone={onDone} />
        : <AiFields type={type} onDone={onDone} />}
    </div>
  );
}

function ModeTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-[var(--bg-surface)] text-[var(--leaf)] shadow-[var(--shadow-sm)]' : 'text-[var(--fg-muted)]',
      )}
    >
      {icon} {label}
    </button>
  );
}

function DirectFields({ type, onDone }: { type: ApplicationType; onDone: () => void }) {
  const { addApplication } = useApplicationActions();
  const [reference, setReference] = useState('');
  const [insight, setInsight] = useState('');
  const [application, setApplication] = useState('');
  const [targetDays, setTargetDays] = useState(APPLICATION_DEFAULT_TARGET_DAYS);

  const submit = async () => {
    if (!application.trim()) return;
    const input: NewApplicationInput = { type, application, reference, insight, targetDays };
    await addApplication(input);
    onDone();
  };

  return (
    <div className="space-y-2.5">
      <input value={reference} onChange={(e) => setReference(e.target.value)}
        placeholder="본문 (예: 요한복음 3:16) · 선택" className={FIELD_CLS} />
      <input value={insight} onChange={(e) => setInsight(e.target.value)}
        placeholder="깨달은 말씀 · 선택" className={FIELD_CLS} />
      <textarea value={application} onChange={(e) => setApplication(e.target.value)}
        placeholder="적용 — 무엇을 실천할까요? (필수, 예: 매일 먼저 가족에게 한마디 격려하기)"
        rows={2} className={cn(FIELD_CLS, 'resize-none')} />
      <div className="flex items-center justify-between">
        <TargetDaysInput value={targetDays} onChange={setTargetDays} />
        <button onClick={submit} disabled={!application.trim()}
          className="rounded-full bg-[var(--leaf)] px-5 py-2 text-sm font-medium text-white disabled:opacity-40">
          저장
        </button>
      </div>
    </div>
  );
}

function AiFields({ type, onDone }: { type: ApplicationType; onDone: () => void }) {
  const { addApplications } = useApplicationActions();
  const [note, setNote] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  // 정리 결과(편집 가능)
  const [reference, setReference] = useState('');
  const [insight, setInsight] = useState('');
  const [targetDays, setTargetDays] = useState(APPLICATION_DEFAULT_TARGET_DAYS);
  const [apps, setApps] = useState<string[] | null>(null);   // 적용점 후보(편집 가능)
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const parse = async () => {
    if (!note.trim() || parsing) return;
    setParsing(true);
    try {
      const res = await parseApplicationNote(note);
      if (res.applications.length === 0) {
        toast.error('정리할 적용점을 찾지 못했어요. 노트를 조금 더 자세히 적어보세요.');
        return;
      }
      setReference(res.reference);
      setInsight(res.insight);
      setTargetDays(res.targetDays || APPLICATION_DEFAULT_TARGET_DAYS);
      setApps(res.applications);
      setPicked(new Set(res.applications.map((_, i) => i)));  // 기본 전체 선택
    } catch (e: any) {
      toast.error('AI 정리 실패: ' + (e?.message ?? '알 수 없는 오류'));
    } finally {
      setParsing(false);
    }
  };

  const togglePick = (i: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const editApp = (i: number, v: string) =>
    setApps((prev) => (prev ? prev.map((a, idx) => (idx === i ? v : a)) : prev));

  const save = async () => {
    if (!apps || saving) return;
    const chosen = [...picked].sort((a, b) => a - b).map((i) => apps[i]).filter((a) => a.trim());
    if (chosen.length === 0) { toast.error('저장할 적용점을 하나 이상 선택하세요.'); return; }
    setSaving(true);
    try {
      await addApplications({ type, reference, insight, targetDays }, chosen);
      onDone();
    } catch {
      toast.error('저장 실패');
      setSaving(false);
    }
  };

  if (!apps) {
    return (
      <div className="space-y-2.5">
        <p className="text-xs text-[var(--fg-muted)]">
          큐티·설교에서 정리·요약한 노트를 그대로 붙여넣으면, AI가 본문·깨달은 말씀·다양한 적용점·실천 목표일로 정리해줘요.
        </p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={'예) 오늘 본문은 빌립보서 4장. 어떤 형편에든 자족하는 비결을 배웠다는 바울의 고백…'}
          rows={6} className={cn(FIELD_CLS, 'resize-none')} />
        <button onClick={parse} disabled={parsing || !note.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--leaf)] py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {parsing ? <><Loader2 size={15} className="animate-spin" /> 정리 중…</> : <><Wand2 size={15} /> AI로 정리하기</>}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <input value={reference} onChange={(e) => setReference(e.target.value)}
        placeholder="본문 · 선택" className={FIELD_CLS} />
      <input value={insight} onChange={(e) => setInsight(e.target.value)}
        placeholder="깨달은 말씀 · 선택" className={FIELD_CLS} />
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--fg-muted)]">적용점 — 실천할 것을 골라보세요 (여러 개 가능)</p>
        <div className="space-y-1.5">
          {apps.map((a, i) => (
            <div key={i}
              className={cn(
                'flex items-start gap-2 rounded-[var(--radius-sm)] border p-2',
                picked.has(i) ? 'border-[var(--leaf)] bg-[var(--leaf-soft)]/40' : 'border-[var(--border)] bg-white',
              )}>
              <input type="checkbox" checked={picked.has(i)} onChange={() => togglePick(i)}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--leaf)]" />
              <textarea value={a} onChange={(e) => editApp(i, e.target.value)} rows={2}
                className="min-w-0 flex-1 resize-none bg-transparent text-sm text-[var(--fg-primary)] outline-none" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <TargetDaysInput value={targetDays} onChange={setTargetDays} />
        <div className="flex gap-2">
          <button onClick={() => setApps(null)}
            className="rounded-full bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--fg-muted)]">다시</button>
          <button onClick={save} disabled={saving || picked.size === 0}
            className="flex items-center gap-1.5 rounded-full bg-[var(--leaf)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            {saving ? <Loader2 size={15} className="animate-spin" /> : `${picked.size}개 저장`}
          </button>
        </div>
      </div>
    </div>
  );
}

function TargetDaysInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
      실천 목표
      <input type="number" min={1} max={60} value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
        className="w-14 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1 text-xs tabular-nums outline-none focus:border-[var(--leaf)]" />
      일
    </label>
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
