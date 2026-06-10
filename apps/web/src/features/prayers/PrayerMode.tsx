import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ChevronRight, BookOpen } from 'lucide-react';
import type { PrayerDoc } from 'shared/types/firestore';
import { pickDailyVerse } from 'shared/prayerVerses';
import { usePrayerActions } from './usePrayers';
import { cn } from '@/lib/utils';

/**
 * 기도 모드 — 기도실에서도 쓸 수 있는 전체화면 다크 세션.
 * setup(시간 선택) → meditate(말씀 묵상) → pray(카드 넘기기) → done(요약)
 * 다크 팔레트는 이 오버레이 안에서만 사용한다(전역 테마 없음).
 */

type Step = 'setup' | 'meditate' | 'pray' | 'done';

const DURATIONS: { label: string; min: number | null }[] = [
  { label: '5분', min: 5 },
  { label: '10분', min: 10 },
  { label: '15분', min: 15 },
  { label: '자유', min: null },
];

const DARK = {
  bg: 'bg-[#10141A]',
  card: 'bg-[#1B222C]',
  border: 'border-[#2A323E]',
  fg: 'text-[#E7E5DF]',
  muted: 'text-[#9AA0A6]',
  accent: '#8FBF6F',
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
  open, onClose, prayers, checks, date,
}: {
  open: boolean;
  onClose: () => void;
  prayers: PrayerDoc[];                       // 오늘 목록 (고정→로테이션→더받음 순)
  checks: Record<string, { prayerId: string }>;
  date: string;
}) {
  const { checkPrayer } = usePrayerActions();
  const [step, setStep] = useState<Step>('setup');
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
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
  const byId = useMemo(() => new Map(prayers.map((p) => [p.id, p] as const)), [prayers]);
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn('fixed inset-0 z-[120] flex flex-col', DARK.bg, DARK.fg)}
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {/* 상단 바 */}
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={onClose} aria-label="닫기" className={cn('p-1.5', DARK.muted)}>
              <X size={20} />
            </button>
            {step === 'pray' && (
              <span className={cn('text-xs tabular-nums', DARK.muted)}>
                {index + 1} / {ordered.length}
                {timeLeft !== null && !timeUp && ` · ${fmtClock(timeLeft)}`}
                {endsAt === null && startedAt > 0 && ` · ${fmtClock(elapsed)}`}
              </span>
            )}
          </div>

          <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-6 pb-6">
            {/* 시간 선택 */}
            {step === 'setup' && (
              <div className="flex flex-1 flex-col items-center justify-center gap-8">
                <div className="text-center">
                  <p className="text-lg font-medium">기도 시간</p>
                  <p className={cn('mt-1 text-sm', DARK.muted)}>얼마나 머무를까요?</p>
                </div>
                <div className="grid w-full grid-cols-2 gap-3">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.label}
                      onClick={() => { setDurationMin(d.min); setStep('meditate'); }}
                      className={cn(
                        'rounded-[var(--radius-lg)] border py-5 text-base font-medium transition-colors',
                        DARK.card, DARK.border, 'active:border-[#8FBF6F]'
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 말씀 묵상 — 마음 가다듬기 */}
            {step === 'meditate' && (
              <button
                onClick={beginPray}
                className="flex flex-1 flex-col items-center justify-center gap-10 text-center"
              >
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.2 }}
                  className="space-y-6"
                >
                  <p className="text-xl leading-relaxed [text-wrap:balance]">{verse.text}</p>
                  <p className={cn('text-sm', DARK.muted)}>— {verse.reference}</p>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.7, 0.4, 0.7] }}
                  transition={{ delay: 2.5, duration: 4, repeat: Infinity }}
                  className={cn('text-xs', DARK.muted)}
                >
                  잠잠히 묵상한 뒤, 화면을 누르면 시작합니다
                </motion.p>
              </button>
            )}

            {/* 카드 기도 */}
            {step === 'pray' && current && (
              <div className="flex flex-1 flex-col">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-1 flex-col justify-center"
                  >
                    <div className={cn('max-h-[70vh] overflow-y-auto rounded-[var(--radius-lg)] border p-6', DARK.card, DARK.border)}>
                      <p className={cn('text-xs', DARK.muted)}>
                        {current.target || '나 자신'} · {current.group || '개인'}
                        {checks[current.id] && ' · 오늘 기도함 ✓'}
                      </p>
                      <h2 className="mt-2 text-xl font-medium leading-snug [text-wrap:balance]">{current.title}</h2>
                      {current.body && (
                        <p className={cn('mt-4 whitespace-pre-wrap text-sm leading-relaxed', DARK.muted)}>{current.body}</p>
                      )}
                      {current.verse && (
                        <div className={cn('mt-5 rounded-[var(--radius)] border p-3', DARK.border)}>
                          <p className="flex items-start gap-1.5 text-sm leading-relaxed">
                            <BookOpen size={14} className="mt-0.5 shrink-0" style={{ color: DARK.accent }} />
                            <span>{current.verse.text}</span>
                          </p>
                          <p className={cn('mt-1.5 pl-5 text-xs', DARK.muted)}>— {current.verse.reference}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {timeUp && (
                  <p className={cn('pb-3 text-center text-xs', DARK.muted)}>
                    시간이 다 됐어요 — 천천히 마무리하세요
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={advance}
                    className={cn('flex items-center justify-center gap-1 rounded-[var(--radius)] border px-4 py-3.5 text-sm', DARK.border, DARK.muted)}
                  >
                    건너뛰기 <ChevronRight size={15} />
                  </button>
                  <button
                    onClick={prayAndAdvance}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius)] py-3.5 text-sm font-medium text-[#10141A]"
                    style={{ backgroundColor: DARK.accent }}
                  >
                    <Check size={16} /> 기도했어요
                  </button>
                </div>
              </div>
            )}

            {/* 빈 목록 방어 */}
            {step === 'pray' && !current && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                <p className={cn('text-sm', DARK.muted)}>오늘 기도할 목록이 없습니다.</p>
                <button onClick={onClose} className={cn('rounded-[var(--radius)] border px-5 py-2.5 text-sm', DARK.border)}>
                  돌아가기
                </button>
              </div>
            )}

            {/* 마침 */}
            {step === 'done' && (
              <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-3"
                >
                  <p className="text-4xl">🙏</p>
                  <p className="text-lg font-medium">기도를 마쳤습니다</p>
                  <p className={cn('text-sm', DARK.muted)}>
                    {checkedInSession.size > 0 && `${checkedInSession.size}개 기도 · `}
                    {fmtClock(elapsed)} 머물렀어요
                  </p>
                </motion.div>
                <button
                  onClick={onClose}
                  className="rounded-[var(--radius)] px-8 py-3 text-sm font-medium text-[#10141A]"
                  style={{ backgroundColor: DARK.accent }}
                >
                  마치기
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
