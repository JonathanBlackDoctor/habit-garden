import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { submitInquiry } from '@/lib/inquiries';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { INQUIRY_CATEGORY_LABELS } from 'shared/types/firestore';
import type { InquiryCategory, InquiryDoc } from 'shared/types/firestore';
import { MessageCircle, CornerDownRight } from 'lucide-react';

const CATEGORIES: InquiryCategory[] = ['bug', 'question', 'etc'];

export default function ContactDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  // 문의 작성·조회는 실제 인증 uid(realUid)로 한다 — 보안 규칙이 request.auth.uid 일치를 요구.
  const realUid = useAppStore((s) => s.realUid);
  const user = useAppStore((s) => s.user);
  const [category, setCategory] = useState<InquiryCategory>('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mine, setMine] = useState<InquiryDoc[]>([]);

  useEffect(() => {
    if (!realUid || !open) return;
    return onSnapshot(
      query(collection(db, 'inquiries'), where('uid', '==', realUid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as InquiryDoc);
        list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setMine(list);
      },
      () => { /* 권한·네트워크 오류는 무시 (목록만 비움) */ },
    );
  }, [realUid, open]);

  const send = async () => {
    if (!realUid || submitting) return;
    const text = message.trim();
    if (text.length < 5) {
      toast.error('5자 이상 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await submitInquiry({
        uid: realUid,
        email: user?.email ?? null,
        displayName: user?.displayName ?? null,
        category,
        message: text,
      });
      setMessage('');
      toast.success('문의를 보냈어요. 답변이 오면 여기서 확인할 수 있어요.');
    } catch (e: any) {
      toast.error(`전송 실패: ${e?.message ?? '오류'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle size={18} className="text-[var(--leaf)]" />
            관리자에게 문의
          </DialogTitle>
        </DialogHeader>

        <p className="mt-1 text-xs text-[var(--fg-muted)]">
          버그나 문의사항을 남겨주세요. 관리자가 확인 후 답변을 보내드려요.
        </p>

        {/* 분류 선택 */}
        <div className="mt-3 flex gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`flex-1 rounded-[var(--radius-sm)] px-2 py-2 text-xs font-medium transition-colors ${
                category === c
                  ? 'bg-[var(--leaf)] text-white'
                  : 'bg-[var(--bg-base)] text-[var(--fg-muted)]'
              }`}
            >
              {INQUIRY_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="내용을 입력하세요…"
          maxLength={1000}
          className="mt-3 w-full resize-none rounded-[var(--radius-sm)] border border-[var(--leaf-soft)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--leaf)]"
        />

        <Button onClick={send} disabled={submitting} className="mt-2 w-full gap-2">
          <MessageCircle size={15} />
          {submitting ? '보내는 중…' : '문의 보내기'}
        </Button>

        {/* 내가 보낸 문의 + 답변 */}
        {mine.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-[11px] font-medium text-[var(--fg-faint)]">내 문의 내역</p>
            {mine.map((q) => (
              <div key={q.id} className="rounded-[var(--radius-sm)] bg-[var(--bg-base)] p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--leaf-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--leaf)]">
                    {INQUIRY_CATEGORY_LABELS[q.category]}
                  </span>
                  <span className={`text-[10px] font-medium ${
                    q.status === 'answered' ? 'text-[var(--leaf)]' : 'text-[var(--fg-faint)]'
                  }`}>
                    {q.status === 'answered' ? '답변 완료' : '답변 대기'}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--fg-primary)]">{q.message}</p>
                {q.reply && (
                  <div className="mt-2 flex gap-1.5 rounded-[var(--radius-sm)] bg-[var(--leaf-soft)] p-2">
                    <CornerDownRight size={14} className="mt-0.5 shrink-0 text-[var(--leaf)]" />
                    <p className="whitespace-pre-wrap text-sm text-[var(--fg-primary)]">{q.reply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
