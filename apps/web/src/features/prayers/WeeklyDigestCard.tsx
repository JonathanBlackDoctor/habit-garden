import { motion } from 'framer-motion';
import { Sparkles, Moon, Copy } from 'lucide-react';
import type { PrayerDoc, PrayerWeeklyDigestDoc } from 'shared/types/firestore';
import type { DormantSoonItem } from './usePrayers';

/**
 * 기도 회고 카드 — 주간 회고(있으면) + 곧 잠드는 기도 예고(D) + 정리 제안(H).
 * 오늘 탭에 위젯을 늘리지 않고 이 카드 하나로 통합한다.
 * digest 가 없어도 곧 잠드는 기도가 있으면 렌더된다.
 */
export function WeeklyDigestCard({
  digest,
  dormantSoon = [],
  pendingToday,
  onPrayNow,
  onOpenDuplicates,
}: {
  digest: PrayerWeeklyDigestDoc | null;
  dormantSoon?: DormantSoonItem[];
  pendingToday?: number;
  onPrayNow?: (p: PrayerDoc) => void;
  onOpenDuplicates?: () => void;
}) {
  if (!digest && dormantSoon.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card space-y-2.5 bg-gradient-to-br from-[var(--bg-base)] to-white p-3"
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--leaf)]">
        <Sparkles size={13} /> 이번 주 기도 회고
      </div>

      {digest && (
        <>
          <p className="line-clamp-2 text-sm leading-relaxed text-[var(--fg-primary)]">
            {digest.oneLineEncouragement}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--fg-muted)]">
            <span>총 {digest.totalChecks}회 기도</span>
            <span>집중 모임: {digest.topGroup}</span>
            {digest.answeredCount > 0 && (
              <span className="text-[var(--leaf)]">응답 {digest.answeredCount}건 ✨</span>
            )}
            {pendingToday != null && pendingToday > 0 && (
              <span>오늘 대기 {pendingToday}개</span>
            )}
          </div>
        </>
      )}

      {/* 곧 잠드는 기도 (D) — 실시간 계산, 한 번의 탭으로 오늘 목록에 살림 */}
      {dormantSoon.length > 0 && (
        <div className="space-y-1.5 rounded-[var(--radius)] bg-amber-50 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
            <Moon size={12} /> 곧 잠드는 기도 {dormantSoon.length}개
          </div>
          <ul className="space-y-1">
            {dormantSoon.map(({ prayer, daysLeft }) => (
              <li key={prayer.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-[var(--fg-primary)]">
                  {prayer.title}
                  <span className="ml-1 text-[10px] text-amber-600">D-{daysLeft}</span>
                </span>
                {onPrayNow && (
                  <button
                    onClick={() => onPrayNow(prayer)}
                    className="shrink-0 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-medium text-white"
                  >
                    오늘 기도하기
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 유사 기도제목 정리 제안 (H) — 기존 중복 찾기로 진입 */}
      {onOpenDuplicates && (
        <button
          onClick={onOpenDuplicates}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--fg-muted)]"
        >
          <Copy size={11} /> 비슷한 기도제목 정리하기 →
        </button>
      )}
    </motion.div>
  );
}
