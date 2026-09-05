import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ChevronRight, ChevronLeft, Plus, BookOpen } from 'lucide-react';
import type { PrayerDoc } from 'shared/types/firestore';
import { pickDailyVerse } from 'shared/prayerVerses';
import { usePrayerActions } from './usePrayers';
import { cn } from '@/lib/utils';

/**
 * 기도 모드 — 기도실에서도 쓸 수 있는 집중 세션.
 * setup(시간 선택) → meditate(말씀 묵상) → pray(카드 넘기기) → done(요약)
 * 밝은 앱 화면과 분리된 차분한 다크 테마로 집중감을 만든다.
 */

type Step = 'setup' | 'meditate' | 'pray' | 'done';

const DURATIONS: { label: string; min: number | null }[] = [
  { label: '5분', min: 5 },
  { label: '10분', min: 10 },
  { label: '15분', min: 15 },
  { label: '자유', min: null },
];

const DARK = {
  bg: 'bg-[#11100E]',
  card: 'bg-[#1A1916]',
  border: 'border-white/[0.11]',
  fg: 'text-[#F4F2ED]',
  muted: 'text-[#AAA49B]',
  faint: 'text-[#777168]',
  accent: '#CDB58F',
};

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 화면 꺼짐 방지 — 미지원 브라우저에서는 조용히 무시 */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await (navigator as any).wakeLock.request('screen');
        if (cancelled && lock) await lock.release();
      } catch { /* 저전력 모드 등 — 무시 */ }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

export default function PrayerMode({
  open, onClose, prayers, checks, date, onLoadMore, hasMore,
}: {
  open: boolean;
  onClose: () => void;
  prayers: PrayerDoc[];                       // 오늘 목록 (고정→로테이션→더받음 순)
  checks: Record<string, { prayerId: string }>;
  date: string;
  onLoadMore?: () => PrayerDoc[];             // '기도제목 더 받기' — 새로 받은 기도제목 반환
  hasMore?: boolean;                          // 더 받을 후보가 남아 있는지
}) {
  const { checkPrayer } = usePrayerActions();
  const [step, setStep] = useState<Step>('setup');
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [extraPrayers, setExtraPrayers] = useState<PrayerDoc[]>([]); // 세션 중 더 받은 기도제목
  const [index, setIndex] = useState(0);
  const [checkedInSession, setCheckedInSession] = useState<Set<string>>(new Set());
  const [startedAt, setStartedAt] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const finishedAtRef = useRef(0);

  // 열릴 때 세션 순서를 고정 — 미체크 우선, 체크됨 뒤 (진행 중 체크로 순서가 흔들리지 않게)
  useEffect(() => {
    if (!open) return;
    const unchecked = prayers.filter((p) => !checks[p.id]).map((p) => p.id);
    const done = prayers.filter((p) => !!checks[p.id]).map((p) => p.id);
    setSessionIds([...unchecked, ...done]);
    setExtraPrayers([]);
    setStep('setup');
    setIndex(0);
    setCheckedInSession(new Set());
    setDurationMin(null);
    setEndsAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 열려 있는 동안 body 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useWakeLock(open && (step === 'meditate' || step === 'pray'));

  // 1초 시계 — 절대시각 기준이라 백그라운드 스로틀에도 안전
  useEffect(() => {
    if (!open || step !== 'pray') return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [open, step]);

  const verse = useMemo(() => pickDailyVerse(date), [date]);
  const byId = useMemo(
    () => new Map([...prayers, ...extraPrayers].map((p) => [p.id, p] as const)),
    [prayers, extraPrayers],
  );
  const ordered = sessionIds.map((id) => byId.get(id)).filter(Boolean) as PrayerDoc[];
  const current = ordered[index];

  const timeLeft = endsAt !== null ? endsAt - now : null;
  const timeUp = timeLeft !== null && timeLeft <= 0;
  const elapsed = startedAt ? (step === 'done' ? finishedAtRef.current : now) - startedAt : 0;

  const beginPray = () => {
    const t = Date.now();
    setStartedAt(t);
    setEndsAt(durationMin !== null ? t + durationMin * 60_000 : null);
    setNow(t);
    setStep('pray');
  };

  const advance = () => {
    if (index + 1 >= ordered.length) {
      finishedAtRef.current = Date.now();
      setStep('done');
    } else {
      setIndex(index + 1);
    }
  };

  const prayAndAdvance = async () => {
    if (current && !checks[current.id]) {
      setCheckedInSession((prev) => new Set(prev).add(current.id));
      void checkPrayer(current, { silent: true });
    }
    advance();
  };

  // 이전 기도제목으로 — 첫 카드에서는 막는다
  const goBack = () => setIndex((i) => Math.max(0, i - 1));

  // '기도제목 더 받기' — 더 받은 항목을 세션 순서 끝에 이어 붙인다.
  // jump=true 면(요약 화면에서) 새 카드로 곧장 이동해 기도를 이어간다.
  const loadMoreInto = (jump: boolean) => {
    const added = onLoadMore?.() ?? [];
    if (added.length === 0) return;
    setExtraPrayers((prev) => {
      const have = new Set(prev.map((p) => p.id));
      return [...prev, ...added.filter((p) => !have.has(p.id))];
    });
    setSessionIds((prev) => {
      const have = new Set(prev);
      return [...prev, ...added.map((p) => p.id).filter((id) => !have.has(id))];
    });
    if (jump) {
      setIndex(ordered.length); // 기존 카드 뒤 — 새로 받은 첫 카드
      setStep('pray');
    }
  };

  // SwipeTabs 트랙의 translateX transform이 fixed의 기준이 되는 것을 피하기 위해
  // body 포털로 띄운다 — 탭 패널 안에서 fixed를 쓰면 오버레이가 트랙 기준으로 밀려 깨진다.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#090806] sm:p-5"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="기도 모드"
            className={cn(
              'relative flex h-full w-full max-w-[430px] flex-col overflow-hidden sm:rounded-[36px] sm:border sm:shadow-[0_28px_80px_rgba(0,0,0,0.48)]',
              DARK.bg,
              DARK.border,
              DARK.fg,
            )}
            style={{
              colorScheme: 'dark',
              '--leaf': DARK.accent,
              '--leaf-soft': '#2A241C',
              '--fg-primary': '#F4F2ED',
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            } as CSSProperties}
          >
            {/* 상단 바 */}
            <div className="shrink-0 px-5 pt-4">
              <div className="flex min-h-[44px] items-center justify-between">
                <button
                  onClick={onClose}
                  aria-label="기도 모드 닫기"
                  className={cn('flex h-[44px] w-[44px] items-center justify-center rounded-full border transition-colors hover:bg-white/[0.04]', DARK.border, DARK.muted)}
                >
                  <X size={18} />
                </button>
                <span className={cn('text-[10px] font-medium uppercase tracking-[0.24em]', DARK.faint)}>
                  Prayer session
                </span>
                {step === 'pray' ? (
                  <span className={cn('flex h-[44px] min-w-[44px] items-center justify-end text-[11px] tabular-nums', DARK.muted)} aria-live="polite">
                    {timeLeft !== null && !timeUp && fmtClock(timeLeft)}
                    {endsAt === null && startedAt > 0 && fmtClock(elapsed)}
                    {timeUp && '마무리'}
                  </span>
                ) : (
                  <span className="h-[44px] w-[44px]" aria-hidden="true" />
                )}
              </div>

              {step === 'pray' && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-px flex-1 overflow-hidden bg-white/[0.09]">
                    <motion.div
                      className="h-full"
                      style={{ backgroundColor: DARK.accent }}
                      animate={{ width: `${((index + 1) / Math.max(ordered.length, 1)) * 100}%` }}
                    />
                  </div>
                  <span className={cn('text-[10px] tabular-nums', DARK.faint)}>{index + 1} / {ordered.length}</span>
                </div>
              )}
            </div>

            <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col px-6 pb-5">
              {/* 시간 선택 */}
              {step === 'setup' && (
                <div className="flex flex-1 flex-col justify-center py-8">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em]" style={{ color: DARK.accent }}>기도 시작</p>
                    <h1 className="mt-4 text-[30px] font-medium leading-[1.25] tracking-[-0.035em] [text-wrap:balance]">
                      조용히 머무를<br />시간을 정해요
                    </h1>
                    <p className={cn('mt-3 text-sm leading-relaxed', DARK.muted)}>
                      오늘의 기도 {ordered.length}개를 천천히 돌아봅니다.
                    </p>
                  </div>

                  <div className="mt-12 grid grid-cols-2 gap-3">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.label}
                        onClick={() => { setDurationMin(d.min); setStep('meditate'); }}
                        className={cn(
                          'group flex min-h-[82px] flex-col items-start justify-between rounded-[20px] border p-4 text-left transition-colors hover:bg-white/[0.055] active:scale-[0.99]',
                          DARK.card,
                          DARK.border,
                        )}
                      >
                        <span className={cn('text-[10px] uppercase tracking-[0.16em]', DARK.faint)}>
                          {d.min === null ? 'Open' : 'Timer'}
                        </span>
                        <span className="text-lg font-medium tracking-[-0.02em]">{d.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 말씀 묵상 — 마음 가다듬기 */}
              {step === 'meditate' && (
                <div className="flex min-h-0 flex-1 flex-col py-5 text-center">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2 }}
                    className="flex flex-1 flex-col items-center justify-center"
                  >
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-full border', DARK.border)}>
                      <BookOpen size={15} style={{ color: DARK.accent }} />
                    </div>
                    <p className="mt-8 text-[22px] leading-[1.7] tracking-[-0.025em] [text-wrap:balance]">{verse.text}</p>
                    <p className={cn('mt-5 text-xs', DARK.muted)}>— {verse.reference}</p>
                  </motion.div>

                  <div className="shrink-0 pt-5">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.75, 0.45, 0.75] }}
                      transition={{ delay: 1.8, duration: 4, repeat: Infinity }}
                      className={cn('mb-4 text-[11px]', DARK.faint)}
                    >
                      잠시 숨을 고르고 마음을 가다듬어 보세요
                    </motion.p>
                    <button
                      onClick={beginPray}
                      className="flex min-h-14 w-full items-center justify-center rounded-[18px] text-sm font-semibold text-[#17130D] transition-transform active:scale-[0.99]"
                      style={{ backgroundColor: DARK.accent }}
                    >
                      기도 시작
                    </button>
                  </div>
                </div>
              )}

              {/* 카드 기도 */}
              {step === 'pray' && current && (
                <div className="flex min-h-0 flex-1 flex-col">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={current.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.22 }}
                      className="flex min-h-0 flex-1 py-4"
                    >
                      <article className={cn('flex h-full min-h-0 w-full flex-col overflow-y-auto rounded-[24px] border p-6', DARK.card, DARK.border)}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={cn('text-[10px] font-medium uppercase tracking-[0.17em]', DARK.faint)}>{current.group || '개인'}</span>
                          <span className="h-0.5 w-0.5 rounded-full bg-white/25" aria-hidden="true" />
                          <span className={cn('text-[11px]', DARK.muted)}>{current.target || '나 자신'}</span>
                          {checks[current.id] && (
                            <span className="ml-auto text-[10px]" style={{ color: DARK.accent }}>오늘 기도함</span>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col justify-center py-8">
                          <h2 className="text-[27px] font-medium leading-[1.38] tracking-[-0.035em] [text-wrap:balance]">{current.title}</h2>
                          {current.body && (
                            <p className={cn('mt-5 whitespace-pre-wrap text-[14px] leading-[1.75]', DARK.muted)}>{current.body}</p>
                          )}
                        </div>

                        {current.verse && (
                          <aside className="mt-auto border-t border-white/[0.09] pt-4">
                            <div className="flex items-start gap-2.5">
                              <BookOpen size={12} className="mt-0.5 shrink-0" style={{ color: DARK.accent }} />
                              <div className="min-w-0">
                                <p className={cn('text-[11px] leading-[1.65]', DARK.muted)}>{current.verse.text}</p>
                                <p className={cn('mt-1 text-[10px]', DARK.faint)}>— {current.verse.reference}</p>
                              </div>
                            </div>
                          </aside>
                        )}
                      </article>
                    </motion.div>
                  </AnimatePresence>

                  <div className="shrink-0 border-t border-white/[0.08] pt-3">
                    {timeUp && (
                      <p className="pb-2 text-center text-[10px]" style={{ color: DARK.accent }}>
                        시간이 다 됐어요 · 천천히 마무리하세요
                      </p>
                    )}

                    <div className="flex min-h-[44px] items-center justify-between gap-2">
                      <button
                        onClick={goBack}
                        disabled={index === 0}
                        aria-label="이전 기도제목"
                        className={cn('flex min-h-[44px] items-center gap-1 px-1 text-xs transition-colors disabled:opacity-25', DARK.muted)}
                      >
                        <ChevronLeft size={14} /> 이전
                      </button>
                      {hasMore && (
                        <button
                          onClick={() => loadMoreInto(false)}
                          className={cn('flex min-h-[44px] items-center gap-1 rounded-full border px-3 text-[11px] transition-colors hover:bg-white/[0.04]', DARK.border, DARK.muted)}
                        >
                          <Plus size={12} /> 더 받기
                        </button>
                      )}
                      <button
                        onClick={advance}
                        className={cn('flex min-h-[44px] items-center gap-1 px-1 text-xs transition-colors', DARK.muted)}
                      >
                        건너뛰기 <ChevronRight size={14} />
                      </button>
                    </div>

                    <button
                      onClick={prayAndAdvance}
                      className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] text-sm font-semibold text-[#17130D] transition-transform active:scale-[0.99]"
                      style={{ backgroundColor: DARK.accent }}
                    >
                      <Check size={16} strokeWidth={2.25} /> 기도했어요
                    </button>
                  </div>
                </div>
              )}

              {/* 빈 목록 방어 */}
              {step === 'pray' && !current && (
                <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
                  <div className={cn('flex h-12 w-12 items-center justify-center rounded-full border', DARK.border)}>
                    <Check size={18} style={{ color: DARK.accent }} />
                  </div>
                  <div>
                    <p className="text-base font-medium">오늘 기도할 목록이 없습니다</p>
                    <p className={cn('mt-1 text-xs', DARK.muted)}>기도제목을 추가한 뒤 다시 시작해 주세요.</p>
                  </div>
                  <button
                    onClick={onClose}
                    className={cn('min-h-12 rounded-[16px] border px-6 text-sm', DARK.border, DARK.muted)}
                  >
                    돌아가기
                  </button>
                </div>
              )}

              {/* 마침 */}
              {step === 'done' && (
                <div className="flex flex-1 flex-col justify-center py-8 text-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: DARK.accent }}>
                      <Check size={22} className="text-[#17130D]" strokeWidth={2.25} />
                    </div>
                    <p className="mt-7 text-[25px] font-medium tracking-[-0.03em]">기도를 마쳤습니다</p>
                    <p className={cn('mt-2 text-sm', DARK.muted)}>
                      {checkedInSession.size > 0 && `${checkedInSession.size}개 기도 · `}
                      {fmtClock(elapsed)} 머물렀어요
                    </p>
                  </motion.div>

                  <div className="mt-12 w-full space-y-3">
                    {hasMore && (
                      <button
                        onClick={() => loadMoreInto(true)}
                        className={cn('flex min-h-12 w-full items-center justify-center gap-1.5 rounded-[16px] border text-sm', DARK.border, DARK.muted)}
                      >
                        <Plus size={14} /> 기도제목 더 받기
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="flex min-h-14 w-full items-center justify-center rounded-[18px] text-sm font-semibold text-[#17130D]"
                      style={{ backgroundColor: DARK.accent }}
                    >
                      마치기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
