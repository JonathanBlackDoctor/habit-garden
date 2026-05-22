import { useEffect, useMemo, useState } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type {
  PrayerDoc, PrayerCategory, JournalEntryDoc,
} from 'shared/types/firestore';
import { PRAYER_CATEGORY_LABELS } from 'shared/types/firestore';
import {
  usePrayers, usePeople, usePrayerChecks, useDayDoc, useTodayPrayers, usePrayerActions,
} from '@/features/prayers/usePrayers';
import {
  PrayerCheckCard, PrayerListCard, PrayerDetailDialog,
} from '@/features/prayers/PrayerComponents';
import BulkParse from '@/features/prayers/BulkParse';
import { Plus, ClipboardList, Search, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Navigate } from 'react-router-dom';
import { useFaithEnabled } from '@/lib/features';

type Segment = 'today' | 'all' | 'answered' | 'dormant';
const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'today',    label: '오늘' },
  { id: 'all',      label: '전체' },
  { id: 'answered', label: '응답' },
  { id: 'dormant',  label: '잠든' },
];

export default function Prayers() {
  const faithEnabled = useFaithEnabled();
  if (!faithEnabled) return <Navigate to="/" replace />;
  return <PrayersInner />;
}

function PrayersInner() {
  const date = useAppStore((s) => s.currentDate);
  const prayers = usePrayers();
  const people  = usePeople();
  const checks  = usePrayerChecks(date);
  const dayDoc  = useDayDoc(date);
  const { quickAdd } = usePrayerActions();

  const [seg, setSeg] = useState<Segment>('today');
  const [quick, setQuick] = useState('');
  const [lastCat, setLastCat] = useState<PrayerCategory>('other');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selected, setSelected] = useState<PrayerDoc | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (p: PrayerDoc) => { setSelected(p); setDetailOpen(true); };
  // 선택된 기도제목을 최신 데이터로 동기화
  const liveSelected = useMemo(
    () => (selected ? prayers.find((p) => p.id === selected.id) ?? selected : null),
    [selected, prayers]
  );

  const submitQuick = async () => {
    if (!quick.trim()) return;
    await quickAdd({ title: quick, category: lastCat });
    setQuick('');
  };

  return (
    <div className="flex flex-col gap-3 p-4 pb-6">
      {/* 빠른 추가 — 항상 상단 */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2"
      >
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitQuick()}
          placeholder="기도제목 한 줄 빠른 추가…"
          className="min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--sky)]"
        />
        <select
          value={lastCat}
          onChange={(e) => setLastCat(e.target.value as PrayerCategory)}
          className="rounded-[var(--radius)] border border-[var(--border)] bg-white px-2 text-xs text-[var(--fg-muted)] outline-none"
        >
          {(['self','family','church','ministry','friend','other'] as PrayerCategory[]).map((c) => (
            <option key={c} value={c}>{PRAYER_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <button
          onClick={submitQuick}
          className="flex shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--leaf)] px-3 text-white"
          aria-label="추가"
        >
          <Plus size={18} />
        </button>
      </motion.div>

      {/* 세그먼트 + 무더기 진입 */}
      <div className="flex items-center gap-2">
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
          onClick={() => setBulkOpen(true)}
          className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--fg-muted)]"
        >
          <ClipboardList size={14} /> 무더기
        </button>
      </div>

      {/* 본문 */}
      {seg === 'today'    && <TodayView prayers={prayers} dayDoc={dayDoc} checks={checks} onOpen={openDetail} date={date} />}
      {seg === 'all'      && <AllView prayers={prayers} onOpen={openDetail} />}
      {seg === 'answered' && <ListView prayers={prayers.filter((p) => p.status === 'answered')} empty="아직 응답 기록이 없습니다." onOpen={openDetail} />}
      {seg === 'dormant'  && <ListView prayers={prayers.filter((p) => p.status === 'dormant')} empty="잠든 기도가 없습니다." onOpen={openDetail} />}

      <PrayerDetailDialog
        prayer={liveSelected}
        people={people}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <BulkParse open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}

// ── 오늘 화면 ─────────────────────────────────────────────
function TodayView({
  prayers, dayDoc, checks, onOpen, date,
}: {
  prayers: PrayerDoc[];
  dayDoc: ReturnType<typeof useDayDoc>;
  checks: Record<string, { prayerId: string }>;
  onOpen: (p: PrayerDoc) => void;
  date: string;
}) {
  const { checkPrayer, uncheckPrayer } = usePrayerActions();
  const { pinned, rotation } = useTodayPrayers(prayers, dayDoc);

  const all = [...pinned, ...rotation];
  const total = all.length;
  const done = all.filter((p) => checks[p.id]).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (total === 0) {
    return (
      <EmptyState text="오늘 기도할 목록이 비어 있어요. 위에서 기도제목을 추가해보세요. 🙏" />
    );
  }

  return (
    <div className="space-y-3">
      {/* 진행 표시 */}
      <div className="card p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-[var(--fg-primary)]">오늘 {done} / {total} 기도</span>
          <span className="tabular-nums text-[var(--fg-muted)]">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-base)]">
          <motion.div
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

      {pinned.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-medium text-[var(--fg-muted)]">📌 고정</h3>
          {pinned.map((p) => (
            <PrayerCheckCard
              key={p.id} prayer={p} checked={!!checks[p.id]}
              onCheck={() => checkPrayer(p)} onUncheck={() => uncheckPrayer(p.id)}
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
              onCheck={() => checkPrayer(p)} onUncheck={() => uncheckPrayer(p.id)}
              onOpen={() => onOpen(p)}
            />
          ))}
        </section>
      )}

      <GratitudeSection date={date} />
    </div>
  );
}

// ── 전체 (필터·검색·사람칩) ────────────────────────────────
function AllView({ prayers, onOpen }: { prayers: PrayerDoc[]; onOpen: (p: PrayerDoc) => void }) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<PrayerCategory | 'all'>('all');

  const active = prayers.filter((p) => p.status === 'active');
  const filtered = active.filter((p) => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${p.title} ${p.personName} ${(p.tags ?? []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2">
        <Search size={15} className="text-[var(--fg-faint)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제목·대상·태그 검색"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>전체</Chip>
        {(['self','family','church','ministry','friend','other'] as PrayerCategory[]).map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{PRAYER_CATEGORY_LABELS[c]}</Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="조건에 맞는 기도제목이 없습니다." />
      ) : (
        <div className="space-y-2">
          <p className="px-1 text-[11px] text-[var(--fg-faint)]">{filtered.length}개</p>
          {filtered.map((p) => <PrayerListCard key={p.id} prayer={p} onOpen={() => onOpen(p)} />)}
        </div>
      )}
    </div>
  );
}

function ListView({ prayers, empty, onOpen }: { prayers: PrayerDoc[]; empty: string; onOpen: (p: PrayerDoc) => void }) {
  if (prayers.length === 0) return <EmptyState text={empty} />;
  return (
    <div className="space-y-2">
      {prayers.map((p) => <PrayerListCard key={p.id} prayer={p} onOpen={() => onOpen(p)} />)}
    </div>
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
