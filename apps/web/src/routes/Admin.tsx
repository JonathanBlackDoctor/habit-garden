import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, updateDoc, deleteDoc, doc, setDoc, getDocs,
  serverTimestamp, query, orderBy, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { SEED_PRAYERS, INQUIRY_CATEGORY_LABELS } from 'shared/types/firestore';
import type { HabitDoc, UserProfileDoc, InquiryDoc } from 'shared/types/firestore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft, Trash2, Leaf, HandHeart, Check, X, FlaskConical, MessageCircle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { isOwner } from '@/lib/auth';
import { replyToInquiry, deleteInquiry } from '@/lib/inquiries';
import { seedDefaultHabits } from '@/lib/seed';
import { useProgress } from '@/features/garden/useGarden';

export default function Admin() {
  const uid = useAppStore((s) => s.uid);          // 데이터 경로용 유효 uid (샌드박스면 sandbox 네임스페이스)
  const realUid = useAppStore((s) => s.realUid);  // owner 판별용 실제 인증 uid
  const sandbox = useAppStore((s) => s.sandbox);
  const setSandbox = useAppStore((s) => s.setSandbox);
  const navigate = useNavigate();
  const [habits, setHabits] = useState<HabitDoc[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [prayerSeeding, setPrayerSeeding] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [pending, setPending] = useState<UserProfileDoc[]>([]);
  const [approved, setApproved] = useState<UserProfileDoc[]>([]);
  const [actingUid, setActingUid] = useState<string | null>(null);
  const [inquiries, setInquiries] = useState<InquiryDoc[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const showAdminControls = isOwner(realUid);

  // ── 개발자 테스트 (owner 전용): 포인트·경험치 자유 조절 ──
  const progress = useProgress();
  const [devFields, setDevFields] = useState({
    totalPoints: '', spendablePoints: '', level: '', xpInLevel: '',
  });
  // progress 가 로드되거나 모드(sandbox)가 바뀔 때 입력칸을 현재값으로 채운다.
  const [devLoaded, setDevLoaded] = useState(false);
  useEffect(() => { setDevLoaded(false); }, [sandbox]); // 모드 전환 시 재적재
  useEffect(() => {
    if (devLoaded || !progress) return;
    setDevFields({
      totalPoints:     String(progress.totalPoints ?? 0),
      spendablePoints: String(progress.spendablePoints ?? 0),
      level:           String(progress.level ?? 0),
      xpInLevel:       String(progress.xpInLevel ?? 0),
    });
    setDevLoaded(true);
  }, [progress, devLoaded]);

  // 포인트·경험치 편집은 실제 데이터 보호를 위해 샌드박스 모드에서만 허용한다.
  const canEditProgress = isOwner(realUid) && sandbox;

  const applyDevProgress = async () => {
    if (!uid || !canEditProgress) return;
    const parsed = {
      totalPoints:     Number(devFields.totalPoints),
      spendablePoints: Number(devFields.spendablePoints),
      level:           Number(devFields.level),
      xpInLevel:       Number(devFields.xpInLevel),
    };
    if (Object.values(parsed).some((n) => !Number.isFinite(n))) {
      toast.error('숫자만 입력하세요.');
      return;
    }
    try {
      await setDoc(doc(db, 'users', uid, 'progress', 'main'), {
        ...parsed,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast('🧪 포인트·경험치를 적용했습니다.');
    } catch (e: any) {
      toast.error(`적용 실패: ${e?.message ?? '오류'}`);
    }
  };

  // 빠른 가감: 보유 포인트(spendable)와 누적 포인트(total)를 함께 증감
  const bumpPoints = async (delta: number) => {
    if (!uid || !canEditProgress) return;
    const total = Math.max(0, (progress?.totalPoints ?? 0) + delta);
    const spend = Math.max(0, (progress?.spendablePoints ?? 0) + delta);
    try {
      await setDoc(doc(db, 'users', uid, 'progress', 'main'), {
        totalPoints: total, spendablePoints: spend, updatedAt: serverTimestamp(),
      }, { merge: true });
      setDevFields((f) => ({ ...f, totalPoints: String(total), spendablePoints: String(spend) }));
    } catch (e: any) {
      toast.error(`처리 실패: ${e?.message ?? '오류'}`);
    }
  };

  const bumpLevel = async (delta: number) => {
    if (!uid || !canEditProgress) return;
    const level = Math.max(0, (progress?.level ?? 0) + delta);
    try {
      await setDoc(doc(db, 'users', uid, 'progress', 'main'), {
        level, updatedAt: serverTimestamp(),
      }, { merge: true });
      setDevFields((f) => ({ ...f, level: String(level) }));
    } catch (e: any) {
      toast.error(`처리 실패: ${e?.message ?? '오류'}`);
    }
  };

  useEffect(() => {
    if (!showAdminControls) return;
    const unsubPending = onSnapshot(
      query(collection(db, 'userProfiles'), where('status', '==', 'pending')),
      (snap) => setPending(snap.docs.map((d) => d.data() as UserProfileDoc)),
    );
    const unsubApproved = onSnapshot(
      query(collection(db, 'userProfiles'), where('status', '==', 'approved')),
      (snap) => setApproved(snap.docs.map((d) => d.data() as UserProfileDoc)),
    );
    const unsubInquiries = onSnapshot(
      query(collection(db, 'inquiries'), orderBy('createdAt', 'desc')),
      (snap) => setInquiries(snap.docs.map((d) => d.data() as InquiryDoc)),
    );
    return () => { unsubPending(); unsubApproved(); unsubInquiries(); };
  }, [showAdminControls]);

  const sendReply = async (id: string) => {
    if (replyingId) return;
    const text = (replyDrafts[id] ?? '').trim();
    if (!text) { toast.error('답변을 입력하세요.'); return; }
    setReplyingId(id);
    try {
      await replyToInquiry(id, text, realUid!);
      setReplyDrafts((d) => ({ ...d, [id]: '' }));
      toast('✅ 답변을 보냈습니다.');
    } catch (e: any) {
      toast.error(`전송 실패: ${e?.message ?? '오류'}`);
    } finally {
      setReplyingId(null);
    }
  };

  const removeInquiry = async (id: string) => {
    if (!confirm('이 문의를 삭제하시겠습니까?')) return;
    try {
      await deleteInquiry(id);
      toast('문의를 삭제했습니다.');
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.message ?? '오류'}`);
    }
  };

  const decide = async (targetUid: string, action: 'approve' | 'reject') => {
    if (actingUid) return;
    setActingUid(targetUid);
    try {
      await updateDoc(doc(db, 'userProfiles', targetUid), {
        status: action === 'approve' ? 'approved' : 'rejected',
        approvedAt: serverTimestamp(),
        approvedBy: uid,
      });
      toast(action === 'approve' ? '✅ 승인했습니다.' : '🚫 거절했습니다.');
    } catch (e: any) {
      toast.error(`처리 실패: ${e?.message ?? '오류'}`);
    } finally {
      setActingUid(null);
    }
  };

  const revoke = async (targetUid: string) => {
    if (actingUid) return;
    if (!confirm('이 사용자의 접근을 거절(차단)하시겠습니까?')) return;
    setActingUid(targetUid);
    try {
      await updateDoc(doc(db, 'userProfiles', targetUid), {
        status: 'rejected',
        approvedAt: serverTimestamp(),
        approvedBy: uid,
      });
      toast('🚫 접근을 차단했습니다.');
    } catch (e: any) {
      toast.error(`처리 실패: ${e?.message ?? '오류'}`);
    } finally {
      setActingUid(null);
    }
  };

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'habits'), orderBy('order'));
    return onSnapshot(q, (snap) => {
      setHabits(snap.docs.map((d) => d.data() as HabitDoc));
    });
  }, [uid]);

  const seedHabits = async () => {
    if (!uid || seeding) return;
    setSeeding(true);
    try {
      const n = await seedDefaultHabits(uid);
      toast(`✅ 시드 습관 ${n}개를 추가했습니다!`);
    } catch (e) {
      toast.error('시드 추가 실패');
    } finally {
      setSeeding(false);
    }
  };

  const seedPrayers = async () => {
    if (!uid || prayerSeeding) return;
    setPrayerSeeding(true);
    try {
      for (const seed of SEED_PRAYERS) {
        const ref = doc(collection(db, 'users', uid, 'prayers'));
        const now = serverTimestamp();
        await setDoc(ref, {
          id: ref.id,
          group: seed.group,
          target: seed.target,
          receivedAt: now,
          title: seed.title,
          body: seed.body,
          priority: seed.priority,
          pinned: seed.pinned ?? false,
          status: 'active',
          prayCount: 0,
          streak: 0,
          source: 'manual',
          createdAt: now,
          updatedAt: now,
        });
      }
      toast(`🙏 시드 기도제목 ${SEED_PRAYERS.length}개를 추가했습니다!`);
    } catch {
      toast.error('기도 시드 추가 실패');
    } finally {
      setPrayerSeeding(false);
    }
  };

  // 기존 PrayerDoc(category/personName, …) → 신규 스키마(group) 변환
  const migratePrayers = async () => {
    if (!uid || migrating) return;
    setMigrating(true);
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'prayers'));
      const catToGroup = (c?: string) => (c === 'church' ? '교회' : c === 'ministry' ? 'CMF' : '개인');
      let migrated = 0;
      for (const d of snap.docs) {
        const data = d.data() as any;
        if (data.group && data.target) continue; // 이미 신규 스키마(모임+대상)
        const now = serverTimestamp();
        await setDoc(d.ref, {
          id: d.id,
          group: catToGroup(data.category),
          target: data.target ?? data.personName ?? '나 자신',
          receivedAt: data.receivedAt ?? data.createdAt ?? now,
          title: data.title ?? '(제목 없음)',
          body: data.body,
          priority: data.priority ?? 'mid',
          pinned: data.pinned ?? false,
          status: data.status ?? (data.active === false ? 'dormant' : 'active'),
          prayCount: data.prayCount ?? 0,
          streak: data.streak ?? 0,
          rotationDays: data.rotationDays,
          source: data.source ?? 'manual',
          createdAt: data.createdAt ?? now,
          updatedAt: now,
        }, { merge: true });
        migrated++;
      }
      toast(migrated > 0 ? `✅ 기도제목 ${migrated}건 마이그레이션 완료` : '변환할 구형 데이터가 없습니다.');
    } catch {
      toast.error('마이그레이션 실패');
    } finally {
      setMigrating(false);
    }
  };

  const toggleActive = async (habit: HabitDoc) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'habits', habit.id), {
      active: !habit.active,
    });
  };

  const deleteHabit = async (id: string) => {
    if (!uid) return;
    if (!confirm('이 습관을 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'users', uid, 'habits', id));
  };

  return (
    <div
      className="min-h-dvh bg-[var(--bg-base)] p-4 space-y-4 pb-8"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">관리</h2>
      </div>

      {/* 사용자 승인 (owner 전용) */}
      {showAdminControls && (
        <section className="card p-4 space-y-3">
          <h3 className="text-sm font-medium text-[var(--fg-primary)]">
            대기 중인 사용자 ({pending.length})
          </h3>
          {pending.length === 0 ? (
            <p className="text-xs text-[var(--fg-faint)]">대기 중인 가입자가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((p) => (
                <div key={p.uid} className="flex items-center gap-3 rounded-md bg-[var(--bg-base)] p-2">
                  {p.photoURL ? (
                    <img src={p.photoURL} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-[var(--leaf-soft)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--fg-primary)]">
                      {p.displayName ?? '(이름 없음)'}
                    </p>
                    <p className="truncate text-[10px] text-[var(--fg-muted)]">{p.email}</p>
                  </div>
                  <button
                    disabled={actingUid === p.uid}
                    onClick={() => decide(p.uid, 'approve')}
                    className="flex items-center gap-1 rounded-md bg-[var(--leaf)] px-2 py-1 text-xs text-white disabled:opacity-40"
                  >
                    <Check size={12} /> 승인
                  </button>
                  <button
                    disabled={actingUid === p.uid}
                    onClick={() => decide(p.uid, 'reject')}
                    className="flex items-center gap-1 rounded-md bg-red-500/90 px-2 py-1 text-xs text-white disabled:opacity-40"
                  >
                    <X size={12} /> 거절
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2">
            <h3 className="text-sm font-medium text-[var(--fg-primary)]">
              승인된 사용자 ({approved.length})
            </h3>
            <div className="mt-2 space-y-1">
              {approved.map((p) => (
                <div key={p.uid} className="flex items-center gap-2 rounded-md bg-[var(--bg-base)] p-2">
                  {p.photoURL ? (
                    <img src={p.photoURL} alt="" className="h-6 w-6 rounded-full" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-[var(--leaf-soft)]" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--fg-primary)]">
                    {p.displayName ?? p.email}
                    {p.isOwner && <span className="ml-1 text-[10px] text-[var(--leaf)]">owner</span>}
                  </span>
                  {!p.isOwner && (
                    <button
                      disabled={actingUid === p.uid}
                      onClick={() => revoke(p.uid)}
                      className="text-[10px] text-red-400 disabled:opacity-40"
                    >
                      차단
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 문의 / 버그 신고 (owner 전용) */}
      {showAdminControls && (
        <section className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-[var(--leaf)]" />
            <h3 className="text-sm font-medium text-[var(--fg-primary)]">
              문의 · 버그 신고 ({inquiries.filter((q) => q.status === 'open').length} 대기)
            </h3>
          </div>
          {inquiries.length === 0 ? (
            <p className="text-xs text-[var(--fg-faint)]">접수된 문의가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {inquiries.map((q) => (
                <div key={q.id} className="rounded-md bg-[var(--bg-base)] p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--leaf-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--leaf)]">
                      {INQUIRY_CATEGORY_LABELS[q.category]}
                    </span>
                    <span className={`text-[10px] font-medium ${
                      q.status === 'answered' ? 'text-[var(--leaf)]' : 'text-[var(--bloom)]'
                    }`}>
                      {q.status === 'answered' ? '답변 완료' : '답변 대기'}
                    </span>
                    <span className="ml-auto truncate text-[10px] text-[var(--fg-faint)]">
                      {q.displayName ?? q.email ?? '익명'}
                    </span>
                    <button
                      onClick={() => removeInquiry(q.id)}
                      className="text-red-400 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-[var(--fg-primary)]">{q.message}</p>
                  {q.reply && (
                    <p className="whitespace-pre-wrap rounded-md bg-[var(--leaf-soft)] p-2 text-xs text-[var(--fg-primary)]">
                      ↳ {q.reply}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      value={replyDrafts[q.id] ?? ''}
                      onChange={(e) => setReplyDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                      placeholder={q.status === 'answered' ? '답변 수정…' : '답변 입력…'}
                      className="min-w-0 flex-1 rounded-md border border-[var(--leaf-soft)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm text-[var(--fg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--leaf)]"
                    />
                    <button
                      disabled={replyingId === q.id}
                      onClick={() => sendReply(q.id)}
                      className="flex items-center gap-1 rounded-md bg-[var(--leaf)] px-2.5 py-1.5 text-xs text-white disabled:opacity-40"
                    >
                      <Send size={12} /> 전송
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 개발자 테스트 (owner 전용) */}
      {showAdminControls && (
        <section className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-[var(--bloom)]" />
            <h3 className="text-sm font-medium text-[var(--fg-primary)]">개발자 테스트</h3>
          </div>

          {/* 샌드박스 모드 토글 */}
          <div className="flex items-center justify-between gap-3 rounded-md bg-[var(--bg-base)] p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--fg-primary)]">테스트(샌드박스) 모드</p>
              <p className="text-[11px] leading-snug text-[var(--fg-muted)]">
                켜면 앱 전체가 <b>별도 테스트 공간</b>의 데이터를 사용합니다. 실제 데이터는 그대로 보존됩니다.
              </p>
            </div>
            <Switch checked={sandbox} onCheckedChange={setSandbox} />
          </div>

          {sandbox ? (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-600">
              🧪 현재 테스트 공간입니다. 아래 조절은 테스트 데이터에만 적용됩니다.
            </p>
          ) : (
            <p className="text-[11px] text-[var(--fg-muted)]">
              실제 데이터 보호를 위해, 포인트·경험치 조절은 테스트 모드를 켜야 사용할 수 있습니다.
            </p>
          )}

          {sandbox && (
            <>
              {/* 빠른 가감 */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--fg-muted)]">포인트 빠른 조절</p>
                <div className="grid grid-cols-4 gap-2">
                  <Button variant="secondary" className="px-0 text-xs" onClick={() => bumpPoints(100)}>+100</Button>
                  <Button variant="secondary" className="px-0 text-xs" onClick={() => bumpPoints(1000)}>+1000</Button>
                  <Button variant="secondary" className="px-0 text-xs" onClick={() => bumpPoints(-100)}>-100</Button>
                  <Button variant="secondary" className="px-0 text-xs" onClick={() => bumpPoints(-1000)}>-1000</Button>
                </div>
                <p className="text-xs font-medium text-[var(--fg-muted)]">레벨 빠른 조절</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" className="px-0 text-xs" onClick={() => bumpLevel(1)}>레벨 +1</Button>
                  <Button variant="secondary" className="px-0 text-xs" onClick={() => bumpLevel(-1)}>레벨 -1</Button>
                </div>
              </div>

              {/* 직접 입력 */}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-[var(--fg-muted)]">직접 입력 후 적용</p>
                {([
                  ['보유 포인트 (spendable)', 'spendablePoints'],
                  ['누적 포인트 (total)',     'totalPoints'],
                  ['레벨 (level)',            'level'],
                  ['레벨 내 경험치 (xp)',     'xpInLevel'],
                ] as const).map(([label, key]) => (
                  <label key={key} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--fg-primary)]">{label}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={devFields[key]}
                      onChange={(e) => setDevFields((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-28 rounded-md border border-[var(--leaf-soft)] bg-[var(--bg-base)] px-2 py-1 text-right text-sm text-[var(--fg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--bloom)]"
                    />
                  </label>
                ))}
                <Button onClick={applyDevProgress} className="w-full gap-2">
                  <FlaskConical size={15} />
                  입력값 적용
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {/* 시드 습관 */}
      <section className="card p-4 space-y-3">
        <h3 className="text-sm font-medium text-[var(--fg-primary)]">시드 데이터</h3>
        <p className="text-xs text-[var(--fg-muted)]">
          시드 습관 8개를 처음 추가합니다. 이미 추가된 경우 중복됩니다.
        </p>
        <Button
          onClick={seedHabits}
          disabled={seeding}
          variant="secondary"
          className="w-full gap-2"
        >
          <Leaf size={15} />
          {seeding ? '추가 중…' : '시드 습관 8개 추가'}
        </Button>
        <Button
          onClick={seedPrayers}
          disabled={prayerSeeding}
          variant="secondary"
          className="w-full gap-2"
        >
          <HandHeart size={15} />
          {prayerSeeding ? '추가 중…' : `시드 기도제목 ${SEED_PRAYERS.length}개 추가`}
        </Button>
        <Button
          onClick={migratePrayers}
          disabled={migrating}
          variant="ghost"
          className="w-full gap-2"
        >
          {migrating ? '변환 중…' : '기도제목 스키마 마이그레이션'}
        </Button>
      </section>

      {/* 습관 목록 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--fg-primary)]">습관 목록 ({habits.length})</h3>
        </div>
        {habits.length === 0 && (
          <p className="text-sm text-[var(--fg-faint)] text-center py-8">습관이 없습니다. 시드를 추가해보세요.</p>
        )}
        {habits.map((habit) => (
          <div key={habit.id} className="card p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--fg-primary)] truncate">{habit.title}</p>
              <p className="text-xs text-[var(--fg-muted)]">
                W{habit.weight} · {habit.scoreMode} · {habit.timeOfDay}
              </p>
            </div>
            <Switch
              checked={habit.active}
              onCheckedChange={() => toggleActive(habit)}
            />
            <button
              onClick={() => deleteHabit(habit.id)}
              className="text-red-400 hover:text-red-500 p-1"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
