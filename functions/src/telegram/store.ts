/**
 * 텔레그램 연동 Firestore 접근 계층.
 * 연결 정보는 최상위 telegramLinks / telegramUsers / telegramLinkCodes 에만 두고,
 * 쓰기는 전부 여기(Admin SDK)를 통해서만 일어난다. 클라이언트 쓰기는 규칙으로 막혀 있다.
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  TelegramLinkDoc, TelegramUserDoc, TelegramLinkCodeDoc, TelegramSessionDoc,
} from '../../../shared/types/firestore';
import { TELEGRAM_LINK_CODE_TTL_MIN } from '../../../shared/types/firestore';
import type { ReflectionSession } from '../../../shared/lib/telegram';

const db = admin.firestore();

// 0/O, 1/I 처럼 눈으로 헷갈리는 문자는 뺀다 — 코드를 손으로 옮겨 적는 경우가 많다.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// ── 연결 코드 ───────────────────────────────────────────────────────────────
/**
 * 앱에서 1회용 코드를 발급한다. 같은 사용자의 이전 코드는 먼저 지운다 —
 * 앞서 받은 코드가 계속 살아 있으면 화면에 없는 코드로도 연결이 되기 때문이다.
 * (uid 단일 등호 조회라 복합 인덱스가 필요 없다.)
 */
export async function issueLinkCode(uid: string): Promise<{ code: string; expiresAtMs: number }> {
  const stale = await db.collection('telegramLinkCodes').where('uid', '==', uid).get();
  await Promise.all(stale.docs.map((d) => d.ref.delete().catch(() => undefined)));

  const expiresAtMs = Date.now() + TELEGRAM_LINK_CODE_TTL_MIN * 60 * 1000;

  // 희박하지만 코드가 겹칠 수 있으므로 create() 로 몇 번 재시도한다.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      await db.doc(`telegramLinkCodes/${code}`).create({
        code,
        uid,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
        usedAt: null,
      });
      return { code, expiresAtMs };
    } catch {
      // 이미 쓰이는 코드 — 다시 뽑는다
    }
  }
  throw new Error('failed to allocate telegram link code');
}

export type ConsumeResult =
  | { ok: true; uid: string }
  | { ok: false; reason: 'unknown' | 'expired' | 'used' };

/** `/start <code>` 처리 — 코드를 소모하고 uid 를 돌려준다. */
export async function consumeLinkCode(rawCode: string): Promise<ConsumeResult> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return { ok: false, reason: 'unknown' };

  const ref = db.doc(`telegramLinkCodes/${code}`);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: 'unknown' };

  const doc = snap.data() as TelegramLinkCodeDoc;
  if (doc.usedAt) return { ok: false, reason: 'used' };
  if ((doc.expiresAt as any)?.toMillis?.() < Date.now()) return { ok: false, reason: 'expired' };

  await ref.update({ usedAt: FieldValue.serverTimestamp() });
  return { ok: true, uid: doc.uid };
}

// ── 연결 ────────────────────────────────────────────────────────────────────
export async function getLinkByChatId(chatId: string): Promise<TelegramLinkDoc | null> {
  const snap = await db.doc(`telegramLinks/${chatId}`).get();
  return snap.exists ? (snap.data() as TelegramLinkDoc) : null;
}

export async function getChatIdForUid(uid: string): Promise<string | null> {
  const snap = await db.doc(`telegramUsers/${uid}`).get();
  return snap.exists ? (snap.data() as TelegramUserDoc).chatId : null;
}

/**
 * chatId ↔ uid 를 양방향으로 묶는다.
 * 같은 chat 이 다른 계정에 물려 있었거나 같은 계정이 다른 chat 에 물려 있었다면
 * 이전 연결을 지운다 — 한 사람이 여러 계정 데이터를 섞어 보는 일을 막는다.
 */
export async function linkAccount(
  uid: string,
  chatId: string,
  telegram: { id: number; username?: string; first_name?: string },
): Promise<void> {
  const batch = db.batch();

  const prevForChat = await getLinkByChatId(chatId);
  if (prevForChat && prevForChat.uid !== uid) {
    batch.delete(db.doc(`telegramUsers/${prevForChat.uid}`));
  }
  const prevChatId = await getChatIdForUid(uid);
  if (prevChatId && prevChatId !== chatId) {
    batch.delete(db.doc(`telegramLinks/${prevChatId}`));
  }

  const now = FieldValue.serverTimestamp();
  batch.set(db.doc(`telegramLinks/${chatId}`), {
    chatId,
    uid,
    telegramUserId: telegram.id,
    username: telegram.username ?? null,
    firstName: telegram.first_name ?? null,
    linkedAt: now,
    lastSeenAt: now,
  });
  batch.set(db.doc(`telegramUsers/${uid}`), {
    uid,
    chatId,
    username: telegram.username ?? null,
    firstName: telegram.first_name ?? null,
    linkedAt: now,
  });
  await batch.commit();
}

/** uid 또는 chatId 어느 쪽으로도 해제할 수 있게 한다 (앱의 해제 버튼 / 봇의 /unlink). */
export async function unlinkAccount(opts: { uid?: string; chatId?: string }): Promise<boolean> {
  const chatId = opts.chatId ?? (opts.uid ? await getChatIdForUid(opts.uid) : null);
  const uid = opts.uid ?? (chatId ? (await getLinkByChatId(chatId))?.uid ?? null : null);
  if (!chatId && !uid) return false;

  const batch = db.batch();
  if (chatId) batch.delete(db.doc(`telegramLinks/${chatId}`));
  if (uid) batch.delete(db.doc(`telegramUsers/${uid}`));
  await batch.commit();
  return true;
}

/**
 * 같은 업데이트를 두 번 처리하지 않도록 update_id 로 거른다.
 * 처리에 시간이 걸리면(AI 응답 등) 텔레그램이 같은 업데이트를 재전송하는데,
 * 이 가드가 없으면 회고 단계가 두 칸씩 넘어간다.
 */
export async function claimUpdate(chatId: string, updateId: number): Promise<boolean> {
  const ref = db.doc(`telegramLinks/${chatId}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return true;                       // 연결 전 — 가드 대상 아님
    const last = (snap.data() as TelegramLinkDoc).lastUpdateId ?? 0;
    if (updateId <= last) return false;
    tx.update(ref, { lastUpdateId: updateId, lastSeenAt: FieldValue.serverTimestamp() });
    return true;
  });
}

// ── 대화 세션 ───────────────────────────────────────────────────────────────
const sessionRef = (uid: string) => db.doc(`users/${uid}/telegramSession/current`);

export async function getSession(uid: string): Promise<ReflectionSession | null> {
  const snap = await sessionRef(uid).get();
  if (!snap.exists) return null;
  const d = snap.data() as TelegramSessionDoc;
  if (d.flow !== 'reflection') return null;
  return {
    steps: d.steps as ReflectionSession['steps'],
    stepIndex: d.stepIndex,
    date: d.date,
    answers: d.answers ?? {},
    yesterdayResolution: d.yesterdayResolution,
    resolutionPracticed: d.resolutionPracticed,
    daySatisfaction: d.daySatisfaction,
    screenTimeMinutes: d.screenTimeMinutes,
  };
}

export async function saveSession(uid: string, s: ReflectionSession): Promise<void> {
  await sessionRef(uid).set({
    flow: 'reflection',
    date: s.date,
    steps: s.steps,
    stepIndex: s.stepIndex,
    answers: s.answers,
    yesterdayResolution: s.yesterdayResolution,
    resolutionPracticed: s.resolutionPracticed,
    daySatisfaction: s.daySatisfaction,
    screenTimeMinutes: s.screenTimeMinutes,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function clearSession(uid: string): Promise<void> {
  await sessionRef(uid).delete().catch(() => undefined);
}
