import {
  collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { InquiryCategory } from 'shared/types/firestore';

/** 앱 공유 링크 (Firebase Hosting 기본 도메인) */
export const APP_SHARE_URL = 'https://planner-web-quick.web.app';

/**
 * 관리자 문의를 생성한다.
 * uid 는 반드시 실제 인증 uid(realUid)여야 한다 — 보안 규칙이 request.auth.uid 와 일치할 것을 요구한다.
 */
export async function submitInquiry(input: {
  uid: string;
  email: string | null;
  displayName: string | null;
  category: InquiryCategory;
  message: string;
}): Promise<void> {
  const ref = doc(collection(db, 'inquiries'));
  await setDoc(ref, {
    id: ref.id,
    uid: input.uid,
    email: input.email ?? null,
    displayName: input.displayName ?? null,
    category: input.category,
    message: input.message.trim(),
    status: 'open',
    reply: null,
    createdAt: serverTimestamp(),
    repliedAt: null,
    repliedBy: null,
  });
}

/** owner 가 문의에 답변한다. */
export async function replyToInquiry(id: string, reply: string, ownerUid: string): Promise<void> {
  await updateDoc(doc(db, 'inquiries', id), {
    reply: reply.trim(),
    status: 'answered',
    repliedAt: serverTimestamp(),
    repliedBy: ownerUid,
  });
}

/** owner 가 문의를 삭제한다. */
export async function deleteInquiry(id: string): Promise<void> {
  await deleteDoc(doc(db, 'inquiries', id));
}
