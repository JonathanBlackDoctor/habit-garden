/**
 * setupTelegramBot — owner 가 /admin 에서 한 번 눌러 웹훅·명령 메뉴를 등록한다.
 * 로컬 스크립트로 하면 봇 토큰을 개발 PC 로 꺼내야 하므로, 서버에서 시크릿을 쥔 채 실행한다.
 */
import * as functions from 'firebase-functions/v1';
import { setWebhook, setMyCommands, getWebhookInfo, getMe, telegramWebhookSecret } from './api';

const REGION = 'asia-northeast3';
const OWNER_UID = 'XMgQWlM1wtM62hIheTH4sKGDNuC2';
const PROJECT_ID = 'planner-web-quick';

export const WEBHOOK_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/telegramWebhook`;

export const setupTelegramBot = functions
  .region(REGION)
  .runWith({ secrets: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'] })
  .https.onCall(async (_data, context) => {
    if (!context.auth || context.auth.uid !== OWNER_UID) {
      throw new functions.https.HttpsError('permission-denied', 'Owner only.');
    }
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) {
      throw new functions.https.HttpsError('failed-precondition', 'TELEGRAM_WEBHOOK_SECRET 시크릿이 설정되지 않았어요.');
    }

    const me = await getMe();
    await setWebhook(WEBHOOK_URL, telegramWebhookSecret(secret));
    await setMyCommands();
    const info = await getWebhookInfo();

    return {
      ok: true,
      botUsername: me.username ?? null,
      webhookUrl: WEBHOOK_URL,
      pendingUpdateCount: info.pending_update_count ?? 0,
      lastErrorMessage: info.last_error_message ?? null,
    };
  });
