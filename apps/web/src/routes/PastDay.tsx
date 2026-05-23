import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, ListChecks, HeartPulse, PenLine } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { formatKoreanDate, plannerDate } from '@/lib/dayBoundary';
import type { DayDoc } from 'shared/types/firestore';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export default function PastDay() {
  const { date = '' } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const uid = useAppStore((s) => s.uid);
  const [day, setDay] = useState<DayDoc | null>(null);

  const valid = YMD.test(date);
  const isFuture = valid && date > plannerDate();
  const isToday  = valid && date === plannerDate();

  useEffect(() => {
    if (!uid || !valid) return;
    return onSnapshot(doc(db, 'users', uid, 'days', date), (snap) => {
      setDay(snap.exists() ? (snap.data() as DayDoc) : null);
    });
  }, [uid, date, valid]);

  if (!valid) {
    return (
      <div className="min-h-screen p-4 space-y-3">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]">
          <ChevronLeft size={22} />
        </button>
        <p className="text-sm text-[var(--fg-muted)]">잘못된 날짜입니다.</p>
      </div>
    );
  }

  const q = isToday ? '' : `?date=${date}`;
  const score = day?.dayScore ?? 0;
  const hasCondition = !!day?.condition;
  const hasReflection = !!day?.reflection;

  return (
    <div className="min-h-screen p-4 space-y-4 pb-8">
      <div className="flex items-center gap-2 py-1">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">
          {formatKoreanDate(date)} {isToday && <span className="text-xs text-[var(--leaf)]">· 오늘</span>}
        </h2>
      </div>

      {isFuture ? (
        <div className="card p-6 text-center text-sm text-[var(--fg-muted)]">
          아직 오지 않은 날입니다.
        </div>
      ) : (
        <>
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--fg-muted)]">하루 점수</p>
              <p className="text-2xl font-bold text-[var(--leaf)] tabular-nums">{score}</p>
            </div>
            <div className="text-right text-xs text-[var(--fg-faint)]">
              <p>컨디션 {hasCondition ? '✓' : '—'}</p>
              <p>회고 {hasReflection ? '✓' : '—'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Link
              to={`/habits${q}`}
              className="card flex items-center gap-3 p-4 active:bg-[var(--leaf-soft)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--leaf-soft)] text-[var(--leaf)]">
                <ListChecks size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--fg-primary)]">습관 체크 수정</p>
                <p className="text-xs text-[var(--fg-muted)]">달성·점수 변경</p>
              </div>
            </Link>

            <Link
              to={`/condition${q}`}
              className="card flex items-center gap-3 p-4 active:bg-[var(--leaf-soft)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--leaf-soft)] text-[var(--leaf)]">
                <HeartPulse size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--fg-primary)]">컨디션 수정</p>
                <p className="text-xs text-[var(--fg-muted)]">수면·에너지·기분</p>
              </div>
            </Link>

            <Link
              to={`/reflection${q}`}
              className="card flex items-center gap-3 p-4 active:bg-[var(--leaf-soft)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--leaf-soft)] text-[var(--leaf)]">
                <PenLine size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--fg-primary)]">회고 수정</p>
                <p className="text-xs text-[var(--fg-muted)]">하루 돌아보기</p>
              </div>
            </Link>
          </div>

          {!isToday && (
            <p className="text-[11px] text-[var(--fg-faint)] px-1 leading-relaxed">
              지난 날 기록을 수정해도 포인트·콤보·셀러브레이션은 다시 트리거되지 않습니다.
              저장한 점수에 따라 하루 점수만 다시 계산됩니다.
            </p>
          )}
        </>
      )}
    </div>
  );
}
