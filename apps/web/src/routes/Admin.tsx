import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, updateDoc, deleteDoc, doc, setDoc, getDocs,
  serverTimestamp, query, orderBy, where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
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
import { useIsPremium } from '@/lib/features';
import NotificationStatsCard from '@/features/notifications/NotificationStatsCard';

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
  const [botSetup, setBotSetup] = useState(false);
  const [botInfo, setBotInfo] = useState<{ botUsername: string | null; webhookUrl: string; lastErrorMessage: string | null } | null>(null);
  const showAdminControls = isOwner(realUid);
  const isPremium = useIsPremium();

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

  /**
   * 텔레그램 웹훅·명령 메뉴 등록. 봇 토큰이 서버 시크릿에만 있으므로
   * 로컬 스크립트 대신 owner 가 여기서 한 번 눌러 실행한다.
   */
  const runBotSetup = async () => {
    if (botSetup) return;
    setBotSetup(true);
    try {
      const fn = httpsCallable<unknown, {
        botUsername: string | null; webhookUrl: string; lastErrorMessage: string | null;
      }>(functions, 'setupTelegramBot');
      const { data } = await fn({});
      setBotInfo(data);
      toast.success(data.botUsername ? `@${data.botUsername} 웹훅을 등록했어요` : '웹훅을 등록했어요');
    } catch (e: any) {
      toast.error(e?.message ?? '봇 설정에 실패했어요');
    } finally {
      setBotSetup(false);
    }
  };

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
      toast(`✅ 기본 습관 ${n}개를 추가했습니다!`);
    } catch (e) {
      toast.error('기본 습관 추가 실패');
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
      toast(`🙏 기본 기도제목 ${SEED_PRAYERS.length}개를 추가했습니다!`);
    } catch {
      toast.error('기본 기도제목 추가 실패');
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
        <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-[var(--fg-primary)]">관리</h2>
      </div>

      {/* 알림 통계 (전달/오픈 트래킹) — 본인 데이터 */}
      {isPremium && <NotificationStatsCard />}

      {/* 사용자 승인 (owner 전용) */}
      {showAdminControls && (
        <section className="card-flat p-4 space-y-3">
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
        <section className="card-flat p-4 space-y-3">
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

      {/* 텔레그램 봇 (owner 전용) */}
      {showAdminControls && (
        <section className="card-flat p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Send size={16} className="text-[var(--leaf)]" />
            <h3 className="text-sm font-medium text-[var(--fg-primary)]">텔레그램 봇</h3>
          </div>
          <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
            봇 웹훅과 명령 메뉴를 등록합니다. <code>TELEGRAM_BOT_TOKEN</code>·
            <code>TELEGRAM_WEBHOOK_SECRET</code> 시크릿을 설정한 뒤 한 번만 누르면 되고,
            봇 토큰을 바꾸면 다시 눌러주세요.
          </p>
          <Button onClick={runBotSetup} disabled={botSetup} className="w-full">
            {botSetup ? '등록 중…' : '웹훅·명령 등록'}
          </Button>
          {botInfo && (
            <div className="space-y-1 rounded-md bg-[var(--bg-base)] p-3 text-[11px] text-[var(--fg-muted)]">
              <p>봇: {botInfo.botUsername ? `@${botInfo.botUsername}` : '이름 없음'}</p>
              <p className="break-all">웹훅: {botInfo.webhookUrl}</p>
              {botInfo.lastErrorMessage && (
                <p className="text-[var(--bloom)]">최근 오류: {botInfo.lastErrorMessage}</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* 개발자 테스트 (owner 전용) */}
      {showAdminControls && (
        <section className="card-flat p-4 space-y-3">
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

          {sandbox && (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-600">
              현재 테스트 공간입니다. 실제 데이터는 그대로 보존됩니다.
            </p>
          )}
        </section>
      )}

      {/* 기본 습관 */}
      <section className="card-flat p-4 space-y-3">
        <h3 className="text-sm font-medium text-[var(--fg-primary)]">기본 데이터</h3>
        <p className="text-xs text-[var(--fg-muted)]">
          기본 습관 8개를 처음 추가합니다. 이미 추가된 경우 중복됩니다.
        </p>
        <Button
          onClick={seedHabits}
          disabled={seeding}
          variant="secondary"
          className="w-full gap-2"
        >
          <Leaf size={15} />
          {seeding ? '추가 중…' : '기본 습관 8개 추가'}
        </Button>
        <Button
          onClick={seedPrayers}
          disabled={prayerSeeding}
          variant="secondary"
          className="w-full gap-2"
        >
          <HandHeart size={15} />
          {prayerSeeding ? '추가 중…' : `기본 기도제목 ${SEED_PRAYERS.length}개 추가`}
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
          <p className="text-sm text-[var(--fg-faint)] text-center py-8">습관이 없습니다. 기본 습관을 추가해보세요.</p>
        )}
        {habits.map((habit) => (
          <div key={habit.id} className="card-flat p-3 flex items-center gap-3">
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
