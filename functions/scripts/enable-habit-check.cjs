// Deployment-only configuration, scoped to the existing bot administrator.
// Credentials and the user's document contents must never be logged.
const fs = require('node:fs');
const admin = require('firebase-admin');
async function main() {
  const source = fs.readFileSync('src/telegram/setup.ts', 'utf8');
  const uid = source.match(/const OWNER_UID = '([^']+)'/)?.[1];
  if (!uid) throw new Error('Existing bot administrator not found');
  admin.initializeApp({ projectId: 'planner-web-quick' });
  const db = admin.firestore();
  const profile = await db.doc(`userProfiles/${uid}`).get();
  if (profile.data()?.status !== 'approved') throw new Error('Administrator profile is not approved');
  const ref = db.doc(`users/${uid}/settings/main`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Existing settings required');
    const settings = snap.data();
    const patch = {
      habitCheckReminders: 'three-times-daily',
      notifications: { reflectionReminder: false, morningBrief: false, prayerWeekly: false, progressWeekly: false },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!settings.habitCheckPreviousNotifications) patch.habitCheckPreviousNotifications = settings.notifications ?? {};
    tx.set(ref, patch, { merge: true });
  });
  const saved = (await ref.get()).data();
  if (saved.habitCheckReminders !== 'three-times-daily') throw new Error('Preference verification failed');
  console.log('Habit Check reminder preferences verified for the existing administrator; habit/prayer enablement preserved.');
}
main().catch(() => { console.error('Could not apply Habit Check preferences. No credentials or account data logged.'); process.exit(1); });
