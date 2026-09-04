import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronDown,
  CheckSquare,
  Sparkles,
  Flame,
  Lightbulb,
  Layers,
  Shield,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';

type Tone = 'leaf' | 'bloom' | 'sky' | 'soil';
const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  leaf:  { bg: 'bg-[var(--leaf-soft)]',  fg: 'text-[var(--leaf)]' },
  bloom: { bg: 'bg-[var(--bloom-soft)]', fg: 'text-[var(--bloom)]' },
  sky:   { bg: 'bg-[var(--sky-soft)]',   fg: 'text-[var(--sky)]' },
  soil:  { bg: 'bg-[#EFE4D2]',           fg: 'text-[var(--soil)]' },
};

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Tutorial() {
  const navigate = useNavigate();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="min-h-screen p-4 pb-8 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 py-1">
        <button
          onClick={() => navigate(-1)}
          className="text-[var(--fg-muted)]"
          aria-label="뒤로 가기"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">사용 설명서</h2>
      </div>

      {/* Intro */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0, ease: EASE }}
      >
        <SectionLabel>Welcome</SectionLabel>
        <h3 className="mt-1.5 text-[18px] font-semibold tracking-tight text-[var(--fg-primary)]">
          환영합니다
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">
          습관 정원의 하루 흐름을 3단계로 안내해드립니다. 각 단계의 “자세히 보기”를 펼치면
          더 깊은 설명과 예시까지 확인할 수 있어요.
        </p>
      </motion.section>

      {/* Steps */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
      >
        <StepCard
          step="STEP 01"
          icon={<CheckSquare size={16} />}
          tone="leaf"
          title="매일 습관을 0~5점으로 기록해요"
          desc="하루의 시간대(아침·점심·저녁·밤·언제든)별로 습관을 모아두고, 각 습관에 0~5점을 매깁니다."
          bullets={[
            "‘달성’ 기준 점수 이상이면 카운트(보통 3점)",
            '0점은 미체크, 5점은 완벽 수행',
            '오늘 하기 어려운 습관은 ‘건너뛰기’로 중립 처리',
          ]}
          details={
            <div className="space-y-3 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
              <DetailBlock title="점수의 의미">
                <ul className="ml-3 space-y-0.5">
                  <li>· 0점 — 아직 체크 안 함 (미수행으로 간주)</li>
                  <li>· 1~2점 — 일부 수행</li>
                  <li>· 3점 — 기본 달성 (대부분 습관의 ‘달성’ 기준)</li>
                  <li>· 4점 — 잘 수행</li>
                  <li>· 5점 — 완벽 수행</li>
                </ul>
                <p className="mt-2">
                  ‘예/아니오’ 형식의 이진형 습관은 1점만으로도 달성으로 계산돼요.
                </p>
              </DetailBlock>
              <DetailBlock title="시간대 경계 (KST)">
                <ul className="ml-3 space-y-0.5">
                  <li>· 아침 04:00 ~ 11:00</li>
                  <li>· 점심 11:00 ~ 17:00</li>
                  <li>· 저녁 17:00 ~ 22:00</li>
                  <li>· 밤 22:00 ~ 04:00</li>
                  <li>· 언제든 — 시간대 무관 습관</li>
                </ul>
              </DetailBlock>
            </div>
          }
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.16, ease: EASE }}
      >
        <StepCard
          step="STEP 02"
          icon={<Sparkles size={16} />}
          tone="sky"
          title="하루를 한 줄로 마무리해요"
          desc="저녁에 짧은 회고를 남기면 AI 코치가 오늘의 패턴을 짧게 짚어줍니다."
          bullets={[
            '‘내일의 다짐’은 다음날 아침 실천 카드로 이어져요',
            '컨디션(수면·기력·기분) 기록도 코치 분석에 활용',
          ]}
          details={
            <div className="space-y-3 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
              <DetailBlock title="AI 코치 3종">
                <ul className="ml-3 space-y-0.5">
                  <li>· 일일 코치 — 하루 패턴을 자동으로 한 줄 코칭</li>
                  <li>· 주간 코치 — 강점·패턴·추천을 카드 펼치면 분석</li>
                  <li>· 위기 알림 — 저녁 8시까지 핵심 습관 미체크면 격려 한 줄</li>
                </ul>
              </DetailBlock>
              <DetailBlock title="회고 작성 위치">
                메인 화면 또는 진척 화면의 회고 카드에서 작성할 수 있어요. 한 줄도 OK.
              </DetailBlock>
              <DetailBlock title="컨디션 기록">
                수면 점수(0~100) · 기력(0~100) · 기분(1~10)을 저장해두면 코치가 패턴을 더
                정확하게 짚어줍니다.
              </DetailBlock>
            </div>
          }
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.24, ease: EASE }}
      >
        <StepCard
          step="STEP 03"
          icon={<Flame size={16} />}
          tone="bloom"
          title="꾸준함을 한눈에 확인해요"
          desc="연속 달성일(스트릭), 히트맵, 주간/월간 통계로 성장 흐름을 추적합니다."
          bullets={[
            '스트릭 🔥 — 기록한 습관의 60% 이상을 달성한 ‘성공한 날’이 이어지면 누적',
            '히트맵 — 최근 활동 시각화',
          ]}
          details={
            <div className="space-y-3 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
              <DetailBlock title="진척 화면에서 볼 수 있는 것">
                <ul className="ml-3 space-y-0.5">
                  <li>· 스트릭 카운터 — 현재/최고 연속 성공일</li>
                  <li>· 히트맵 — 일자별 달성 강도</li>
                  <li>· 주간 / 월간 리포트</li>
                  <li>· 일년 전 오늘 비교 카드</li>
                </ul>
              </DetailBlock>
              <DetailBlock title="스트릭 계산 방식">
                기록한 습관 중 60% 이상을 달성하면 그날은 ‘성공한 날’로 스트릭이 이어져요.
                ‘건너뛰기’로 표시한 습관은 계산에서 제외되니, 하기 어려운 날은 건너뛰기를
                활용해 부담을 줄여보세요.
              </DetailBlock>
            </div>
          }
        />
      </motion.div>

      {/* 고급 기능 섹션 */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.32, ease: EASE }}
        className="pt-2"
      >
        <SectionLabel>Advanced</SectionLabel>
        <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight text-[var(--fg-primary)]">
          고급 기능
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
          기본 흐름이 익숙해지면 펼쳐서 살펴보세요. 모르고 써도 큰 문제는 없지만,
          알면 더 편하게 쓸 수 있습니다.
        </p>

        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          className="mt-3 flex w-full items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 px-4 py-3 text-left shadow-[var(--shadow-sm)] backdrop-blur-sm active:opacity-70"
          aria-expanded={advancedOpen}
        >
          <span className="text-[13px] font-medium text-[var(--fg-primary)]">
            고급 기능 4가지 {advancedOpen ? '접기' : '펼쳐보기'}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-[var(--fg-faint)] transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence initial={false}>
          {advancedOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2">
          <AdvancedItem
            icon={<AlertTriangle size={16} />}
            tone="bloom"
            title="위기 알림"
            summary="저녁 8시까지 핵심 습관 미체크 시 한 번 격려"
          >
            가중치 8 이상인 핵심 습관이 저녁 8시(KST)까지 체크되지 않으면 “지금이라도
            1개만 체크해보면 어떨까요?” 라는 짧은 알림이 그 날 한 번 표시됩니다.
          </AdvancedItem>

          <AdvancedItem
            icon={<ClipboardList size={16} />}
            tone="soil"
            title="컨디션 / 플래너"
            summary="점수와는 별개의 보조 도구"
          >
            <ul className="ml-3 space-y-0.5">
              <li>· 컨디션 — 수면(0~100)·기력(0~100)·기분(1~10) 기록. 코치가 참고</li>
              <li>· 플래너 — 점수가 없는 단순 to-do. 습관과 별개로 빠른 할 일 정리용</li>
            </ul>
          </AdvancedItem>

          <AdvancedItem
            icon={<Shield size={16} />}
            tone="sky"
            title="신앙 기능 (선택)"
            summary="더보기 → 신앙 기능 ON 시 활성화"
          >
            경건·기도제목 메뉴가 추가됩니다. 기본은 OFF이고 언제든 끌 수 있어요.
          </AdvancedItem>

          <AdvancedItem
            icon={<Layers size={16} />}
            tone="leaf"
            title="피드백 설정"
            summary="푸시·햅틱·사운드 더보기 탭에서 토글"
          >
            푸시 알림(FCM)·체크 시 진동·짧은 효과음을 각각 켜고 끌 수 있어요.
            모바일에서 가장 좋은 경험을 위해 햅틱은 켜두는 걸 권장합니다.
          </AdvancedItem>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Pro Tip */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.4, ease: EASE }}
        className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 p-4 shadow-[var(--shadow-sm)] backdrop-blur-sm"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--leaf-soft)] text-[var(--leaf)]">
            <Lightbulb size={16} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[10.5px] uppercase tracking-[0.28em] text-[var(--fg-faint)]">
              Pro Tip
            </p>
            <p className="text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
              처음에는 습관 2~3개로 작게 시작해보세요. 매일 체크하는 습관 자체가 가장 중요한
              첫 단계입니다. 고급 기능은 익숙해진 뒤 천천히 펼쳐 봐도 늦지 않아요.
            </p>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] uppercase tracking-[0.28em] text-[var(--fg-faint)]">{children}</p>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-[var(--fg-faint)]">
        {title}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function StepCard({
  step, icon, tone, title, desc, bullets, details,
}: {
  step: string;
  icon: React.ReactNode;
  tone: Tone;
  title: string;
  desc: string;
  bullets?: string[];
  details?: React.ReactNode;
}) {
  const t = toneStyles[tone];
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 p-4 shadow-[var(--shadow-sm)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.bg} ${t.fg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[10.5px] uppercase tracking-[0.28em] text-[var(--fg-faint)]">{step}</p>
          <p className="text-[13.5px] font-medium text-[var(--fg-primary)]">{title}</p>
          <p className="text-[12.5px] leading-relaxed text-[var(--fg-muted)]">{desc}</p>
        </div>
      </div>

      {bullets && bullets.length > 0 && (
        <ul className="mt-3 ml-12 space-y-1">
          {bullets.map((b, i) => (
            <li
              key={i}
              className="text-[12px] leading-relaxed text-[var(--fg-muted)] before:mr-1 before:text-[var(--leaf)] before:content-['·']"
            >
              {b}
            </li>
          ))}
        </ul>
      )}

      {details && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-3 ml-12 flex items-center gap-1 text-[11.5px] font-medium text-[var(--leaf)] active:opacity-70"
            aria-expanded={open}
          >
            <span>{open ? '접기' : '자세히 보기'}</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="mt-3 ml-12 border-t border-[var(--border-soft)] pt-3">
                  {details}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function AdvancedItem({
  icon, tone, title, summary, children,
}: {
  icon: React.ReactNode;
  tone: Tone;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const t = toneStyles[tone];
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 shadow-[var(--shadow-sm)] backdrop-blur-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3.5 text-left active:opacity-70"
        aria-expanded={open}
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.bg} ${t.fg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[var(--fg-primary)]">{title}</p>
          <p className="text-[11.5px] leading-relaxed text-[var(--fg-muted)]">{summary}</p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[var(--fg-faint)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border-soft)] px-4 py-3 text-[12px] leading-relaxed text-[var(--fg-muted)]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
