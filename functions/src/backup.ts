/**
 * monthlyBackup — 매월 1일 03:30 KST
 * users/{uid} 전체를 JSON으로 Storage에 업로드 (14개월 rolling)
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const db      = admin.firestore();
const storage = admin.storage();
const ALLOWED_UID = 'XMgQWlM1wtM62hIheTH4sKGDNuC2';
const REGION = 'asia-northeast3';
const KST = 'Asia/Seoul';

export const monthlyBackup = functions
  .region(REGION)
  .pubsub
  .schedule('30 3 1 * *')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const uid     = ALLOWED_UID;
    const dateStr = format(toZonedTime(new Date(), KST), 'yyyy-MM');

    // days 컬렉션 백업
    const daysSnap = await db.collection(`users/${uid}/days`).get();
    const data: Record<string, unknown> = {};
    daysSnap.docs.forEach((d) => { data[d.id] = d.data(); });

    const json    = JSON.stringify(data, null, 2);
    const bucket  = storage.bucket();
    const file    = bucket.file(`backups/${uid}/${dateStr}.json`);
    await file.save(json, { contentType: 'application/json' });

    // 14개월 초과 파일 삭제
    const [files] = await bucket.getFiles({ prefix: `backups/${uid}/` });
    if (files.length > 14) {
      files.sort((a, b) => a.name.localeCompare(b.name));
      const toDelete = files.slice(0, files.length - 14);
      await Promise.all(toDelete.map((f) => f.delete()));
    }

    console.log(`monthlyBackup: saved ${dateStr}.json`);
  });
