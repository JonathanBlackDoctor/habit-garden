import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { PrayerDoc, JournalEntryDoc, DayDoc } from 'shared/types/firestore';
import {
  usePrayers, usePrayerChecks, useDayDoc, useTodayPrayers, usePrayerActions,
  usePrayerGroups, usePrayerTargets, useLatestWeeklyDigest,
} from '@/features/prayers/usePrayers';
import {
  PrayerCheckCard, PrayerListCard, PrayerDetailDialog,
  usePrayerSelection, BulkActionBar, AddPrayerDialog,
} from '@/features/prayers/PrayerComponents';
import BulkParse from '@/features/prayers/BulkParse';
import PrayerMode from '@/features/prayers/PrayerMode';
import { DuplicateFinder } from '@/features/prayers/DuplicateFinder';
import { WeeklyDigestCard } from '@/features/prayers/WeeklyDigestCard';
import { selectMorePrayers, type RotationInput } from 'shared/prayerRotation';
import { Plus, ClipboardList, Search, Heart, ListChecks, Layers, ChevronDown, HandHeart, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useFaithEnabled, useIsPremium } from '@/lib/features';
import { useTabBloomKey } from '@/lib/tabActive';
import { ApplicationsPanel } from '@/routes/Applications';

type Segment = 'today' | 'all' | 'answered' | 'dormant';
const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'today',    label: '오늘' },
  { id: 'all',      label: '전체' },
  { id: 'answered', label: '응답' },
  { id: 'dormant',  label: '잠든' },
];

const MORE_BATCH = 3;

function tsToMs(ts: unknown): number | undefined {
  return (ts as any)?.toMillis?.();
}

function toInputs(active: PrayerDoc[]): RotationInput[] {
  const now = Date.now();
  return active.map((p) => ({
    id: p.id,
    priority: p.priority,
    pinned: p.pinned,
    rotationDays: p.rotationDays,
    receivedAtMs: tsToMs(p.receivedAt) ?? now,
    lastPrayedAtMs: tsToMs(p.lastPrayedAt),
  }));
}

export default function Prayers() {
  const faithEnabled = useFaithEnabled();
  if (!faithEnabled) return <Navigate to="/" replace />;
  return <PrayersInner />;
}

function PrayersInner() {
  const date = useAppStore((s) => s.currentDate);
  const prayers = usePrayers();
  const checks  = usePrayerChecks(date);
  const { dayDoc, loaded: dayLoaded } = useDayDoc(date);
  const isPremium = useIsPremium();

  // 신앙 탭 상단 전환 — 기도 / 말씀 적용. URL ?view=application 로 딥링크·튜토리얼 연동.
  const [searchParams, setSearchParams] = useSearchParams();
  const view: 'prayer' | 'application' =
    searchParams.get('view') === 'application' ? 'application' : 'prayer';
  const setView = (v: 'prayer' | 'application') =>
    setSearchParams(v === 'application' ? { view: 'application' } : {}, { replace: true });

  const [seg, setSeg] = useState<Segment>('today');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<PrayerDoc | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (p: PrayerDoc) => { setSelected(p); setDetailOpen(true); };
  // 선택된 기도제목을 최신 데이터로 동기화
  const liveSelected = useMemo(
    () => (selected ? prayers.find((p) => p.id === selected.id) ?? selected : null),
    [selected, prayers]
  );

  return (
    <div className="flex flex-col gap-3 p-4 pb-6">
      {/* 신앙 탭 상단 전환 — 기도 / 말씀 적용 */}
      <div className="flex rounded-[var(--radius)] bg-[var(--bg-base)] p-0.5">
        <FaithViewTab active={view === 'prayer'} onClick={() => setView('prayer')} icon={<HandHeart size={15} />} label="기도" />
        <FaithViewTab active={view === 'application'} onClick={() => setView('application')} icon={<BookOpen size={15} />} label="말씀 적용" />
      </div>

      {view === 'application' ? (
        <ApplicationsPanel />
      ) : (
        <PrayerSection
          prayers={prayers} checks={checks} dayDoc={dayDoc} dayLoaded={dayLoaded}
          isPremium={isPremium} date={date}
          seg={seg} setSeg={setSeg}
          addOpen={addOpen} setAddOpen={setAddOpen}
          bulkOpen={bulkOpen} setBulkOpen={setBulkOpen}
          detailOpen={detailOpen} setDetailOpen={setDetailOpen}
          liveSelected={liveSelected} openDetail={openDetail}
        />
      )}
    </div>
  );
}

function FaithViewTab({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius)-2px)] py-2 text-sm font-medium transition-colors',
        active ? 'bg-white text-[var(--leaf)] shadow-[var(--shadow-sm)]' : 'text-[var(--fg-muted)]',
      )}
    >
      {icon} {label}
    </button>
  );
}

function PrayerSection({
  prayers, checks, dayDoc, dayLoaded, isPremium, date,
  seg, setSeg, addOpen, setAddOpen, bulkOpen, setBulkOpen,
  detailOpen, setDetailOpen, liveSelected, openDetail,
}: {
  prayers: PrayerDoc[];
  checks: Record<string, { prayerId: string }>;
  dayDoc: DayDoc | null;
  dayLoaded: boolean;
  isPremium: boolean;
  date: string;
  seg: Segment; setSeg: (s: Segment) => void;
  addOpen: boolean; setAddOpen: (v: boolean) => void;
  bulkOpen: boolean; setBulkOpen: (v: boolean) => void;
  detailOpen: boolean; setDetailOpen: (v: boolean) => void;
  liveSelected: PrayerDoc | null;
  openDetail: (p: PrayerDoc) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* 세그먼트 + 추가·무더기 */}
      <div data-tour="prayer-segments" className="flex items-center gap-2">
        <div className="flex flex-1 rounded-[var(--radius)] bg-[var(--bg-base)] p-0.5">
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeg(s.id)}
              className={cn(
                'flex-1 rounded-[calc(var(--radius)-2px)] py-1.5 text-xs font-medium transition-colors',
                seg === s.id ? 'bg-white text-[var(--leaf)] shadow-[var(--shadow-sm)]' : 'text-[var(--fg-muted)]'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--leaf)] px-3 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-sm)]"
        >
          <Plus size={14} /> 추가
        </button>
        {isPremium && (
          <button
            onClick={() => setBulkOpen(true)}
            data-tour="prayer-bulk"
            className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--fg-muted)]"
          >
            <ClipboardList size={14} /> 무더기
          </button>
        )}
      </div>

      {/* 본문 */}
      {seg === 'today'    && <TodayView prayers={prayers} dayDoc={dayDoc} dayLoaded={dayLoaded} checks={checks} onOpen={openDetail} date={date} />}
      {seg === 'all'      && <AllView prayers={prayers} onOpen={openDetail} />}
      {seg === 'answered' && <ListView prayers={prayers.filter((p) => p.status === 'answered')} empty="아직 응답 기록이 없습니다." onOpen={openDetail} />}
      {seg === 'dormant'  && <ListView prayers={prayers.filter((p) => p.status === 'dormant')} empty="잠든 기도가 없습니다." onOpen={openDetail} />}

      <PrayerDetailDialog
        prayer={liveSelected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <AddPrayerDialog open={addOpen} onOpenChange={setAddOpen} />
      {isPremium && <BulkParse open={bulkOpen} onOpenChange={setBulkOpen} />}
    </div>
  );
}

// ── 오늘 화면 ─────────────────────────────────────────────
function TodayView({
  prayers, dayDoc, dayLoaded, checks, onOpen, date,
}: {
  prayers: PrayerDoc[];
  dayDoc: DayDoc | null;
  dayLoaded: boolean;
  checks: Record<string, { prayerId: string }>;
  onOpen: (p: PrayerDoc) => void;
  date: string;
}) {
  const { checkPrayer, uncheckPrayer, appendTodayExtras, persistTodayPlan } = usePrayerActions();
  const { pinned, rotation, fromPlan, pinnedIds, rotationIds } = useTodayPrayers(prayers, dayDoc);
  const digest = useLatestWeeklyDigest();
  const prayerBloomKey = useTabBloomKey('/prayers'); // 기도 탭 진입 시 진행바 재생

  // 오늘의 목록을 그날 한 번 확정 — 기도 체크로 lastPrayedAt 이 바뀌어도 목록이 흔들리지 않게.
  // 빈 계산은 영속화하지 않는다(prayers 로딩 전 빈 배열로 하루가 잠기는 것을 방지).
  // dayDoc 스냅샷이 도착하기 전엔 영속화하지 않는다 — prayers 가 dayDoc 보다 먼저 와서
  // '확정된 plan 없음'으로 오판하고, 라이브 재계산 결과로 기존 plan 을 덮어쓰는 레이스를 막는다.
  const planPersistedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!dayLoaded) return;
    if (fromPlan) return;
    if (pinnedIds.length + rotationIds.length === 0) return;
    if (planPersistedFor.current === date) return;
    planPersistedFor.current = date;
    void persistTodayPlan(date, pinnedIds, rotationIds);
  }, [dayLoaded, fromPlan, date, pinnedIds, rotationIds, persistTodayPlan]);
  // '더 받기' 결과는 DayDoc.prayerPlan.extraIds 에 영속화 — 탭 전환·새로고침에도 유지
  const extraIds = useMemo(() => dayDoc?.prayerPlan?.extraIds ?? [], [dayDoc]);

  const active = useMemo(() => prayers.filter((p) => p.status === 'active'), [prayers]);
  const byId = useMemo(() => new Map(active.map((p) => [p.id, p] as const)), [active]);

  const planIds = useMemo(
    () => new Set([...pinned, ...rotation].map((p) => p.id)),
    [pinned, rotation]
  );
  const extra = extraIds.map((id) => byId.get(id)).filter(Boolean) as PrayerDoc[];

  const all = [...pinned, ...rotation, ...extra];
  const total = all.length;
  const done = all.filter((p) => checks[p.id]).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const [prayerModeOpen, setPrayerModeOpen] = useState(false);

  const loadMore = () => {
    const exclude = new Set([...planIds, ...extraIds]);
    const next = selectMorePrayers(toInputs(active), exclude, Date.now(), MORE_BATCH);
    if (next.length === 0) return;
    void appendTodayExtras(date, [...extraIds, ...next]);
  };

  const hasMore = active.some((p) => !p.pinned && !planIds.has(p.id) && !extraIds.includes(p.id));

  return (
    <div className="space-y-3">
      {digest && <WeeklyDigestCard digest={digest} />}

      {/* 기도 모드 진입 — 어둡고 고요한 세션 */}
      {total > 0 && (
        <button
          onClick={() => setPrayerModeOpen(true)}
          className="flex w-full items-center justify-between rounded-[var(--radius-lg)] bg-gradient-to-br from-[#1B222C] to-[#10141A] px-5 py-4 text-left shadow-[var(--shadow-md)]"
        >
          <div>
            <p className="text-sm font-medium text-[#E7E5DF]">🙏 기도 시작</p>
            <p className="mt-0.5 text-xs text-[#9AA0A6]">
              {total - done > 0 ? `남은 기도 ${total - done}개 · ` : ''}조용히 머무는 시간
            </p>
          </div>
          <span className="text-[#8FBF6F]">→</span>
        </button>
      )}

      {/* 진행 표시 (목록이 있을 때만) */}
      {total > 0 ? (
        <div className="card p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--fg-primary)]">오늘 {done} / {total} 기도</span>
            <span className="tabular-nums text-[var(--fg-muted)]">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-base)]">
            <motion.div
              key={prayerBloomKey}
              className="h-full rounded-full bg-[var(--leaf)]"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          {done === total && (
            <p className="mt-2 text-center text-xs text-[var(--leaf)]">오늘의 기도 완료 — 수고했어요! (+15P)</p>
          )}
        </div>
      ) : (
        <p className="px-1 py-6 text-center text-sm text-[var(--fg-faint)]">
          오늘 자동 추천 목록이 비어 있어요.{hasMore ? ' 아래에서 더 받아보세요 🙏' : ' 위에서 기도제목을 추가해보세요 🙏'}
        </p>
      )}

      {pinned.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-medium text-[var(--fg-muted)]">📌 고정</h3>
          {pinned.map((p) => (
            <PrayerCheckCard
              key={p.id} prayer={p} checked={!!checks[p.id]}
              onCheck={() => checkPrayer(p)} onUncheck={() => uncheckPrayer(p)}
              onOpen={() => onOpen(p)}
            />
          ))}
        </section>
      )}

      {rotation.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-medium text-[var(--fg-muted)]">오늘의 로테이션</h3>
          {rotation.map((p) => (
            <PrayerCheckCard
              key={p.id} prayer={p} checked={!!checks[p.id]}
              onCheck={() => checkPrayer(p)} onUncheck={() => uncheckPrayer(p)}
              onOpen={() => onOpen(p)}
            />
          ))}
        </section>
      )}

      {extra.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-medium text-[var(--fg-muted)]">더 받은 기도</h3>
          {extra.map((p) => (
            <PrayerCheckCard
              key={p.id} prayer={p} checked={!!checks[p.id]}
              onCheck={() => checkPrayer(p)} onUncheck={() => uncheckPrayer(p)}
              onOpen={() => onOpen(p)}
            />
          ))}
        </section>
      )}

      {hasMore && (
        <button
          onClick={loadMore}
          className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-white py-2.5 text-xs font-medium text-[var(--fg-muted)]"
        >
          <Plus size={14} /> 오늘 기도 더 받기 (+{MORE_BATCH})
        </button>
      )}

      <GratitudeSection date={date} />

      <PrayerMode
        open={prayerModeOpen}
        onClose={() => setPrayerModeOpen(false)}
        prayers={all}
        checks={checks}
        date={date}
      />
    </div>
  );
}

// ── 전체 (필터·검색·모임칩) ────────────────────────────────
function AllView({ prayers, onOpen }: { prayers: PrayerDoc[]; onOpen: (p: PrayerDoc) => void }) {
  const knownGroups = usePrayerGroups();
  const knownTargets = usePrayerTargets();
  const [search, setSearch] = useState('');
  const [grp, setGrp] = useState<string | 'all'>('all');
  const [tgt, setTgt] = useState<string | 'all'>('all');
  const sel = usePrayerSelection();

  const active = prayers.filter((p) => p.status === 'active');

  // 알려진 모임 + 실제 사용 중인 모임 합집합
  const groups = useMemo(() => {
    const used = active.map((p) => p.group || '개인');
    return Array.from(new Set([...knownGroups, ...used]));
  }, [knownGroups, active]);

  // 알려진 대상 + 실제 사용 중인 대상 합집합
  const targets = useMemo(() => {
    const used = active.map((p) => p.target || '나 자신');
    return Array.from(new Set([...knownTargets, ...used]));
  }, [knownTargets, active]);

  const filtered = active.filter((p) => {
    if (grp !== 'all' && (p.group || '개인') !== grp) return false;
    if (tgt !== 'all' && (p.target || '나 자신') !== tgt) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${p.title} ${p.group ?? ''} ${p.target ?? ''} ${(p.tags ?? []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // 무더기 묶음 — batchId별 그룹화 (2개 이상)
  const batches = useMemo(() => groupByBatch(active), [active]);

  const selectBatch = (ids: string[]) => {
    sel.setSelectMode(true);
    sel.selectAll(ids);
  };

  return (
    <div className="space-y-3">
      {sel.selectMode && <BulkActionBar ids={[...sel.selectedIds]} onDone={sel.exit} prayers={active} />}

      <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2">
        <Search size={15} className="text-[var(--fg-faint)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제목·모임 검색"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="shrink-0 text-[10px] text-[var(--fg-faint)]">모임</span>
        <Chip active={grp === 'all'} onClick={() => setGrp('all')}>전체</Chip>
        {groups.map((g) => (
          <Chip key={g} active={grp === g} onClick={() => setGrp(g)}>{g}</Chip>
        ))}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="shrink-0 text-[10px] text-[var(--fg-faint)]">대상</span>
        <Chip active={tgt === 'all'} onClick={() => setTgt('all')}>전체</Chip>
        {targets.map((t) => (
          <Chip key={t} active={tgt === t} onClick={() => setTgt(t)}>{t}</Chip>
        ))}
      </div>

      {!sel.selectMode && <BatchGroupPanel batches={batches} onSelectBatch={selectBatch} />}

      {!sel.selectMode && <DuplicateFinder prayers={active} onOpen={onOpen} />}

      {filtered.length === 0 ? (
        <EmptyState text="조건에 맞는 기도제목이 없습니다." />
      ) : (
        <div className="space-y-2">
          <SelectToolbar
            count={filtered.length}
            sel={sel}
            allIds={filtered.map((p) => p.id)}
          />
          {filtered.map((p) => (
            <PrayerListCard
              key={p.id}
              prayer={p}
              onOpen={() => onOpen(p)}
              selectMode={sel.selectMode}
              selected={sel.isSelected(p.id)}
              onToggleSelect={() => sel.toggle(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ListView({ prayers, empty, onOpen }: { prayers: PrayerDoc[]; empty: string; onOpen: (p: PrayerDoc) => void }) {
  const sel = usePrayerSelection();
  if (prayers.length === 0) return <EmptyState text={empty} />;
  return (
    <div className="space-y-2">
      {sel.selectMode && <BulkActionBar ids={[...sel.selectedIds]} onDone={sel.exit} prayers={prayers} />}
      <SelectToolbar count={prayers.length} sel={sel} allIds={prayers.map((p) => p.id)} />
      {prayers.map((p) => (
        <PrayerListCard
          key={p.id}
          prayer={p}
          onOpen={() => onOpen(p)}
          selectMode={sel.selectMode}
          selected={sel.isSelected(p.id)}
          onToggleSelect={() => sel.toggle(p.id)}
        />
      ))}
    </div>
  );
}

// ── 선택 모드 툴바 (선택 진입 / 전체 선택) ─────────────────
function SelectToolbar({
  count, sel, allIds,
}: {
  count: number;
  sel: ReturnType<typeof usePrayerSelection>;
  allIds: string[];
}) {
  const allSelected = allIds.length > 0 && allIds.every((id) => sel.isSelected(id));
  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-[11px] text-[var(--fg-faint)]">{count}개</p>
      {sel.selectMode ? (
        <button
          onClick={() => (allSelected ? sel.clear() : sel.selectAll(allIds))}
          className="text-[11px] font-medium text-[var(--leaf)]"
        >
          {allSelected ? '선택 해제' : '전체 선택'}
        </button>
      ) : (
        <button
          onClick={() => sel.setSelectMode(true)}
          className="flex items-center gap-1 text-[11px] font-medium text-[var(--fg-muted)]"
        >
          <ListChecks size={13} /> 선택
        </button>
      )}
    </div>
  );
}

// ── 무더기 묶음 패널 ───────────────────────────────────────
type Batch = { batchId: string; items: PrayerDoc[]; receivedLabel: string };

function groupByBatch(prayers: PrayerDoc[]): Batch[] {
  const map = new Map<string, PrayerDoc[]>();
  for (const p of prayers) {
    if (!p.batchId) continue;
    const arr = map.get(p.batchId);
    if (arr) arr.push(p); else map.set(p.batchId, [p]);
  }
  const batches: Batch[] = [];
  for (const [batchId, items] of map) {
    if (items.length < 2) continue;
    const ms = (items[0].receivedAt as any)?.toMillis?.();
    const d = ms ? new Date(ms) : null;
    const receivedLabel = d ? `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}` : '';
    batches.push({ batchId, items, receivedLabel });
  }
  // 최근 받은 묶음 먼저
  batches.sort((a, b) => {
    const am = (a.items[0].receivedAt as any)?.toMillis?.() ?? 0;
    const bm = (b.items[0].receivedAt as any)?.toMillis?.() ?? 0;
    return bm - am;
  });
  return batches;
}

function BatchGroupPanel({
  batches, onSelectBatch,
}: {
  batches: Batch[];
  onSelectBatch: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  if (batches.length === 0) return null;
  return (
    <section className="space-y-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 px-1 text-xs font-medium text-[var(--fg-muted)]"
      >
        <Layers size={13} /> 무더기 묶음 ({batches.length})
        <ChevronDown
          size={14}
          className={cn('ml-auto transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && batches.map((b) => (
        <div key={b.batchId} className="card flex items-center gap-2 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--fg-primary)]">
              {b.items.length}개 묶음{b.receivedLabel && ` · ${b.receivedLabel} 받음`}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--fg-faint)]">
              {b.items.map((p) => p.title).join(', ')}
            </p>
          </div>
          <button
            onClick={() => onSelectBatch(b.items.map((p) => p.id))}
            className="shrink-0 rounded-[var(--radius)] bg-[var(--bg-base)] px-2.5 py-1.5 text-xs text-[var(--fg-muted)]"
          >
            이 묶음 선택
          </button>
        </div>
      ))}
    </section>
  );
}

// ── 감사 기록 (경건 흡수) ──────────────────────────────────
function GratitudeSection({ date }: { date: string }) {
  const uid = useAppStore((s) => s.uid);
  const [entries, setEntries] = useState<JournalEntryDoc[]>([]);
  const [input, setInput] = useState('');
  const [openForm, setOpenForm] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'days', date, 'gratitudes'), orderBy('createdAt'));
    return onSnapshot(q, (snap) => setEntries(snap.docs.map((d) => d.data() as JournalEntryDoc)));
  }, [uid, date]);

  const add = async () => {
    if (!uid || !input.trim()) return;
    await addDoc(collection(db, 'users', uid, 'days', date, 'gratitudes'), {
      id: Date.now().toString(), text: input.trim(), createdAt: serverTimestamp(),
    });
    setInput('');
  };

  return (
    <section className="card mt-1 space-y-2 p-3">
      <button
        onClick={() => setOpenForm((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-xs font-medium text-[var(--fg-muted)]"
      >
        <Heart size={13} className="text-[var(--bloom)]" /> 오늘의 감사 {entries.length > 0 && `(${entries.length})`}
      </button>
      {entries.map((e) => (
        <p key={e.id} className="rounded bg-[var(--bg-base)] px-2.5 py-1.5 text-xs text-[var(--fg-primary)]">{e.text}</p>
      ))}
      {openForm && (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="감사한 것 한 줄…"
            className="flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--sky)]"
          />
          <button onClick={add} className="rounded-[var(--radius)] bg-[var(--bloom)] px-3 text-white">
            <Plus size={16} />
          </button>
        </div>
      )}
    </section>
  );
}

// ── 공통 작은 컴포넌트 ─────────────────────────────────────
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-3 py-1 text-xs transition-colors',
        active ? 'bg-[var(--leaf)] text-white' : 'bg-[var(--bg-base)] text-[var(--fg-muted)]'
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-12 text-center text-sm text-[var(--fg-faint)]">{text}</p>;
}
