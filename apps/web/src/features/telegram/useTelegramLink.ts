import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { TelegramUserDoc } from 'shared/types/firestore';

/** 봇 username — 딥링크(t.me/<bot>?start=<code>)에 쓴다. 공개값이라 .env 에 둔다. */
export const BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined) ?? '';

export interface LinkCode {
  code: string;
  expiresAtMs: number;
}

/**
 * 텔레그램 연결 상태 구독 + 코드 발급/해제.
 * 연결 문서는 서버(Cloud Functions)만 쓸 수 있어서(firestore.rules) 변경은 전부 callable 로 간다.
 */
export function useTelegramLink() {
  const uid = useAppStore((s) => s.uid);
  const [link, setLink] = useState<TelegramUserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) { setLink(null); setLoading(false); return; }
    return onSnapshot(
      doc(db, 'telegramUsers', uid),
      (snap) => { setLink(snap.exists() ? (snap.data() as TelegramUserDoc) : null); setLoading(false); },
      () => { setLink(null); setLoading(false); },
    );
  }, [uid]);

  const createCode = async (): Promise<LinkCode> => {
    setBusy(true);
    try {
      const fn = httpsCallable<unknown, LinkCode>(functions, 'createTelegramLinkCode');
      return (await fn({})).data;
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (): Promise<void> => {
    setBusy(true);
    try {
      await httpsCallable(functions, 'unlinkTelegram')({});
    } finally {
      setBusy(false);
    }
  };

  return { link, linked: !!link, loading, busy, createCode, unlink };
}

/** t.me 딥링크 — 누르면 텔레그램이 열리고 /start <code> 가 자동 전송된다. */
export function deepLink(code: string): string | null {
  return BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?start=${code}` : null;
}
