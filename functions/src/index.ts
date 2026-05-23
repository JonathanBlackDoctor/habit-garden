import * as admin from 'firebase-admin';

admin.initializeApp();

export { dailyReset }  from './dailyReset';
export { awardEngine, reflectionAward } from './awardEngine';
export { generateFeedback } from './feedback';
export { monthlyBackup } from './backup';
export { parsePrayerBulk } from './parsePrayer';
export { findDuplicatePrayers } from './findDuplicates';
export { generatePrayerWeekly } from './prayerWeekly';
export { prayerAward, prayerAnsweredAward } from './prayerAward';
export { aiCoach } from './aiCoach';
export { sendScheduledReminder } from './reminders';
export { ensureUserProfile, approveUser, listPendingUsers } from './userProfile';
