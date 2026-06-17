import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronDown,
  CheckSquare,
  Coins,
  Flower2,
  Sparkles,
  Flame,
  Lightbulb,
  Layers,
  Heart,
  Shield,
  AlertTriangle,
  Trophy,
  Snowflake,
  Target,
  Sun,
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
          습관 정원의 하루 흐름을 5단계로 안내해드립니다. 각 단계의 “자세히 보기”를 펼치면
          더 깊은 메커니즘과 예시까지 확인할 수 있어요.
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
          ]}
          details={
            <div className="space-y-3 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
              <DetailBlock title="점수의 의미">
                <ul className="ml-3 space-y-0.5">
                  <li>· 0점 — 아직 체크 안 함 (미수행으로 간주)</li>
                  <li>· 1~2점 — 일부 수행</li>
                  <li>· 3점 — 기본 달성 (대부분 습관의 ‘달성’ 기준)</li>
                  <li>· 4점 — 잘 수행</li>
                  <li>· 5점 — 완벽 수행 (보너스 포인트 추가)</li>
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
              <DetailBlock title="콤보 보너스">
                30초 안에 연달아 체크하면 콤보가 쌓이고, 콤보 3 이상부터 추가 포인트가 붙어요.
                빠르게 여러 습관을 정리할 때 유리합니다.
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
          icon={<Coins size={16} />}
          tone="bloom"
          title="달성하면 포인트가 쌓여요"
          desc="습관마다 난이도 가중치(weight)가 있어, 어려운 습관일수록 더 많은 포인트를 줍니다."
          bullets={[
            '오늘 점수가 메인 화면 상단에 표시돼요',
            '포인트는 정원·프리즈 토큰 등에 사용 가능',
          ]}
          details={
            <div className="space-y-3 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
              <DetailBlock title="점수별 포인트 계산 (가중치 기준)">
                <ul className="ml-3 space-y-0.5">
                  <li>· 1점 → 가중치 × 0.4</li>
                  <li>· 2점 → 가중치 × 0.8</li>
                  <li>· 3점 → 가중치 × 1.5 (달성)</li>
                  <li>· 4점 → 가중치 × 2.0</li>
                  <li>· 5점 → 가중치 × 2.0 + 5 (완벽 보너스)</li>
                </ul>
                <p className="mt-2">
                  예) 가중치 4인 습관에 4점이면 4 × 2.0 = 8포인트.
                </p>
              </DetailBlock>
              <DetailBlock title="이진형 습관">
                예/아니오 형식은 1점일 때 가중치 × 2 만큼 포인트를 받습니다.
              </DetailBlock>
              <DetailBlock title="콤보 보너스">
                30초 이내 연속 체크 시 콤보가 누적되고, 콤보 3 이상부터 추가 포인트가 붙어요.
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
          icon={<Flower2 size={16} />}
          tone="soil"
          title="습관으로 샘물을 모아 정원을 키워요"
          desc="습관·회고·기도·말씀을 이행하면 🪣샘물이 모여요. 씨앗을 심고 물을 줄 때 샘물을 쓰고, 물을 준 식물은 다음날 04:00에 한 단계 자랍니다. 만개하면 수확해 포인트를 얻어요."
          bullets={[
            '씨앗 심기 — 씨앗값(P) + 샘물 🪣1',
            '물주기 — 샘물 🪣1 → 다음날 한 단계 성장',
            '샘물은 습관 이행으로만 모여요 (자동 성장 없음)',
          ]}
          details={
            <div className="space-y-3 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
              <DetailBlock title="희귀도별 수확 누적 보너스">
                <ul className="ml-3 space-y-0.5">
                  <li>· 일반 (basic / common) — 일일 포인트만</li>
                  <li>· 레어 — +20P</li>
                  <li>· 에픽 — +60P (레어 보너스 포함)</li>
                  <li>· 레전더리 — +160P (모든 등급 누적)</li>
                </ul>
              </DetailBlock>
              <DetailBlock title="식물 특성 (Traits)">
                <ul className="ml-3 space-y-0.5">
                  <li>· lucky — 희귀 씨앗 드롭 확률 ↑</li>
                  <li>· beauty — 매일 추가 경험치 자동 획득</li>
                  <li>· hardy — 시들지 않음</li>
                  <li>· fast — 물주기 1회에 2단계씩 자람 (대나무·민트)</li>
                  <li>· healer — 수확 시 정원 생기 회복</li>
                  <li>· bloomer — 물주기 1회에 2단계씩 자람 (생명나무)</li>
                  <li>· streakSync — 기도 스트릭 연동 시 수확 +50%</li>
                </ul>
                <p className="ml-3 mt-1 text-[var(--fg-faint)]">
                  ※ 일부 레전더리(수정장미·별빛백합·오로라난초·황금모란·여명백합)는 훨씬 화려한 대신
                  매우 연약합니다. 하루라도 성실하지 못한 날이 쌓이면 시들고, 끝내 영영 사라질 수 있어요.
                </p>
              </DetailBlock>
              <DetailBlock title="정원 생기 (Vitality)">
                정원 전체 컨디션을 0~100으로 표현합니다. 어제 습관 성과에 따라 하루에도 크게 출렁여요
                (성공 +15 · 실패 −35). 보호되지 않은 날은 매일 자연히 −5씩 줄어, 계속 가꿔야 유지됩니다.
                생기가 50 이하로 떨어지면 식물이 하나씩 시들기 시작해요. healer 특성 식물을 수확하면 회복돼요.
              </DetailBlock>
            </div>
          }
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.32, ease: EASE }}
      >
        <StepCard
          step="STEP 04"
          icon={<Sparkles size={16} />}
          tone="sky"
          title="하루를 한 줄로 마무리해요"
          desc="저녁에 짧은 회고를 남기면 +20포인트, AI 코치가 오늘의 패턴을 짧게 짚어줍니다."
          bullets={[
            '회고 작성 보너스 +20P',
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
        transition={{ duration: 0.55, delay: 0.4, ease: EASE }}
      >
        <StepCard
          step="STEP 05"
          icon={<Flame size={16} />}
          tone="bloom"
          title="꾸준함을 한눈에 확인해요"
          desc="연속 달성일(스트릭), 레벨, 히트맵, 주간/월간 통계로 성장 흐름을 추적합니다."
          bullets={[
            '스트릭 🔥 — 매일 1개 이상 달성하면 누적',
            '레벨 — 누적 포인트 기반',
            '히트맵 — 최근 활동 시각화',
          ]}
          details={
            <div className="space-y-3 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
              <DetailBlock title="진척 화면에서 볼 수 있는 것">
                <ul className="ml-3 space-y-0.5">
                  <li>· 스트릭 카운터 — 연속 달성일</li>
                  <li>· 레벨 — 누적 포인트로 결정</li>
                  <li>· 히트맵 — 일자별 달성 강도</li>
                  <li>· 주간 / 월간 리포트</li>
                  <li>· 일년 전 오늘 비교 카드</li>
                </ul>
              </DetailBlock>
              <DetailBlock title="스트릭이 깨지면">
                다음 “고급 기능” 섹션의 프리즈 토큰으로 보호하거나, 3일 이상 비웠다면
                컴백 보너스(2배 포인트)로 다시 가속할 수 있어요.
              </DetailBlock>
            </div>
          }
        />
      </motion.div>

      {/* 고급 기능 섹션 */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.48, ease: EASE }}
        className="pt-2"
      >
        <SectionLabel>Advanced</SectionLabel>
        <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight text-[var(--fg-primary)]">
          고급 기능
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
          기본 흐름이 익숙해지면 펼쳐서 살펴보세요. 모르고 써도 큰 문제는 없지만,
          알면 더 빠르게 성장합니다.
        </p>

        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          className="mt-3 flex w-full items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 px-4 py-3 text-left shadow-[var(--shadow-sm)] backdrop-blur-sm active:opacity-70"
          aria-expanded={advancedOpen}
        >
          <span className="text-[13px] font-medium text-[var(--fg-primary)]">
            고급 기능 9가지 {advancedOpen ? '접기' : '펼쳐보기'}
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
            icon={<Heart size={16} />}
            tone="bloom"
            title="컴백 보너스"
            summary="3일 이상 비운 뒤 복귀하면 3일간 포인트 ×2"
          >
            오랜만에 돌아왔을 때 자동으로 발동돼요. “🌱 N일 만이에요” 토스트와 함께
            3일간 모든 포인트가 두 배가 되어 다시 페이스를 잡기 쉽습니다.
          </AdvancedItem>

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
            icon={<Trophy size={16} />}
            tone="leaf"
            title="스트릭 마일스톤"
            summary="7일 / 30일 / 100일에 보너스와 배지"
          >
            <ul className="ml-3 space-y-0.5">
              <li>· 7일 → +50P + “일주일의 약속” 배지</li>
              <li>· 30일 → +200P + “한 달의 뿌리” 배지</li>
              <li>· 100일 → +500P + “백일의 정원” 배지</li>
            </ul>
          </AdvancedItem>

          <AdvancedItem
            icon={<Snowflake size={16} />}
            tone="sky"
            title="프리즈 토큰"
            summary="50P로 1개 구매, 스트릭 보호용"
          >
            토큰을 사용하면 하루를 빠뜨려도 스트릭이 끊어지지 않습니다. 컨디션이 안
            좋거나 여행 중일 때 안전망으로 활용해보세요.
          </AdvancedItem>

          <AdvancedItem
            icon={<Target size={16} />}
            tone="leaf"
            title="주간 퀘스트"
            summary="매주 1개 미션, 60~120P + 토큰 보상"
          >
            <ul className="ml-3 space-y-0.5">
              <li>· 아침 습관 5일 달성 — 80P + 토큰 1</li>
              <li>· 한 주 25회 달성 — 100P</li>
              <li>· 0점 없는 한 주 — 120P + 토큰 1</li>
              <li>· 회고 5회 작성 — 60P</li>
              <li>· 아침 습관 전체 달성 3일 — 90P</li>
            </ul>
          </AdvancedItem>

          <AdvancedItem
            icon={<Sun size={16} />}
            tone="bloom"
            title="시즌 시스템"
            summary="3개월 단위 — 30/80/150 달성 시 보상"
          >
            봄·여름·가을·겨울 시즌마다 누적 달성 횟수에 따라 단계 보상이 주어집니다.
            <ul className="ml-3 mt-1 space-y-0.5">
              <li>· 30회 — 시즌 장식 (나비·등불·호박·눈사람 등)</li>
              <li>· 80회 — 시즌 한정 식물 (벚꽃·레몬·감·소나무)</li>
              <li>· 150회 — 시즌 배지</li>
            </ul>
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
            streakSync 특성을 가진 식물은 기도 스트릭과 연동돼 수확이 더 풍성해집니다.
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
        transition={{ duration: 0.55, delay: 0.56, ease: EASE }}
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
