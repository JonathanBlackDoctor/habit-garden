/**
 * userProfile — 다중 사용자 + 승인 게이트
 *  - ensureUserProfile: 신규 가입 시 userProfiles/{uid} 자동 생성
 *  - approveUser:       owner가 대기자 승인/거절
 *  - listPendingUsers:  owner가 대기자 목록 조회
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();
const REGION = 'asia-northeast3';
const OWNER_UID = 'XMgQWlM1wtM62hIheTH4sKGDNuC2';

export const ensureUserProfile = functions
  .region(REGION)
  .auth.user()
  .onCreate(async (user) => {
    const uid = user.uid;
    // 익명 게스트는 프로필/승인 대기열을 만들지 않는다.
    if (!user.providerData || user.providerData.length === 0) return;

    const profileRef  = db.doc(`userProfiles/${uid}`);
    const settingsRef = db.doc(`users/${uid}/settings/main`);

    const existing = await profileRef.get();
    if (existing.exists) return;

    const isOwner = uid === OWNER_UID;
    const now = FieldValue.serverTimestamp();

    const batch = db.batch();
    batch.set(profileRef, {
      uid,
      email:       user.email ?? '',
      displayName: user.displayName ?? null,
      photoURL:    user.photoURL ?? null,
      status:      isOwner ? 'approved' : 'pending',
      isOwner,
      createdAt:   now,
      approvedAt:  isOwner ? now : null,
      approvedBy:  isOwner ? uid : null,
    });
    batch.set(settingsRef, {
      features: { faith: isOwner },
      updatedAt: now,
    });
    await batch.commit();
  });

export const approveUser = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.uid !== OWNER_UID) {
      throw new functions.https.HttpsError('permission-denied', 'Owner only.');
    }
    const targetUid: string = (data?.targetUid ?? '').toString();
    const action: 'approve' | 'reject' = data?.action === 'reject' ? 'reject' : 'approve';
    if (!targetUid) {
      throw new functions.https.HttpsError('invalid-argument', 'targetUid required');
    }

    const ref = db.doc(`userProfiles/${targetUid}`);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Profile not found');
    }

    await ref.update({
      status: action === 'approve' ? 'approved' : 'rejected',
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: OWNER_UID,
    });
    return { ok: true, action };
  });

export const listPendingUsers = functions
  .region(REGION)
  .https.onCall(async (_data, context) => {
    if (!context.auth || context.auth.uid !== OWNER_UID) {
      throw new functions.https.HttpsError('permission-denied', 'Owner only.');
    }
    const snap = await db.collection('userProfiles').where('status', '==', 'pending').get();
    return {
      users: snap.docs.map((d) => {
        const x = d.data();
        return {
          uid:         d.id,
          email:       x.email ?? '',
          displayName: x.displayName ?? null,
          photoURL:    x.photoURL ?? null,
          createdAt:   x.createdAt?.toMillis ? x.createdAt.toMillis() : null,
        };
      }),
    };
  });
