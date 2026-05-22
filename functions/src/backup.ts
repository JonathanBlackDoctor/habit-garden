/**
 * monthlyBackup — 매월 1일 03:30 KST
 * 승인된 모든 사용자의 users/{uid}/days 를 JSON으로 Storage에 업로드 (각자 14개월 rolling)
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const db      = admin.firestore();
const storage = admin.storage();
const REGION = 'asia-northeast3';
const KST = 'Asia/Seoul';

export const monthlyBackup = functions
  .region(REGION)
  .pubsub
  .schedule('30 3 1 * *')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const dateStr = format(toZonedTime(new Date(), KST), 'yyyy-MM');
    const bucket  = storage.bucket();

    const profilesSnap = await db.collection('userProfiles').where('status', '==', 'approved').get();

    for (const profileDoc of profilesSnap.docs) {
      const uid = profileDoc.id;
      try {
        const daysSnap = await db.collection(`users/${uid}/days`).get();
        if (daysSnap.empty) continue;

        const data: Record<string, unknown> = {};
        daysSnap.docs.forEach((d) => { data[d.id] = d.data(); });

        const json = JSON.stringify(data, null, 2);
        const file = bucket.file(`backups/${uid}/${dateStr}.json`);
        await file.save(json, { contentType: 'application/json' });

        const [files] = await bucket.getFiles({ prefix: `backups/${uid}/` });
        if (files.length > 14) {
          files.sort((a, b) => a.name.localeCompare(b.name));
          const toDelete = files.slice(0, files.length - 14);
          await Promise.all(toDelete.map((f) => f.delete()));
        }

        console.log(`monthlyBackup: saved ${uid}/${dateStr}.json`);
      } catch (e) {
        console.error(`monthlyBackup failed for uid=${uid}:`, e);
      }
    }
  });
