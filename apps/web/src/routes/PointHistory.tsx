import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, toZonedTime } from 'date-fns-tz';
import { ChevronLeft } from 'lucide-react';
import { useProgress } from '@/features/garden/useGarden';
import { usePointLedger, type PointLedgerEntry } from '@/features/points/usePointLedger';
import { describePointReason, describePointRef } from '@/features/points/pointLedger';

const KST = 'Asia/Seoul';
type Filter = 'all' | 'earn' | 'spend';

/** Timestamp(또는 미해결 serverTimestamp) → KST Date. 아직 서버 반영 전이면 현재 시각으로 대체. */
function toKstDate(entry: PointLedgerEntry): Date | null {
  const ts = entry.createdAt as { toDate?: () => Date } | null | undefined;
  if (!ts || typeof ts.toDate !== 'function') return null; // 로컬 쓰기 직후 (pending)
  return toZonedTime(ts.toDate(), KST);
}

function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd', { timeZone: KST });
}

function dateHeader(key: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const d = new Date(key + 'T12:00:00+09:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

export default function PointHistory() {
  const navigate = useNavigate();
  const progress = useProgress();
  const { entries, loading, hasMore, loadMore } = usePointLedger();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (filter === 'earn') return e.delta > 0;
        if (filter === 'spend') return e.delta < 0;
        return true;
      }),
    [entries, filter],
  );

  // 날짜별 그룹화 (KST 달력 기준). pending(=createdAt 미해결)은 '방금'으로 묶는다.
  const groups = useMemo(() => {
    const map = new Map<string, { header: string; items: PointLedgerEntry[] }>();
    for (const e of filtered) {
      const d = toKstDate(e);
      const key = d ? dateKey(d) : 'pending';
      if (!map.has(key)) {
        map.set(key, { header: key === 'pending' ? '방금' : dateHeader(key), items: [] });
      }
      map.get(key)!.items.push(e);
    }
    return Array.from(map.values());
  }, [filtered]);

  const spendable = progress?.spendablePoints ?? 0;
  const total = progress?.totalPoints ?? 0;

  return (
    <div className="min-h-screen p-4 space-y-4 pb-8">
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="rounded-full p-1 text-[var(--fg-muted)] hover:bg-[var(--leaf-soft)]"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">포인트 내역</h2>
      </div>

      {/* 요약 */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--fg-muted)]">사용 가능</p>
          <p className="text-2xl font-bold text-[var(--bloom)] tabular-nums">✦{spendable.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--fg-muted)]">누적 획득</p>
          <p className="text-lg font-semibold text-[var(--fg-primary)] tabular-nums">{total.toLocaleString()}P</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {([
          ['all', '전체'],
          ['earn', '획득'],
          ['spend', '사용'],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-[var(--leaf)] text-white'
                : 'bg-[var(--leaf-soft)] text-[var(--fg-muted)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--fg-faint)]">불러오는 중…</p>
      ) : groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--fg-faint)]">
          아직 포인트 내역이 없어요.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.header} className="space-y-1">
              <p className="px-1 text-xs font-medium text-[var(--fg-faint)]">{g.header}</p>
              <div className="card divide-y divide-[var(--leaf-soft)] overflow-hidden">
                {g.items.map((e) => {
                  const info = describePointReason(e.reason);
                  const ref = describePointRef(e.reason, e.refId);
                  const d = toKstDate(e);
                  const time = d ? format(d, 'HH:mm', { timeZone: KST }) : '';
                  const positive = e.delta > 0;
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="text-lg leading-none">{info.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[var(--fg-primary)]">
                          {info.label}
                          {ref && <span className="text-[var(--fg-faint)]"> · {ref}</span>}
                        </p>
                        {time && <p className="text-[11px] text-[var(--fg-faint)] tabular-nums">{time}</p>}
                      </div>
                      <span
                        className={`shrink-0 text-sm font-bold tabular-nums ${
                          positive ? 'text-[var(--leaf)]' : 'text-[var(--bloom)]'
                        }`}
                      >
                        {positive ? '+' : '−'}
                        {Math.abs(e.delta).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              className="w-full rounded-xl bg-[var(--leaf-soft)] py-2.5 text-sm font-medium text-[var(--fg-muted)]"
            >
              더 보기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
