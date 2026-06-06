import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Bell, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { isOwner } from '@/lib/auth';

/**
 * owner 전용 인앱 알림 배너.
 * 새 가입 신청(pending)·새 문의(open)가 있으면 모든 탭 위에 작게 떠 있으며,
 * owner 가 직접 닫기(X) 전까지 사라지지 않는다. 닫은 뒤 새 항목이 들어오면 다시 나타난다.
 * 본문을 탭하면 관리(/admin) 화면으로 이동한다.
 */
export default function OwnerAlertBanner() {
  const realUid = useAppStore((s) => s.realUid);
  const navigate = useNavigate();
  const owner = isOwner(realUid);

  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [openInquiryIds, setOpenInquiryIds] = useState<string[]>([]);
  const [dismissedSig, setDismissedSig] = useState<string | null>(null);

  useEffect(() => {
    if (!owner) return;
    const unsubPending = onSnapshot(
      query(collection(db, 'userProfiles'), where('status', '==', 'pending')),
      (snap) => setPendingIds(snap.docs.map((d) => d.id)),
      () => { /* 무시 */ },
    );
    const unsubInquiries = onSnapshot(
      query(collection(db, 'inquiries'), where('status', '==', 'open')),
      (snap) => setOpenInquiryIds(snap.docs.map((d) => d.id)),
      () => { /* 무시 */ },
    );
    return () => { unsubPending(); unsubInquiries(); };
  }, [owner]);

  if (!owner) return null;

  const pendingCount = pendingIds.length;
  const inquiryCount = openInquiryIds.length;
  if (pendingCount + inquiryCount === 0) return null;

  // 현재 알림 대상 집합의 서명. 항목이 바뀌면(추가/변경) 닫았어도 다시 노출된다.
  const sig =
    [...pendingIds].sort().join(',') + '|' + [...openInquiryIds].sort().join(',');
  if (sig === dismissedSig) return null;

  const parts: string[] = [];
  if (pendingCount > 0) parts.push(`가입 신청 ${pendingCount}건`);
  if (inquiryCount > 0) parts.push(`새 문의 ${inquiryCount}건`);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[95] mx-auto flex max-w-[480px] items-center gap-2 bg-[var(--leaf)] px-3 text-white shadow-md"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)', paddingBottom: '6px' }}
    >
      <button
        onClick={() => navigate('/admin')}
        className="flex min-w-0 flex-1 items-center gap-2 text-left active:opacity-80"
      >
        <Bell size={15} className="shrink-0 animate-pulse" />
        <span className="truncate text-[12px] font-semibold">
          {parts.join(' · ')} — 탭하여 확인
        </span>
      </button>
      <button
        onClick={() => setDismissedSig(sig)}
        aria-label="알림 닫기"
        className="shrink-0 rounded-full p-1 active:opacity-70"
      >
        <X size={15} />
      </button>
    </div>
  );
}
