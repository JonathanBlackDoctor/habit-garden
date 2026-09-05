import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import { SectionHeading, StatusCircle } from '@/components/Editorial';
import {
  useDayDoc,
  usePrayerActions,
  usePrayerChecks,
  usePrayers,
  useTodayPrayers,
} from '@/features/prayers/usePrayers';

/** 오늘 탭에서 현재 기도 계획을 바로 확인하고 체크하는 편집형 목록. */
export default function TodayPrayerCard() {
  const navigate = useNavigate();
  const date = useAppStore((s) => s.currentDate);
  const prayers = usePrayers();
  const checks = usePrayerChecks(date);
  const { dayDoc, loaded } = useDayDoc(date);
  const { pinned, rotation, fromPlan, pinnedIds, rotationIds } = useTodayPrayers(prayers, dayDoc);
  const { checkPrayer, uncheckPrayer, persistTodayPlan } = usePrayerActions();
  const persistedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!loaded || fromPlan || persistedFor.current === date || prayers.length === 0) return;
    persistedFor.current = date;
    void persistTodayPlan(date, pinnedIds, rotationIds);
  }, [date, fromPlan, loaded, persistTodayPlan, pinnedIds, prayers.length, rotationIds]);

  const today = [...pinned, ...rotation];
  const shown = today.slice(0, 3);
  const done = today.filter((p) => checks[p.id]).length;

  return (
    <section className="space-y-2">
      <SectionHeading
        title="오늘의 기도"
        meta={today.length > 0 ? `${done} / ${today.length}` : undefined}
        action={<button type="button" onClick={() => navigate('/prayers')}>전체 보기</button>}
      />

      {shown.length > 0 ? (
        <div className="editorial-list">
          {shown.map((prayer) => {
            const checked = !!checks[prayer.id];
            return (
              <div key={prayer.id} className="editorial-row">
                <StatusCircle
                  checked={checked}
                  label={`${prayer.title} ${checked ? '기도 취소' : '기도 완료'}`}
                  onClick={() => void (checked ? uncheckPrayer(prayer) : checkPrayer(prayer))}
                />
                <button type="button" onClick={() => navigate('/prayers')} className="min-w-0 flex-1 text-left">
                  <span className={checked ? 'block truncate text-[15.5px] tracking-[-0.018em] text-[var(--fg-faint)]' : 'block truncate text-[15.5px] tracking-[-0.018em] text-[var(--fg-primary)]'}>{prayer.title}</span>
                  <span className="meta-copy mt-0.5 block truncate">{prayer.group} · {prayer.target}</span>
                </button>
                <span className="meta-copy">{prayer.pinned ? '고정' : '오늘'}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <button type="button" onClick={() => navigate('/prayers')} className="w-full border-y border-[var(--divider-soft)] py-[13px] text-left text-[13.5px] text-[var(--fg-faint)]">
          오늘 기도할 제목을 정리해 보세요
        </button>
      )}
    </section>
  );
}
