import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import type { HabitCheckDoc, HabitDoc } from 'shared/types/firestore';
import { useAppStore } from '@/lib/store';
import { formatKoreanDate, weekdayLabel } from '@/lib/dayBoundary';
import { cn } from '@/lib/utils';
import { ProgressRail } from '@/components/Editorial';
import { useHabits, useSaveHabitCheck, useClearHabitCheck } from './useHabits';
import { useHabitWeek } from './useHabitWeek';
import { cellAvailability, checkLabel, recordingHabit, weekDates, weekSummary } from './habitWeek';
import HabitCheckEditor from './HabitCheckEditor';

const UNAVAILABLE = { future: '아직 오지 않은 날', rest: '쉬는 날', 'before-start': '시작 전', inactive: '비활성 습관' };
const shortDate = (date: string) => `${Number(date.slice(5, 7))}.${date.slice(8)}`;

export default function HabitWeekBoard() {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<{ id: string; date: string } | null>(null);
  const dates = useMemo(() => weekDates(today, offset), [today, offset]);
  const allHabits = useHabits({ includeInactive: true, includeHibernating: true, includeArchived: true });
  const { checks, loading, error } = useHabitWeek(dates);
  const habits = allHabits.filter((h) => (!h.archivedAt && h.active) || dates.some((date) => checks[date]?.[h.id]));
  const summary = weekSummary(habits, dates, checks, today);
  const selectedHabit = habits.find((h) => h.id === selected?.id);
  const selectedCheck = selected ? checks[selected.date]?.[selected.id] : undefined;

  useEffect(() => { setSelected(null); }, [uid, offset, today]);
  return (
    <section className="habit-week space-y-5" aria-label="주간 습관 기록">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="kicker">{offset === 0 ? '이번 주' : '지난 기록'}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--fg-primary)]">{shortDate(dates[0])} <span className="mx-1 font-normal text-[var(--fg-faint)]">—</span> {shortDate(dates[6])}</h2>
        </div>
        <div className="flex items-center gap-1">
          {offset !== 0 && <button type="button" onClick={() => setOffset(0)} className="min-h-11 px-2 text-xs text-[var(--leaf)]">이번 주</button>}
          <button type="button" aria-label="이전 주" onClick={() => setOffset((n) => n - 1)} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--divider-soft)] hover:bg-[var(--leaf-soft)]"><ChevronLeft size={17} /></button>
          <button type="button" aria-label="다음 주" disabled={offset >= 0} onClick={() => setOffset((n) => n + 1)} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--divider-soft)] hover:bg-[var(--leaf-soft)] disabled:opacity-25"><ChevronRight size={17} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[var(--leaf-soft)] p-4">
          <p className="text-xs text-[var(--fg-muted)]">{offset === 0 ? '오늘까지 달성률' : '주간 달성률'}</p>
          <p className="my-2 text-[30px] font-semibold leading-none tracking-tight text-[var(--leaf)]">{loading || error || summary.rate === null ? '—' : `${summary.rate}%`}</p>
          <p className="text-xs text-[var(--fg-muted)]">{loading ? '불러오는 중' : error ? '조회 실패' : `${summary.achieved} / ${summary.target} 달성 · 건너뜀 제외`}</p>
        </div>
        <div className="rounded-2xl border border-[var(--divider-soft)] p-4">
          <p className="text-xs text-[var(--fg-muted)]">기록한 습관</p>
          <p className="my-2 text-[30px] font-semibold leading-none tracking-tight text-[var(--fg-primary)]">{loading || error ? '—' : summary.recorded}<span className="ml-1 text-sm font-normal text-[var(--fg-faint)]">/ {loading || error ? '—' : summary.total}</span></p>
          <p className="text-xs text-[var(--fg-muted)]">{offset === 0 ? '오늘까지' : '일주일'} · 건너뜀 {loading || error ? '—' : summary.skipped}회</p>
        </div>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-[var(--bloom)] p-3 text-sm text-[var(--bloom)]">주간 기록을 불러오지 못했어요. 연결을 확인한 뒤 다른 주로 이동해 다시 열어주세요.</p> : <>
        <div className="flex items-center justify-between text-xs text-[var(--fg-faint)]"><span>칸을 눌러 기록을 수정하세요</span><span className="flex items-center gap-1">옆으로 보기 <ArrowUpRight size={12} /></span></div>
        <div className="week-scroll overflow-x-auto rounded-xl border border-[var(--divider-soft)]" data-no-swipe>
          <table className="week-table w-full border-separate border-spacing-0 text-left" aria-label="습관별 요일 기록" aria-busy={loading}>
            <thead><tr>
              <th scope="col" className="week-name sticky left-0 z-20 border-b border-[var(--divider-soft)] bg-[var(--bg-base)] px-3 py-4 text-xs font-medium text-[var(--fg-muted)]">습관</th>
              {dates.map((date) => <th scope="col" key={date} className={cn('border-b border-[var(--divider-soft)] px-1 py-3 text-center text-[11px] font-normal text-[var(--fg-faint)]', date === today && 'bg-[var(--leaf-soft)]')}>
                {weekdayLabel(date)}<span className={cn('mx-auto mt-1 grid h-7 w-7 place-items-center rounded-full text-sm text-[var(--fg-primary)]', date === today && 'bg-[var(--leaf)] text-white')}>{Number(date.slice(8))}</span>
              </th>)}
              <th scope="col" className="border-b border-[var(--divider-soft)] px-3 text-center text-xs font-normal text-[var(--fg-muted)]">달성</th>
            </tr></thead>
            <tbody>{habits.map((habit) => {
              const row = weekSummary([habit], dates, checks, today);
              return <tr key={habit.id}>
                <th scope="row" className="week-name sticky left-0 z-10 border-b border-[var(--divider-soft)] bg-[var(--bg-base)] px-3 py-4 font-normal">
                  <span className="block text-[13px] font-medium leading-relaxed text-[var(--fg-primary)]">{habit.title}</span>
                  <span className="mt-1 block text-[10px] text-[var(--fg-faint)]">{habit.archivedAt ? '보관된 습관' : habit.scoreMode === 'scaled' ? '1–5점' : '완료 체크'}</span>
                </th>
                {dates.map((date) => {
                  const check = checks[date]?.[habit.id];
                  const available = cellAvailability(habit, date, today, check);
                  const disabled = available !== 'available';
                  const displayHabit = recordingHabit(habit, check);
                  const value = !check ? '' : check.score === null ? '—' : displayHabit.scoreMode === 'scaled' ? check.score : check.achieved ? '✓' : '×';
                  const label = `${habit.title} ${formatKoreanDate(date)} · ${disabled ? UNAVAILABLE[available as keyof typeof UNAVAILABLE] : checkLabel(check)}${check?.score != null && displayHabit.scoreMode === 'scaled' ? ` ${check.score}점` : ''}`;
                  return <td key={date} className={cn('border-b border-[var(--divider-soft)] px-0.5 py-3 text-center', date === today && 'bg-[var(--leaf-soft)]/30')}>
                    <button type="button" disabled={disabled || loading} aria-label={label} title={label} onClick={() => setSelected({ id: habit.id, date })}
                      className={cn('mx-auto grid h-[44px] w-[44px] place-items-center rounded-xl border text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--leaf)]',
                        disabled ? 'border-transparent text-[var(--fg-faint)] opacity-40' : check?.achieved ? 'border-[var(--leaf)] bg-[var(--leaf)] text-white' : check?.score === null ? 'border-[var(--divider-soft)] bg-[var(--divider-soft)] text-[var(--fg-muted)]' : check ? 'border-[var(--bloom)] text-[var(--bloom)]' : 'border-[var(--divider-soft)] bg-[var(--bg-surface)] hover:border-[var(--leaf)]')}>
                      {disabled && !check ? '·' : value}
                    </button>
                  </td>;
                })}
                <td className="min-w-20 border-b border-[var(--divider-soft)] px-3 text-center">
                  <p className="text-xs tabular-nums text-[var(--fg-muted)]">{loading ? '—' : `${row.achieved}/${row.target}`}</p>
                  <ProgressRail value={loading ? 0 : row.rate ?? 0} className="mt-2 h-[3px]" />
                </td>
              </tr>;
            })}</tbody>
          </table>
          {!habits.length && !loading && <p className="p-8 text-center text-sm text-[var(--fg-muted)]">표시할 습관이 없어요. 오늘 보기에서 습관을 추가해 주세요.</p>}
          {loading && <p role="status" className="p-4 text-center text-xs text-[var(--fg-muted)]">주간 기록을 불러오는 중…</p>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[var(--fg-muted)]"><span><span className="mr-1 text-[var(--leaf)]">●</span> 달성</span><span>× 미달성</span><span>— 건너뜀</span><span>빈칸 미기록</span><span>· 대상 아님</span></div>
        <p className="text-[11px] leading-relaxed text-[var(--fg-faint)]">미래 날짜와 쉬는 날은 달성률에 포함하지 않아요. 하루는 오전 4시에 바뀝니다.</p>
      </>}
      {selected && selectedHabit && !loading && !error && <WeekEntryEditor key={`${selected.date}:${selected.id}`} habit={recordingHabit(selectedHabit, selectedCheck)} check={selectedCheck} date={selected.date} onClose={() => setSelected(null)} />}
    </section>
  );
}

function WeekEntryEditor({ habit, check, date, onClose }: { habit: HabitDoc; check?: HabitCheckDoc; date: string; onClose: () => void }) {
  const save = useSaveHabitCheck(date);
  const clear = useClearHabitCheck(date);
  return <HabitCheckEditor habit={habit} check={check} dateLabel={formatKoreanDate(date)} open onClose={onClose} onSave={(score) => save(habit, score, check)} onClear={() => clear(habit, check)} />;
}
