import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1] as const;
const PAD = 8; // 타깃 주변 여백
const FIND_TIMEOUT = 1600; // 타깃 등장 대기(ms) — 라우트 전환 대비

export type Step = {
  target: string; // data-tour 셀렉터
  title: string;
  body: string;
  route?: string; // 이 단계 진입 시 이동할 경로
};

type Rect = { top: number; left: number; width: number; height: number };

// 타깃을 세로 스크롤 컨테이너(SwipeTabs 활성 패널) 안에서만 보이도록 스크롤한다.
// scrollIntoView 는 가로(overflow-hidden 트랙)까지 스크롤해 탭 정렬을 망가뜨리므로
// 절대 쓰지 않고, 활성 패널의 세로 스크롤만 직접 조정한다.
function scrollTargetIntoView(el: HTMLElement) {
  const scroller = el.closest('[data-active-panel]') as HTMLElement | null;
  if (!scroller) return; // 고정 요소(탭바 등)는 스크롤 불필요
  const er = el.getBoundingClientRect();
  const sr = scroller.getBoundingClientRect();
  const margin = 24;
  let delta = 0;
  if (er.top < sr.top + margin) delta = er.top - sr.top - margin;
  else if (er.bottom > sr.bottom - margin) delta = er.bottom - sr.bottom + margin;
  if (delta !== 0) scroller.scrollBy({ top: delta, behavior: 'smooth' });
}

export default function SpotlightTour({ steps, onDone }: { steps: Step[]; onDone: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const advanceRef = useRef<() => void>(() => {});

  const next = useCallback(() => {
    setRect(null);
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);
  const prev = useCallback(() => {
    setRect(null);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);
  advanceRef.current = isLast ? onDone : next;

  // 라우트 전환이 필요한 단계면 먼저 이동
  useEffect(() => {
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
    }
    // location.pathname 은 의존성에서 제외 — 단계 진입 시 한 번만 이동
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // 타깃 추적: 등장할 때까지 폴링 후 매 프레임 위치 갱신(스크롤·애니메이션에도 달라붙음)
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    let scrolled = false;
    const start = performance.now();

    const measure = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      setRect((prevR) => {
        const nextR = { top: r.top, left: r.left, width: r.width, height: r.height };
        if (
          prevR &&
          Math.abs(prevR.top - nextR.top) < 0.5 &&
          Math.abs(prevR.left - nextR.left) < 0.5 &&
          Math.abs(prevR.width - nextR.width) < 0.5 &&
          Math.abs(prevR.height - nextR.height) < 0.5
        ) {
          return prevR;
        }
        return nextR;
      });
    };

    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (el) {
        if (!scrolled) {
          scrolled = true;
          scrollTargetIntoView(el);
        }
        measure(el);
      } else if (performance.now() - start > FIND_TIMEOUT) {
        // 타깃을 못 찾으면 단계 건너뛰기(마지막이면 종료)
        cancelled = true;
        advanceRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [index, step.target]);

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  // 타깃이 화면 아래쪽이면 툴팁을 상단에, 위쪽이면 하단에 고정한다.
  // (타깃에 바짝 붙이면 모바일에서 카드가 화면 밖으로 밀려 버튼을 못 누름)
  const pinTop = rect ? rect.top + rect.height / 2 > vh * 0.5 : false;

  const hole = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label="습관 정원 사용법 안내"
    >
      {/* 어두운 배경 + 스포트라이트 컷아웃 (box-shadow 트릭) */}
      <AnimatePresence>
        {hole && (
          <motion.div
            key="hole"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute rounded-[14px]"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              boxShadow: '0 0 0 9999px rgba(20, 26, 18, 0.62)',
              outline: '2px solid rgba(255,255,255,0.85)',
              outlineOffset: '0px',
              transition: 'top .35s cubic-bezier(.22,1,.36,1), left .35s cubic-bezier(.22,1,.36,1), width .35s cubic-bezier(.22,1,.36,1), height .35s cubic-bezier(.22,1,.36,1)',
            }}
          />
        )}
        {!hole && (
          // 타깃 측정 전 전체 딤 처리
          <motion.div
            key="dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[rgba(20,26,18,0.62)]"
          />
        )}
      </AnimatePresence>

      {/* 탭 가로채기(밑 UI 클릭 방지) — 다크 영역 탭은 무시 */}
      <div className="absolute inset-0" />

      {/* 툴팁 카드 — 타깃 위치와 무관하게 항상 화면 안(상단/하단)에 고정해 버튼 접근을 보장.
          가로 중앙 정렬은 mx-auto 로 처리한다(framer 의 transform 이 translateX 를 덮어쓰는 문제 회피). */}
      <div
        className="pointer-events-none absolute inset-x-0 px-4"
        style={
          pinTop
            ? { top: 'calc(env(safe-area-inset-top) + 16px)' }
            : { bottom: 'calc(env(safe-area-inset-bottom) + 16px)' }
        }
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: pinTop ? -12 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="pointer-events-auto mx-auto w-full max-w-[340px]"
          >
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] uppercase tracking-[0.28em] text-[var(--fg-faint)]">
                STEP {index + 1} / {steps.length}
              </p>
              <button
                onClick={onDone}
                className="text-[12px] font-medium text-[var(--fg-faint)] active:opacity-60"
              >
                건너뛰기
              </button>
            </div>

            <h3 className="mt-2 text-[16px] font-semibold tracking-tight text-[var(--fg-primary)]">
              {step.title}
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--fg-muted)]">
              {step.body}
            </p>

            {/* 진행 도트 + 컨트롤 */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={`block h-1.5 rounded-full transition-all duration-300 ${
                      i === index ? 'w-5 bg-[var(--leaf)]' : 'w-1.5 bg-[var(--border)]'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {index > 0 && (
                  <button
                    onClick={prev}
                    aria-label="이전"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg-muted)] active:scale-95"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                <button
                  onClick={isLast ? onDone : next}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--leaf)] px-4 text-[14px] font-semibold text-white active:scale-95"
                >
                  {isLast ? (
                    <>
                      시작하기 <Sparkles size={15} />
                    </>
                  ) : (
                    <>
                      다음 <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
